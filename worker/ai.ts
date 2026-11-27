/* Cloudflare Workers AI：路由器与 OpenClash 日志脱敏、存储与智能诊断 */
import { Env, err, json, rateLimited, requireAdmin } from "./_shared";

const KV_LOGS_KEY = "logs:latest";
const KV_MODELS_KEY = "ai:models:cache:v3";
const KV_USAGE_KEY = "ai:usage:cache:v1";
const MODEL_ID_RE = /^@(?:cf|hf)\/[a-zA-Z0-9._\-\/]{3,120}$/;
const MODEL_PRIMARY = "@cf/qwen/qwen3.8-27b";
const MODEL_FALLBACK = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DAILY_FREE_NEURONS = 10000;
const BASE_OUTPUT_USD_PER_M = 0.4; // 1.0x 基准：@cf/zai-org/glm-4.7-flash 输出 $0.40/M (~36.4 Neurons/1K)

// 已下线或失效的旧默认模型 ID 自动映射到当前可用模型，避免 KV 旧配置继续触发 5007
const RETIRED_MODEL_MAP: Record<string, string> = {
  "@cf/qwen/qwen3-30b-a3b-fp8": MODEL_PRIMARY,
  "@cf/qwen/qwen2.5-7b-instruct": MODEL_FALLBACK,
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": MODEL_PRIMARY,
  "@cf/google/gemma-3-12b-it": "@cf/google/gemma-4-26b-a4b-it",
};

