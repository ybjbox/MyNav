/* Cloudflare Workers AI：路由器与 OpenClash 日志脱敏、存储与智能诊断 */
import { Env, err, json, rateLimited, requireAdmin } from "./_shared";

const KV_LOGS_KEY = "logs:latest";
const KV_MODELS_KEY = "ai:models:cache";
const MODEL_ID_RE = /^@(?:cf|hf)\/[a-zA-Z0-9._\-\/]{3,120}$/;
const MODEL_PRIMARY = "@cf/qwen/qwen3-30b-a3b-fp8";
const MODEL_FALLBACK = "@cf/qwen/qwen2.5-7b-instruct";

export interface AiModelOption {
  id: string;
  name: string;
  description?: string;
}

const BUILTIN_MODELS: AiModelOption[] = [
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", name: "Qwen3 30B MoE（推荐·中文强）", description: "稀疏激活 30B，中文与网络排错能力强且省额度" },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B（旗舰通用）", description: "70B 旗舰指令模型，综合推理稳健" },
  { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 32B（深度推理）", description: "适合复杂网络链路与多日志交叉排错" },
  { id: "@cf/google/gemma-3-12b-it", name: "Gemma 3 12B（均衡）", description: "Google 轻量高效指令模型" },
  { id: "@cf/mistralai/mistral-small-3.1-24b-instruct", name: "Mistral Small 3.1 24B", description: "长上下文结构化分析能力强" },
  { id: "@cf/qwen/qwen2.5-7b-instruct", name: "Qwen 2.5 7B（轻量省额度）", description: "低 Neuron 消耗，适合高频日常巡检" },
];

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
          result?: { name: string; description?: string; properties?: { property_id: string; value: string }[] }[];
        };
        if (body.success && Array.isArray(body.result) && body.result.length > 0) {
          const onlineModels: AiModelOption[] = body.result
            .filter((m) => m.name && MODEL_ID_RE.test(m.name))
            .map((m) => ({
              id: m.name,
              name: m.name.replace(/^@(?:cf|hf)\/[^/]+\//, ""),
              description: (m.description || "").slice(0, 120),
            }))
            .sort((a, b) => {
              const score = (id: string) =>
                /qwen3|llama-3\.3|deepseek-r1/i.test(id) ? 0 : /qwen|llama-3\.1|gemma-3|mistral/i.test(id) ? 1 : 2;
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

export interface StoredIngestLogs {
  updated_at: number;
  source: string;
  openwrt: string[];
  openclash: string[];
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

function cleanLogLines(input: unknown, maxLines = 100): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-maxLines)
    .map((x) => sanitizeLogLine(String(x || "")).trim())
    .filter(Boolean);
}

/** 供 /api/ingest 调用：可选保存采集器上报的 OpenWrt / OpenClash 脱敏日志 */
export async function saveIngestedLogs(
  env: Env,
  source: string,
  updatedAtMs: number,
  logs?: { openwrt?: unknown; openclash?: unknown },
): Promise<void> {
  if (!logs || typeof logs !== "object") return;
  const openwrt = cleanLogLines(logs.openwrt, 100);
  const openclash = cleanLogLines(logs.openclash, 100);
  if (openwrt.length === 0 && openclash.length === 0) return;

  const payload: StoredIngestLogs = {
    updated_at: updatedAtMs,
    source,
    openwrt,
    openclash,
  };
  await env.KV.put(KV_LOGS_KEY, JSON.stringify(payload), { expirationTtl: 7 * 86400 });
}

export async function getAiLogs(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const stored = await env.KV.get<StoredIngestLogs>(KV_LOGS_KEY, "json");
  return json({
    available: !!stored,
    aiBound: !!env.AI,
    logs: stored || null,
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
  const r = res as { response?: string; choices?: { message?: { content?: string } }[] };
  if (typeof r.response === "string") return r.response.trim();
  if (Array.isArray(r.choices) && r.choices[0]?.message?.content) {
    return String(r.choices[0].message.content).trim();
  }
  return JSON.stringify(res);
}

export async function aiDiagnose(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  if (await rateLimited(env, req, "rl:ai", 20)) return err(429, "AI 诊断请求过于频繁，请稍后再试");
  if (!env.AI) return err(503, "Workers AI 未绑定（请检查 wrangler.toml [ai] 配置）");

  let body: { mode?: string; model?: string; openwrt?: string; openclash?: string; question?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "JSON 格式错误");
  }

  const mode = body.mode === "manual" ? "manual" : "auto";
  const requestedModel = body.model && MODEL_ID_RE.test(body.model.trim()) ? body.model.trim() : MODEL_PRIMARY;
  const question = sanitizeLogLine(body.question || "").slice(0, 200);
  let openwrtText = "";
  let openclashText = "";

  if (mode === "manual") {
    openwrtText = String(body.openwrt || "")
      .split(/\r?\n/)
      .slice(-120)
      .map(sanitizeLogLine)
      .filter(Boolean)
      .join("\n");
    openclashText = String(body.openclash || "")
      .split(/\r?\n/)
      .slice(-120)
      .map(sanitizeLogLine)
      .filter(Boolean)
      .join("\n");
  } else {
    const stored = await env.KV.get<StoredIngestLogs>(KV_LOGS_KEY, "json");
    if (stored) {
      openwrtText = (stored.openwrt || []).slice(-100).join("\n");
      openclashText = (stored.openclash || []).slice(-100).join("\n");
    }
  }

  const deviceSummary = await readDeviceSummary(env);
  if (!openwrtText && !openclashText && !deviceSummary) {
    return err(400, "暂无可供分析的日志或监控数据，请先粘贴日志或等待采集器上报");
  }

  const sections: string[] = [];
  if (deviceSummary) sections.push(`【当前设备监控与告警摘要】\n${deviceSummary}`);
  if (openwrtText) sections.push(`【OpenWrt 系统日志】\n${openwrtText.slice(0, 4000)}`);
  if (openclashText) sections.push(`【OpenClash 日志】\n${openclashText.slice(0, 4000)}`);
  if (question) sections.push(`【用户补充问题】\n${question}`);

  const messages = [
    {
      role: "system",
      content:
        "你是一位精通 OpenWrt (FanchmWrt)、Linux 网络栈与 OpenClash (Mihomo/Clash Meta) 的资深网络运维工程师。" +
        "请根据提供的设备监控指标、OpenWrt 日志与 OpenClash 日志，用简体中文输出清晰、可落地的诊断报告，包含：\n" +
        "1. **整体健康与核心结论**（1-2 句话直击问题或确认正常）\n" +
        "2. **异常点与根因分析**（逐条列出发现的报错、DNS/Fake-IP/TUN/拨号/节点超时/内存或连接数异常）\n" +
        "3. **具体排查与修复建议**（给出明确的 LuCI 菜单或 OpenClash 配置操作步骤）\n" +
        "注意：不要编造日志中不存在的报错；若日志不足以定位，明确指出还需补充哪类日志。",
    },
    {
      role: "user",
      content: sections.join("\n\n"),
    },
  ];

  let usedModel = requestedModel;
  let resultText = "";
  try {
    const out = await env.AI.run(requestedModel, { messages, max_tokens: 1024, temperature: 0.3 });
    resultText = extractAiText(out);
  } catch (e1) {
    try {
      usedModel = MODEL_FALLBACK;
      const out2 = await env.AI.run(MODEL_FALLBACK, { messages, max_tokens: 1024, temperature: 0.3 });
      resultText = extractAiText(out2);
    } catch (e2) {
      const msg = (e2 as Error).message || (e1 as Error).message || "Workers AI 调用失败";
      return err(502, `Workers AI 调用失败：${msg}（本地 dev 需先执行 npx wrangler login 并连接 Cloudflare）`);
    }
  }

  return json({
    ok: true,
    model: usedModel,
    mode,
    analyzedAt: Date.now(),
    report: resultText,
  });
}