export interface AiModelOption {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  inputUsdPerM?: number;
  outputUsdPerM?: number;
  cachedUsdPerM?: number;
  inputNeuronsPer1K?: number;
  outputNeuronsPer1K?: number;
  costMultiplier?: number;
  paidOnly?: boolean;
  reasoning?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function enrichPriceFields(opt: AiModelOption): AiModelOption {
  const outUsd = opt.outputUsdPerM;
  const inUsd = opt.inputUsdPerM;
  return {
    ...opt,
    ...(typeof inUsd === "number" ? { inputNeuronsPer1K: round2(inUsd / 0.011) } : {}),
    ...(typeof outUsd === "number"
      ? {
          outputNeuronsPer1K: round2(outUsd / 0.011),
          costMultiplier: round2(outUsd / BASE_OUTPUT_USD_PER_M),
        }
      : {}),
  };
}

const BUILTIN_MODELS: AiModelOption[] = [
  { id: "@cf/qwen/qwen3.8-27b", name: "Qwen 3.8 27B（推荐·中文强）", description: "千问 3.8 27B 指令模型，中文与网络排错能力强", contextWindow: 262144, inputUsdPerM: 0.45, outputUsdPerM: 3.2, cachedUsdPerM: 0.05, reasoning: true },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B（旗舰通用·快）", description: "70B FP8 旗舰模型，推理稳定且响应快", contextWindow: 24000, inputUsdPerM: 0.293, outputUsdPerM: 2.253 },
  { id: "@cf/zai-org/glm-4.7-flash", name: "GLM 4.7 Flash（中文省额度）", description: "智谱轻量多语言文本模型，适合日常高频巡检", contextWindow: 131072, inputUsdPerM: 0.0605, outputUsdPerM: 0.4, reasoning: true },
  { id: "@cf/google/gemma-4-26b-a4b-it", name: "Gemma 4 26B（Google·超值）", description: "Google Gemma 4 指令模型，长上下文且输出单价极低", contextWindow: 256000, inputUsdPerM: 0.1, outputUsdPerM: 0.3, cachedUsdPerM: 0.05, reasoning: true },
  { id: "@cf/mistralai/mistral-small-3.1-24b-instruct", name: "Mistral Small 3.1 24B", description: "长上下文结构化分析能力强", contextWindow: 128000, inputUsdPerM: 0.351, outputUsdPerM: 0.555 },
  { id: "@cf/qwen/qwen2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B（排错）", description: "擅长日志、配置与脚本问题排查", contextWindow: 32768, inputUsdPerM: 0.66, outputUsdPerM: 1.0 },
].map(enrichPriceFields);

interface CfRawProperty {
  property_id?: string;
  value?: unknown;
}

function parseModelProperties(props?: CfRawProperty[]): Partial<AiModelOption> {
  if (!Array.isArray(props)) return {};
  const meta: Partial<AiModelOption> = {};
  for (const p of props) {
    if (!p?.property_id) continue;
    if (p.property_id === "require_workers_paid" && String(p.value) === "true") {
      meta.paidOnly = true;
    } else if (p.property_id === "context_window") {
      const cw = Number(p.value);
      if (Number.isFinite(cw) && cw > 0) meta.contextWindow = cw;
    } else if (p.property_id === "reasoning" && String(p.value) === "true") {
      meta.reasoning = true;
    } else if (p.property_id === "price" && Array.isArray(p.value)) {
      for (const item of p.value as { unit?: string; price?: number }[]) {
        if (typeof item?.price !== "number" || !item.unit) continue;
        if (item.unit.includes("cached input")) meta.cachedUsdPerM = item.price;
        else if (item.unit.includes("input")) meta.inputUsdPerM = item.price;
        else if (item.unit.includes("output")) meta.outputUsdPerM = item.price;
      }
    }
  }
  return meta;
}

export async function getAiModels(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");

  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";

  if (!refresh) {
    const cached = await env.KV.get<{ models: AiModelOption[]; source: "online" | "builtin"; updatedAt: number }>(KV_MODELS_KEY, "json");
    if (cached?.models?.length) return json(cached);
  }

  const accId = env.CF_ACCOUNT_ID?.trim();
  const apiToken = env.CF_API_TOKEN?.trim();
  if (accId && apiToken) {
    try {
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accId)}/ai/models/search?task=Text%20Generation&per_page=100`;
      const res = await fetch(apiUrl, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      if (res.ok) {
        const body = (await res.json()) as {
          success?: boolean;
          result?: { name: string; description?: string; properties?: CfRawProperty[] }[];
        };
        if (body.success && Array.isArray(body.result) && body.result.length > 0) {
          const onlineModels: AiModelOption[] = body.result
            .filter((m) => m.name && MODEL_ID_RE.test(m.name))
            .map((m) =>
              enrichPriceFields({
                id: m.name,
                name: m.name.replace(/^@(?:cf|hf)\/[^/]+\//, ""),
                description: (m.description || "").slice(0, 120),
                ...parseModelProperties(m.properties),
              }),
            )
            .sort((a, b) => {
              // 免费可用模型优先于需付费模型，推荐主力模型靠前
              const paidOrder = (a.paidOnly ? 1 : 0) - (b.paidOnly ? 1 : 0);
              if (paidOrder !== 0) return paidOrder;
              const score = (id: string) =>
                /qwen3\.8|glm-4\.7|gemma-4|llama-3\.3/i.test(id) ? 0 : /qwen|mistral|llama-4|gpt-oss-20b/i.test(id) ? 1 : 2;
              return score(a.id) - score(b.id) || a.id.localeCompare(b.id);
            });
          if (onlineModels.length > 0) {
            const payload = { models: onlineModels, source: "online" as const, updatedAt: Date.now() };
            await env.KV.put(KV_MODELS_KEY, JSON.stringify(payload), { expirationTtl: 3600 });
            return json(payload);
          }
        }
      }
    } catch {
      /* 在线拉取失败则回退内置列表 */
    }
  }

  const fallback = { models: BUILTIN_MODELS, source: "builtin" as const, updatedAt: Date.now() };
  return json(fallback);
}

export interface AiUsageModelRow {
  modelId: string;
  requests: number;
  neurons: number;
  inputTokens: number;
  outputTokens: number;
  inferenceMs: number;
}

export interface AiUsageResp {
  available: boolean;
  reason?: string;
  dateUtc?: string;
  dailyFreeLimit?: number;
  todayNeurons?: number;
  remainingNeurons?: number;
  requests?: number;
  inputTokens?: number;
  outputTokens?: number;
  byModel?: AiUsageModelRow[];
  updatedAt?: number;
}

/** 查询账号今日（UTC）Workers AI Neurons 用量（需 CF_ACCOUNT_ID + 带 Account Analytics: Read 的 CF_API_TOKEN） */
export async function getAiUsage(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");

  const accId = env.CF_ACCOUNT_ID?.trim();
  const apiToken = env.CF_API_TOKEN?.trim();
  if (!accId || !apiToken) {
    const missing = [!accId ? "CF_ACCOUNT_ID" : "", !apiToken ? "CF_API_TOKEN" : ""].filter(Boolean).join("、");
    return json({ available: false, reason: `Worker 运行时未配置 ${missing}` } satisfies AiUsageResp);
  }

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const dateUtc = new Date().toISOString().slice(0, 10);

  if (!refresh) {
    const cached = await env.KV.get<AiUsageResp>(KV_USAGE_KEY, "json");
    if (cached?.available && cached.dateUtc === dateUtc && Date.now() - (cached.updatedAt || 0) < 60_000) {
      return json(cached);
    }
  }

  const query = `query ($acc: String!, $since: Date!) {
    viewer {
      accounts(filter: { accountTag: $acc }) {
        aiInferenceAdaptiveGroups(limit: 50, filter: { date_geq: $since }) {
          count
          sum {
            totalNeurons
            totalInputTokens
            totalOutputTokens
            totalInferenceTimeMs
          }
          dimensions {
            modelId
          }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables: { acc: accId, since: dateUtc } }),
    });
    if (!res.ok) {
      return json({ available: false, reason: `GraphQL HTTP ${res.status}` } satisfies AiUsageResp);
    }
    const body = (await res.json()) as {
      data?: {
        viewer?: {
          accounts?: {
            aiInferenceAdaptiveGroups?: {
              count?: number;
              sum?: { totalNeurons?: number; totalInputTokens?: number; totalOutputTokens?: number; totalInferenceTimeMs?: number };
              dimensions?: { modelId?: string };
            }[];
          }[];
        };
      };
      errors?: { message?: string }[];
    };
    if (body.errors?.length) {
      return json({ available: false, reason: body.errors[0]?.message || "GraphQL 查询拒绝（请确认 Token 含 Account Analytics: Read）" } satisfies AiUsageResp);
    }
    const groups = body.data?.viewer?.accounts?.[0]?.aiInferenceAdaptiveGroups || [];
    let todayNeurons = 0;
    let requests = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    const byModel: AiUsageModelRow[] = [];
    for (const g of groups) {
      const neurons = Number(g.sum?.totalNeurons || 0);
      const reqs = Number(g.count || 0);
      const inTok = Number(g.sum?.totalInputTokens || 0);
      const outTok = Number(g.sum?.totalOutputTokens || 0);
      const ms = Number(g.sum?.totalInferenceTimeMs || 0);
      todayNeurons += neurons;
      requests += reqs;
      inputTokens += inTok;
      outputTokens += outTok;
      if (g.dimensions?.modelId) {
        byModel.push({
          modelId: g.dimensions.modelId,
          requests: reqs,
          neurons: round2(neurons),
          inputTokens: inTok,
          outputTokens: outTok,
          inferenceMs: ms,
        });
      }
    }
    byModel.sort((a, b) => b.neurons - a.neurons);
    const payload: AiUsageResp = {
      available: true,
      dateUtc,
      dailyFreeLimit: DAILY_FREE_NEURONS,
      todayNeurons: round2(todayNeurons),
      remainingNeurons: round2(Math.max(0, DAILY_FREE_NEURONS - todayNeurons)),
      requests,
      inputTokens,
      outputTokens,
      byModel,
      updatedAt: Date.now(),
    };
    await env.KV.put(KV_USAGE_KEY, JSON.stringify(payload), { expirationTtl: 120 });
    return json(payload);
  } catch (e) {
    return json({ available: false, reason: (e as Error).message || "用量查询失败" } satisfies AiUsageResp);
  }
}

export type LogKind = "openwrt" | "openclash" | "nas";

export interface StoredIngestLogs {
  updated_at: number;
  oldest_at?: number;
  retentionHours?: number;
  retentionDays?: number;
  days?: number;
  source: string;
  openwrt: string[];
  openclash: string[];
  nas?: string[];
}

const LOG_RETENTION_DAYS = 7;
const LOG_RETENTION_HOURS = LOG_RETENTION_DAYS * 24;
const MAX_LINES_PER_HOUR = 1000;
const LOG_KINDS: LogKind[] = ["openwrt", "openclash", "nas"];
const WARN_LINE_RE = /err|warn|crit|fatal|panic|oom|fail|timeout|deadline|closed|eof|refused|reset|tx error|watchdog|down/i;
let logTableReady = false;

async function ensureLogTable(env: Env): Promise<void> {
  if (logTableReady) return;
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS logs_hourly (bucket_ts INTEGER NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL, updated_at INTEGER NOT NULL, line_count INTEGER NOT NULL, lines_json TEXT NOT NULL, PRIMARY KEY (bucket_ts, kind)); CREATE INDEX IF NOT EXISTS idx_logs_hourly_updated ON logs_hourly (updated_at);",
  );
  logTableReady = true;
}

/** 对日志中的敏感凭据与订阅链接做自动脱敏 */
export function sanitizeLogLine(line: string): string {
  return String(line || "")
    .replace(/\r/g, "")
    .slice(0, 400)
    .replace(/(password|passwd|pwd|secret|token|key|auth)=([^\s&"']+)/gi, "$1=***")
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, "$1***")
    .replace(/(https?:\/\/[^\s"'<>]+?\?(?:[^\s"'<>]*?(?:token|key|auth|sub|password)=)[^\s"'<>]+)/gi, "[已脱敏URL]");
}

function cleanLogLines(input: unknown, maxLines = 200): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-maxLines)
    .map((x) => sanitizeLogLine(String(x || "")).trim())
    .filter(Boolean);
}

/** 供 /api/ingest 调用：按小时分桶合并写入 D1 logs_hourly（保留 24 小时滚动记录且避免高频写 KV） */
export async function saveIngestedLogs(
  env: Env,
  source: string,
  updatedAtMs: number,
  logs?: { openwrt?: unknown; openclash?: unknown; nas?: unknown },
): Promise<void> {
  if (!logs || typeof logs !== "object") return;
  const incoming: Record<LogKind, string[]> = {
    openwrt: cleanLogLines(logs.openwrt, 200),
    openclash: cleanLogLines(logs.openclash, 200),
    nas: cleanLogLines(logs.nas, 200),
  };
  if (incoming.openwrt.length === 0 && incoming.openclash.length === 0 && incoming.nas.length === 0) return;

  await ensureLogTable(env);
  const bucketTs = Math.floor(updatedAtMs / 1000 / 3600) * 3600;
  const existingRows = await env.DB.prepare("SELECT kind, lines_json FROM logs_hourly WHERE bucket_ts = ?")
    .bind(bucketTs)
    .all<{ kind: string; lines_json: string }>();
  const existingMap = new Map<string, string[]>();
  for (const r of existingRows.results || []) {
    try {
      const parsed = JSON.parse(r.lines_json);
      if (Array.isArray(parsed)) existingMap.set(r.kind, parsed.map(String));
    } catch {
      /* 忽略损坏分桶 */
    }
  }

  const stmts: D1PreparedStatement[] = [];
  let isNewHourBucket = existingMap.size === 0;
  for (const kind of LOG_KINDS) {
    const batch = incoming[kind];
    if (batch.length === 0) continue;
    const prev = existingMap.get(kind) || [];
    const seen = new Set(prev);
    let added = 0;
    const merged = [...prev];
    for (const line of batch) {
      if (!seen.has(line)) {
        seen.add(line);
        merged.push(line);
        added++;
      }
    }
    if (added === 0 && prev.length > 0) continue;
    const capped = merged.length > MAX_LINES_PER_HOUR ? merged.slice(-MAX_LINES_PER_HOUR) : merged;
    stmts.push(
      env.DB.prepare(
        "INSERT INTO logs_hourly (bucket_ts, kind, source, updated_at, line_count, lines_json) VALUES (?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT (bucket_ts, kind) DO UPDATE SET source = excluded.source, updated_at = excluded.updated_at, line_count = excluded.line_count, lines_json = excluded.lines_json",
      ).bind(bucketTs, kind, source, updatedAtMs, capped.length, JSON.stringify(capped)),
    );
  }
  if (isNewHourBucket) {
    // 跨入新小时分桶时顺带清理超过 7 天 + 2 小时的旧分桶
    const cutoffTs = bucketTs - (LOG_RETENTION_HOURS + 2) * 3600;
    stmts.push(env.DB.prepare("DELETE FROM logs_hourly WHERE bucket_ts < ?").bind(cutoffTs));
  }
  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }
}

async function readRollingMeta(env: Env): Promise<{
  updated_at: number;
  oldest_at?: number;
  source: string;
  counts: Record<LogKind, number>;
  counts7d: Record<LogKind, number>;
} | null> {
  await ensureLogTable(env);
  const nowSec = Math.floor(Date.now() / 1000);
  const cutoff24h = nowSec - 24 * 3600;
  const cutoff7d = nowSec - LOG_RETENTION_HOURS * 3600;
  const rows = await env.DB.prepare(
    "SELECT kind, source, MIN(bucket_ts) AS min_bucket, MAX(updated_at) AS max_updated, " +
      "SUM(CASE WHEN bucket_ts >= ? THEN line_count ELSE 0 END) AS lines_24h, " +
      "SUM(line_count) AS lines_7d " +
      "FROM logs_hourly WHERE bucket_ts >= ? GROUP BY kind",
  )
    .bind(cutoff24h, cutoff7d)
    .all<{ kind: string; source: string; min_bucket: number; max_updated: number; lines_24h: number; lines_7d: number }>();
  const res = rows.results || [];
  if (res.length > 0) {
    const counts: Record<LogKind, number> = { openwrt: 0, openclash: 0, nas: 0 };
    const counts7d: Record<LogKind, number> = { openwrt: 0, openclash: 0, nas: 0 };
    let updatedAt = 0;
    let oldestSec = Number.MAX_SAFE_INTEGER;
    let source = "router";
    for (const r of res) {
      if (r.kind === "openwrt" || r.kind === "openclash" || r.kind === "nas") {
        counts[r.kind] = Number(r.lines_24h || 0);
        counts7d[r.kind] = Number(r.lines_7d || 0);
      }
      if (Number(r.max_updated) > updatedAt) {
        updatedAt = Number(r.max_updated);
        source = r.source || source;
      }
      if (Number(r.min_bucket) > 0 && Number(r.min_bucket) < oldestSec) {
        oldestSec = Number(r.min_bucket);
      }
    }
    return {
      updated_at: updatedAt || Date.now(),
      oldest_at: oldestSec < Number.MAX_SAFE_INTEGER ? oldestSec * 1000 : undefined,
      source,
      counts,
      counts7d,
    };
  }
  // 兼容旧 KV 快照平滑过渡
  const legacy = await env.KV.get<StoredIngestLogs>(KV_LOGS_KEY, "json");
  if (!legacy) return null;
  const legacyCounts = {
    openwrt: legacy.openwrt?.length ?? 0,
    openclash: legacy.openclash?.length ?? 0,
    nas: legacy.nas?.length ?? 0,
  };
  return {
    updated_at: legacy.updated_at,
    oldest_at: legacy.updated_at,
    source: legacy.source,
    counts: legacyCounts,
    counts7d: { ...legacyCounts },
  };
}

async function readRollingLines(
  env: Env,
  kinds: LogKind[],
  hours: number,
  limitPerKind: number,
  onlyWarn = false,
): Promise<Record<LogKind, string[]>> {
  await ensureLogTable(env);
  const clampedHours = Math.max(1, Math.min(LOG_RETENTION_HOURS, Math.floor(hours)));
  const cutoffTs = Math.floor(Date.now() / 1000) - clampedHours * 3600;
  const placeholders = kinds.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT kind, lines_json FROM logs_hourly WHERE bucket_ts >= ? AND kind IN (${placeholders}) ORDER BY bucket_ts ASC`,
  )
    .bind(cutoffTs, ...kinds)
    .all<{ kind: string; lines_json: string }>();

  const out: Record<LogKind, string[]> = { openwrt: [], openclash: [], nas: [] };
  for (const r of rows.results || []) {
    if (r.kind !== "openwrt" && r.kind !== "openclash" && r.kind !== "nas") continue;
    try {
      const parsed = JSON.parse(r.lines_json);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const line = String(item);
          if (!onlyWarn || WARN_LINE_RE.test(line)) out[r.kind].push(line);
        }
      }
    } catch {
      /* 忽略 */
    }
  }
  const hasAny = out.openwrt.length > 0 || out.openclash.length > 0 || out.nas.length > 0;
  if (!hasAny && !onlyWarn) {
    const legacy = await env.KV.get<StoredIngestLogs>(KV_LOGS_KEY, "json");
    if (legacy) {
      out.openwrt = legacy.openwrt || [];
      out.openclash = legacy.openclash || [];
      out.nas = legacy.nas || [];
    }
  }
  for (const k of kinds) {
    if (limitPerKind > 0 && out[k].length > limitPerKind) {
      out[k] = out[k].slice(-limitPerKind);
    }
  }
  return out;
}

export async function getAiLogs(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const url = new URL(req.url);
  const detail = url.searchParams.get("detail") === "1";
  const onlyWarn = url.searchParams.get("onlyWarn") === "1";
  const reqKind = url.searchParams.get("kind");
  const daysRaw = Number(url.searchParams.get("days") || "1");
  const days = daysRaw === 7 ? 7 : daysRaw === 3 ? 3 : 1;
  const limitRaw = Number(url.searchParams.get("limit") || "600");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(2000, Math.floor(limitRaw)) : 600;

  const metaRaw = await readRollingMeta(env);
  const meta = metaRaw
    ? {
        updated_at: metaRaw.updated_at,
        oldest_at: metaRaw.oldest_at,
        retentionHours: LOG_RETENTION_HOURS,
        retentionDays: LOG_RETENTION_DAYS,
        source: metaRaw.source,
        counts: metaRaw.counts,
        counts7d: metaRaw.counts7d,
      }
    : null;

  let logs: StoredIngestLogs | null | undefined;
  if (detail) {
    if (!meta) {
      logs = null;
    } else {
      const targetKinds: LogKind[] =
        reqKind === "openwrt" || reqKind === "openclash" || reqKind === "nas" ? [reqKind] : LOG_KINDS;
      const fetched = await readRollingLines(env, targetKinds, days * 24, limit, onlyWarn);
      logs = {
        updated_at: meta.updated_at,
        oldest_at: meta.oldest_at,
        retentionHours: LOG_RETENTION_HOURS,
        retentionDays: LOG_RETENTION_DAYS,
        days,
        source: meta.source,
        openwrt: fetched.openwrt,
        openclash: fetched.openclash,
        nas: fetched.nas,
      };
    }
  }

  return json({
    available: !!meta,
    aiBound: !!env.AI,
    meta,
    ...(detail ? { logs } : {}),
  });
}

async function readDeviceSummary(env: Env): Promise<string> {
  const rows = await env.DB.prepare("SELECT source, updated_at, snapshot FROM latest").all<{
    source: string;
    updated_at: number;
    snapshot: string;
  }>();
  const parts: string[] = [];
  for (const r of rows.results || []) {
    try {
      const s = JSON.parse(r.snapshot) as {
        devices?: { name: string; status?: string; cpu?: number; mem?: number; load1?: number; temp?: number; connections?: number; internet?: boolean; version?: string }[];
        alerts?: { device: string; rule: string; severity: string; message: string }[];
      };
      for (const d of s.devices || []) {
        parts.push(
          `设备[${d.name}] 状态=${d.status || "unknown"} CPU=${d.cpu ?? "-"}% 内存=${d.mem ?? "-"}% 负载=${d.load1 ?? "-"} 温度=${d.temp ?? "-"}°C 连接数=${d.connections ?? "-"} 联网=${d.internet ?? "-"} 版本=${d.version || "-"}`,
        );
      }
      for (const a of s.alerts || []) {
        parts.push(`当前告警[${a.device}/${a.severity}] ${a.rule}: ${a.message}`);
      }
    } catch {
      /* 忽略单条解析错误 */
    }
  }
  return parts.join("\n");
}

function extractAiText(res: unknown): string {
  if (!res || typeof res !== "object") return String(res || "");
  const r = res as {
    response?: string;
    choices?: { message?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null } }[];
  };
  if (Array.isArray(r.choices) && r.choices[0]?.message) {
    const msg = r.choices[0].message;
    if (typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
    if (typeof r.response === "string" && r.response.trim()) return r.response.trim();
    if (typeof msg.reasoning_content === "string" && msg.reasoning_content.trim()) return msg.reasoning_content.trim();
    if (typeof msg.reasoning === "string" && msg.reasoning.trim()) return msg.reasoning.trim();
  }
  if (typeof r.response === "string") return r.response.trim();
  return JSON.stringify(res);
}

/** 提取消息指纹（去掉前导时间），用于把高频重复日志折叠为 `×N`，避免淹没关键报错 */
function logFingerprint(line: string): string {
  return line
    .replace(/^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d+\s+\d+:\d+:\d+\s+\d{4}\s+/, "")
    .replace(/^(?:time="[^"]+"|\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+/, "");
}

/** 去重高频刷屏日志：保留近 24h 内所有重要告警/异常与最新尾部 */
function compressLogsForAi(lines: string[], maxChars: number): string {
  if (lines.length === 0) return "";
  const order: string[] = [];
  const counts = new Map<string, number>();
  const latestLine = new Map<string, string>();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const fp = logFingerprint(line);
    if (!counts.has(fp)) {
      order.push(fp);
      counts.set(fp, 1);
    } else {
      counts.set(fp, (counts.get(fp) || 0) + 1);
    }
    latestLine.set(fp, line);
  }
  const merged = order.map((fp) => {
    const n = counts.get(fp) || 1;
    const l = latestLine.get(fp) || "";
    return n > 1 ? `${l} (24h内重复 ×${n})` : l;
  });
  const isImportant = (s: string) =>
    /err|warn|crit|fatal|panic|oom|fail|timeout|deadline|closed|eof|refused|reset|tx error|link|down|watchdog|restart/i.test(s);

  // 先保底收入全部尾部，若 24h 唯一日志超预算则优先保留早期异常行 + 最近尾部
  const pickedSet = new Set<number>();
  let total = 0;
  // 第一遍：先纳入最近一半预算的最新尾部
  const tailBudget = Math.floor(maxChars * 0.65);
  for (let i = merged.length - 1; i >= 0; i--) {
    const add = merged[i].length + (pickedSet.size > 0 ? 1 : 0);
    if (total + add > tailBudget && pickedSet.size > 0) break;
    pickedSet.add(i);
    total += add;
  }
  // 第二遍：用剩余预算回溯保留更早时段里的异常/告警行
  for (let i = merged.length - 1; i >= 0; i--) {
    if (pickedSet.has(i) || !isImportant(merged[i])) continue;
    const add = merged[i].length + 1;
    if (total + add > maxChars) continue;
    pickedSet.add(i);
    total += add;
  }
  // 第三遍：若仍有空间，从新到旧补足常规日志
  for (let i = merged.length - 1; i >= 0; i--) {
    if (pickedSet.has(i)) continue;
    const add = merged[i].length + 1;
    if (total + add > maxChars) break;
    pickedSet.add(i);
    total += add;
  }
  const picked = [...pickedSet].sort((a, b) => a - b).map((idx) => merged[idx]);
  const out = picked.join("\n");
  return out.length > maxChars ? out.slice(-maxChars) : out;
}

function splitManualLogs(raw?: string): string[] {
  return String(raw || "")
    .split(/\r?\n/)
    .slice(-120)
    .map(sanitizeLogLine)
    .filter(Boolean);
}

interface AiRunUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedNeurons?: number;
}

function extractAiUsage(res: unknown, modelOpt?: AiModelOption): AiRunUsage | undefined {
  if (!res || typeof res !== "object") return undefined;
  const u = (res as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
  if (!u || typeof u !== "object") return undefined;
  const promptTokens = typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined;
  const completionTokens = typeof u.completion_tokens === "number" ? u.completion_tokens : undefined;
  const totalTokens = typeof u.total_tokens === "number" ? u.total_tokens : undefined;
  let estimatedNeurons: number | undefined;
  if (
    typeof promptTokens === "number" &&
    typeof completionTokens === "number" &&
    typeof modelOpt?.inputNeuronsPer1K === "number" &&
    typeof modelOpt?.outputNeuronsPer1K === "number"
  ) {
    estimatedNeurons = round2(
      (promptTokens / 1000) * modelOpt.inputNeuronsPer1K + (completionTokens / 1000) * modelOpt.outputNeuronsPer1K,
    );
  }
  return { promptTokens, completionTokens, totalTokens, estimatedNeurons };
}

export async function aiDiagnose(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  if (await rateLimited(env, req, "rl:ai", 20)) return err(429, "AI 诊断请求过于频繁，请稍后再试");
  if (!env.AI) return err(503, "Workers AI 未绑定（请检查 wrangler.toml [ai] 配置）");

  let body: { mode?: string; model?: string; openwrt?: string; openclash?: string; nas?: string; question?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "JSON 格式错误");
  }

  const mode = body.mode === "manual" ? "manual" : "auto";
  const rawModel = body.model && MODEL_ID_RE.test(body.model.trim()) ? body.model.trim() : MODEL_PRIMARY;
  const requestedModel = RETIRED_MODEL_MAP[rawModel] || rawModel;
  const question = sanitizeLogLine(body.question || "").slice(0, 200);
  let openwrtLines: string[] = [];
  let openclashLines: string[] = [];
  let nasLines: string[] = [];

  if (mode === "manual") {
    openwrtLines = splitManualLogs(body.openwrt);
    openclashLines = splitManualLogs(body.openclash);
    nasLines = splitManualLogs(body.nas);
  } else {
    // AI 默认仅优先读取并分析最近 24 小时日志，兼顾时效性与上下文预算
    const rolling = await readRollingLines(env, LOG_KINDS, 24, 3000);
    openwrtLines = rolling.openwrt;
    openclashLines = rolling.openclash;
    nasLines = rolling.nas;
  }

  const openwrtText = compressLogsForAi(openwrtLines, 4200);
  const openclashText = compressLogsForAi(openclashLines, 4200);
  const nasText = compressLogsForAi(nasLines, 3200);

  const deviceSummary = await readDeviceSummary(env);
  if (!openwrtText && !openclashText && !nasText && !deviceSummary) {
    return err(400, "暂无可供分析的日志或监控数据，请先粘贴日志或等待采集器上报");
  }

  const sections: string[] = [];
  if (deviceSummary) sections.push(`【当前设备监控与告警摘要】\n${deviceSummary}`);
  if (openwrtText) sections.push(`【OpenWrt 路由器系统日志（近 24 小时共 ${openwrtLines.length} 行·已去重摘要）】\n${openwrtText}`);
  if (openclashText) sections.push(`【OpenClash 日志（近 24 小时共 ${openclashLines.length} 行·已去重摘要）】\n${openclashText}`);
  if (nasText) sections.push(`【飞牛 NAS 系统日志（近 24 小时共 ${nasLines.length} 行·已去重摘要）】\n${nasText}`);
  if (question) sections.push(`【用户补充问题】\n${question}`);

  const messages = [
    {
      role: "system",
      content:
        "你是一位精通 OpenWrt (FanchmWrt)、Linux/Debian NAS、网络栈与 OpenClash (Mihomo/Clash Meta) 的资深运维工程师。" +
        "请根据提供的设备监控指标、OpenWrt 路由器系统日志、OpenClash 日志与飞牛 NAS 日志，用简体中文输出结构化诊断报告。\n" +
        "必须严格按以下分项结构输出，不能因某一端报错较多而跳过路由器系统本身的分析：\n" +
        "1. **整体健康与核心结论**（1-2 句话直击整体状态）\n" +
        "2. **路由器系统（OpenWrt / FanchmWrt）分析**（独立分析内核、网口/驱动、fwxd/uwsgi/DHCP 等系统日志及负载、连接数，即使正常也要明确说明健康情况与需关注的微弱警告）\n" +
        "3. **OpenClash 代理与链路分析**（分析内核状态、节点断连/超时、DNS/Fake-IP/TUN 等）\n" +
        "4. **飞牛 NAS 状态与日志分析**（结合 NAS 指标与系统日志分析磁盘、温控、服务异常；若未开启 NAS 日志采集则基于指标分析并提示可开启独立日志开关）\n" +
        "5. **具体排查与修复建议**（给出可执行的具体 LuCI、OpenClash 或 NAS 操作步骤）\n" +
        "注意：严格依据实际日志与数据作答，不要编造不存在的报错。",
    },
    {
      role: "user",
      content: sections.join("\n\n"),
    },
  ];

  let usedModel = requestedModel;
  let rawOut: unknown;
  let resultText = "";
  try {
    rawOut = await env.AI.run(requestedModel, { messages, max_tokens: 1800, temperature: 0.3 });
    resultText = extractAiText(rawOut);
  } catch (e1) {
    try {
      usedModel = MODEL_FALLBACK;
      rawOut = await env.AI.run(MODEL_FALLBACK, { messages, max_tokens: 1800, temperature: 0.3 });
      resultText = extractAiText(rawOut);
    } catch (e2) {
      const msg = (e2 as Error).message || (e1 as Error).message || "Workers AI 调用失败";
      return err(502, `Workers AI 调用失败：${msg}（本地 dev 需先执行 npx wrangler login 并连接 Cloudflare）`);
    }
  }

  const cachedCatalog = await env.KV.get<{ models: AiModelOption[] }>(KV_MODELS_KEY, "json").catch(() => null);
  const modelOpt = (cachedCatalog?.models || BUILTIN_MODELS).find((m) => m.id === usedModel);
  const usage = extractAiUsage(rawOut, modelOpt);

  return json({
    ok: true,
    model: usedModel,
    mode,
    analyzedAt: Date.now(),
    report: resultText,
    ...(usage ? { usage } : {}),
  });
}
