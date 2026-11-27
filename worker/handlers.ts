/* API 处理器集合（由 Pages Functions 迁移为单入口 Worker） */
import {
  Env,
  USERNAME_RE,
  ensureUsersTable,
  err,
  hashPassword,
  json,
  rateLimited,
  requireAdmin,
  requireCollector,
  signCollectorToken,
  signSession,
  verifyAccountCredentials,
} from "./_shared";
import { saveIngestedLogs } from "./ai";

/* ---------- /api/login ---------- */
const COOKIE = "nav_session";

function isHttpsReq(req: Request): boolean {
  try {
    if (new URL(req.url).protocol === "https:") return true;
  } catch { /* ignore */ }
  return req.headers.get("x-forwarded-proto") === "https";
}

export async function login(req: Request, env: Env): Promise<Response> {
  if (await rateLimited(env, req, "rl:login", 8)) {
    return err(429, "尝试过于频繁，请 15 分钟后再试");
  }
  let username = "";
  let password = "";
  try {
    const body = (await requestJson(req)) as { username?: string; password?: string };
    username = String(body.username || "").trim();
    password = String(body.password || "");
  } catch {
    return err(400, "请求格式错误");
  }
  if (!username || !password) return err(400, "请输入账号和密码");
  const auth = await verifyAccountCredentials(env, username, password);
  if (auth.uninitialized) return err(503, "尚未初始化账号凭据（请配置 USERNAME / PASSWORD 或 D1 users 表）");
  if (!auth.ok || !auth.user) return err(401, "账号或密码错误");
  const token = await signSession(env, auth.user);
  const sec = isHttpsReq(req) ? " Secure;" : "";
  return json({ ok: true, username: auth.user.username, role: auth.user.role }, 200, {
    "set-cookie": `${COOKIE}=${token}; HttpOnly;${sec} Path=/; SameSite=Lax; Max-Age=${7 * 86400}`,
  });
}

/* ---------- /api/collector/login（采集器账号密码换取 Bearer JWT） ---------- */
export async function collectorLogin(req: Request, env: Env): Promise<Response> {
  if (await rateLimited(env, req, "rl:clogin", 20)) {
    return err(429, "尝试过于频繁，请稍后再试");
  }
  let username = "";
  let password = "";
  try {
    const body = (await requestJson(req)) as { username?: string; password?: string };
    username = String(body.username || "").trim();
    password = String(body.password || "");
  } catch {
    return err(400, "请求格式错误");
  }
  if (!username || !password) return err(400, "请输入采集器账号和密码");
  const auth = await verifyAccountCredentials(env, username, password);
  if (auth.uninitialized) return err(503, "云端尚未初始化账号凭据");
  if (!auth.ok || !auth.user) return err(401, "账号或密码错误");
  const ttlHours = 24;
  const token = await signCollectorToken(env, auth.user, ttlHours);
  return json({ ok: true, token, expires_in: ttlHours * 3600, username: auth.user.username });
}

/* ---------- /api/logout ---------- */
export async function logout(req?: Request): Promise<Response> {
  const sec = req && isHttpsReq(req) ? " Secure;" : "";
  return json({ ok: true }, 200, {
    "set-cookie": `nav_session=; HttpOnly;${sec} Path=/; SameSite=Lax; Max-Age=0`,
  });
}

/* ---------- /api/session ---------- */
export async function session(req: Request, env: Env): Promise<Response> {
  const { authed, username, role } = await requireAdmin(req, env);
  let collectorConfigured = false;
  try {
    const row = await env.DB.prepare("SELECT MAX(updated_at) AS latest FROM latest").first<{ latest: number | null }>();
    collectorConfigured = !!row?.latest && Date.now() - row.latest < 86400_000;
  } catch {
    collectorConfigured = false;
  }
  return json({ authenticated: authed, username: username || null, role: role || null, collectorConfigured });
}

/* ---------- /api/account（修改当前账号名或密码，并轮换 token_version） ---------- */
export async function updateAccount(req: Request, env: Env): Promise<Response> {
  const { authed, username } = await requireAdmin(req, env);
  if (!authed || !username) return err(401, "未登录");
  if (await rateLimited(env, req, "rl:pw", 5)) return err(429, "操作过于频繁");

  let currentPassword = "";
  let newUsername = "";
  let newPassword = "";
  try {
    const body = (await requestJson(req)) as { currentPassword?: string; newUsername?: string; newPassword?: string };
    currentPassword = String(body.currentPassword || "");
    newUsername = String(body.newUsername || "").trim();
    newPassword = String(body.newPassword || "");
  } catch {
    return err(400, "请求格式错误");
  }
  if (!currentPassword) return err(400, "请输入当前密码");
  if (!newUsername && !newPassword) return err(400, "请填写需要修改的新账号或新密码");
  if (newUsername && !USERNAME_RE.test(newUsername)) {
    return err(400, "账号名需为 2-32 位字母、数字或 . _ -");
  }
  if (newPassword && newPassword.length < 6) {
    return err(400, "新密码至少 6 位");
  }

  const verified = await verifyAccountCredentials(env, username, currentPassword);
  if (!verified.ok || !verified.user) return err(401, "当前密码错误");

  await ensureUsersTable(env);
  const nextUsername = newUsername || verified.user.username;
  if (nextUsername !== verified.user.username) {
    const dup = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(nextUsername).first<{ id: number }>();
    if (dup) return err(409, "该账号名已存在");
  }

  const now = Date.now();
  const nextVer = (verified.user.token_version || 1) + 1;
  if (newPassword) {
    const hash = await hashPassword(newPassword);
    await env.DB.prepare("UPDATE users SET username = ?, password_hash = ?, token_version = ?, updated_at = ? WHERE username = ?")
      .bind(nextUsername, hash, nextVer, now, verified.user.username)
      .run();
  } else {
    await env.DB.prepare("UPDATE users SET username = ?, token_version = ?, updated_at = ? WHERE username = ?")
      .bind(nextUsername, nextVer, now, verified.user.username)
      .run();
  }

  const nextUser = { username: nextUsername, role: verified.user.role, token_version: nextVer };
  const token = await signSession(env, nextUser);
  const sec = isHttpsReq(req) ? " Secure;" : "";
  return json({ ok: true, username: nextUsername }, 200, {
    "set-cookie": `${COOKIE}=${token}; HttpOnly;${sec} Path=/; SameSite=Lax; Max-Age=${7 * 86400}`,
  });
}

/* ---------- /api/config ---------- */
interface NavConfigLike {
  version: number;
  site: Record<string, unknown>;
  privacy: { publicNav: boolean };
  search: unknown;
  groups: unknown;
  monitor: unknown;
  widgets?: unknown; // 组件区布局 {id,type,span}[]
}

const CONFIG_KEY = "config";

function isSafeHttpUrl(u: unknown): boolean {
  return typeof u === "string" && /^https?:\/\//i.test(u.trim());
}

function validateServiceUrls(s: Record<string, unknown>): boolean {
  if (Array.isArray(s.children)) {
    return (s.children as Record<string, unknown>[]).every(validateServiceUrls);
  }
  if (s.url && !isSafeHttpUrl(s.url)) return false;
  if (typeof s.icon === "string" && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s.icon)) {
    if (!/^(https?:|data:image\/|brand:)/i.test(s.icon)) return false;
  }
  return true;
}

function basicValid(c: NavConfigLike): boolean {
  if (!c || typeof c !== "object" || !Array.isArray(c.groups) || !c.site || !c.search || !c.monitor || !c.privacy) {
    return false;
  }
  for (const g of c.groups as { services?: unknown[] }[]) {
    if (!g || !Array.isArray(g.services)) return false;
    for (const s of g.services) {
      if (!s || typeof s !== "object" || !validateServiceUrls(s as Record<string, unknown>)) return false;
    }
  }
  const search = c.search as { engines?: { url?: unknown }[] };
  if (Array.isArray(search.engines)) {
    for (const eng of search.engines) {
      if (eng?.url && !isSafeHttpUrl(eng.url)) return false;
    }
  }
  const wp = c.site.wallpaper;
  if (typeof wp === "string" && wp.includes(":") && !isSafeHttpUrl(wp)) return false;
  return true;
}

/** 匿名访客可见的配置投影：只保留渲染导航所需字段，剔除一切密钥与内网探活目标。
 *  - site.weather 去掉 qweatherHost / qweatherKey（Key 仅 Worker 侧读取）
 *  - groups[].services[].check 整个剔除（host/port 是内网拓扑）
 *  - monitor 整段剔除（含 bark.key / telegram.token / webhook.url 等通知密钥）
 *  authenticated 时返回完整 config，管理端行为不变。 */
function publicConfigView(config: NavConfigLike): NavConfigLike {
  const site = (config.site || {}) as Record<string, unknown>;
  const weather = (site.weather || {}) as Record<string, unknown>;
  const safeWeather: Record<string, unknown> = {};
  for (const k of ["enabled", "city", "provider"]) {
    if (k in weather) safeWeather[k] = weather[k];
  }
  // 递归剥离 check（内网探活目标 host/port），文件夹 children 一并处理
  const stripChecks = (s: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...s };
    delete out.check;
    if (Array.isArray(out.children)) {
      out.children = (out.children as Record<string, unknown>[]).map(stripChecks);
    }
    return out;
  };
  const groups = Array.isArray(config.groups)
    ? (config.groups as { services?: unknown[] }[]).map((g) => ({
        ...g,
        services: Array.isArray(g.services)
          ? g.services.map((s) => stripChecks(s as Record<string, unknown>))
          : g.services,
      }))
    : config.groups;

  return {
    version: config.version,
    site: { ...site, weather: safeWeather } as Record<string, unknown>,
    privacy: config.privacy,
    search: config.search,
    groups,
    // widgets 仅含 {id,type,span} 布局信息、无敏感数据，保留以免匿名访客看到与登录态不一致的组件区
    widgets: config.widgets,
    monitor: null, // 匿名客户端无需监控阈值/告警密钥；store.tsx 会用 defaultConfig 补齐
  } as NavConfigLike;
}

export async function getConfig(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  const raw = await env.KV.get(CONFIG_KEY);
  const config = raw ? (JSON.parse(raw) as NavConfigLike) : null;
  if (!authed && config && !config.privacy.publicNav) {
    return err(401, "站点为私有");
  }
  return json({ config: authed ? config : config ? publicConfigView(config) : config, authenticated: authed });
}

export async function putConfig(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  let body: { config?: NavConfigLike };
  try {
    body = (await requestJson(req)) as { config?: NavConfigLike };
  } catch {
    return err(400, "请求格式错误");
  }
  const config = body.config;
  if (!config || !basicValid(config)) return err(400, "配置格式不符");
  if (JSON.stringify(config).length > 256 * 1024) return err(413, "配置过大");
  const prev = await env.KV.get(CONFIG_KEY);
  const version = prev ? ((JSON.parse(prev) as NavConfigLike).version || 0) + 1 : Date.now();
  const next = { ...config, version };
  await env.KV.put(CONFIG_KEY, JSON.stringify(next));
  return json({ ok: true, version });
}

/* ---------- /api/collector-config ---------- */
export async function collectorConfig(req: Request, env: Env): Promise<Response> {
  if (!(await requireCollector(req, env))) return err(401, "无效凭据");
  const raw = await env.KV.get(CONFIG_KEY);
  if (!raw) return json({ config_version: 0, checks: [], thresholds: null });
  const cfg = JSON.parse(raw) as {
    version: number;
    monitor: { thresholds: Record<string, number> };
    groups: { services: { name: string; check?: { host: string; port: number } }[] }[];
  };
  const checks: { name: string; type: "tcp"; host: string; port: number }[] = [];
  for (const g of cfg.groups || []) {
    for (const s of g.services || []) {
      if (s.check && s.check.host && s.check.port) {
        checks.push({ name: s.name, type: "tcp", host: s.check.host, port: s.check.port });
      }
    }
  }
  return json({ config_version: cfg.version || 0, checks, thresholds: cfg.monitor?.thresholds ?? null });
}

/* ---------- /api/ingest ---------- */
export async function ingest(req: Request, env: Env): Promise<Response> {
  if (!(await requireCollector(req, env))) return err(401, "无效凭据");
  const cl = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(cl) && cl > 256 * 1024) return err(413, "快照过大");

  let snap: {
    ts: number;
    source?: string;
    devices?: {
      id: string; name: string; kind?: string; status?: string;
      cpu?: number; mem?: number; load1?: number; temp?: number; uptime_s?: number;
      version?: string; connections?: number; internet?: boolean;
      disks?: { mount: string; used_pct: number; total_gb: number }[];
      traffic?: { iface?: string; rx_bps?: number; tx_bps?: number; rx_total?: number; tx_total?: number };
      spark?: number[]; // 最近 N 点下行速率（与 Go metrics.go 的 DeviceSample.spark 对应）
    }[];
    services?: { name: string; status?: string; latency_ms?: number; fails?: number }[];
    alerts?: { id: string; device: string; rule: string; severity: string; message: string; first_seen: number; last_seen: number }[];
    resolved_alert_ids?: string[];
    logs?: { openwrt?: unknown; openclash?: unknown; nas?: unknown };
  };
  try {
    const rawText = await req.text();
    if (rawText.length > 256 * 1024) return err(413, "快照过大");
    snap = JSON.parse(rawText);
  } catch {
    return err(400, "JSON 解析失败");
  }
  const ts = Math.floor((snap.ts || Date.now()) / 1000);
  // 采集器时钟漂移保护：偏差超过 5 分钟按服务端时间入库
  const now = Math.floor(Date.now() / 1000);
  const tsSafe = Math.abs(now - ts) > 300 ? now : ts;
  const source = typeof snap.source === "string" && /^[\w.-]{1,32}$/.test(snap.source) ? snap.source : "nas";
  const devices = Array.isArray(snap.devices) ? snap.devices.slice(0, 20) : [];

  const stmts: D1PreparedStatement[] = [];
  const snapshotJson = JSON.stringify({ ts: tsSafe * 1000, source, devices: devices, services: snap.services || [], alerts: snap.alerts || [] });

  stmts.push(
    env.DB.prepare(
      "INSERT INTO latest (source, updated_at, snapshot) VALUES (?, ?, ?) ON CONFLICT (source) DO UPDATE SET updated_at = excluded.updated_at, snapshot = excluded.snapshot",
    ).bind(source, tsSafe * 1000, snapshotJson),
  );
  if (snap.logs) {
    await saveIngestedLogs(env, source, tsSafe * 1000, snap.logs);
  }

  for (const d of devices) {
    const worstDisk = d.disks && d.disks.length ? Math.max(...d.disks.map((x) => x.used_pct)) : null;
    stmts.push(
      env.DB.prepare(
        "INSERT INTO samples (ts, device, cpu, mem, disk, load1, temp, rx_bps, tx_bps, conn, status, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        tsSafe, d.id || "unknown", d.cpu ?? null, d.mem ?? null, worstDisk, d.load1 ?? null, d.temp ?? null,
        d.traffic?.rx_bps ?? null, d.traffic?.tx_bps ?? null, d.connections ?? null, d.status || "online",
        d.traffic?.iface ?? null,
      ),
    );
  }

  for (const a of (snap.alerts || []).slice(0, 100)) {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO alerts (id, device, rule, severity, message, first_seen, last_seen, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL) " +
          "ON CONFLICT (id) DO UPDATE SET last_seen = excluded.last_seen, message = excluded.message, severity = excluded.severity",
      ).bind(a.id, a.device, a.rule, a.severity === "critical" ? "critical" : "warn", a.message, Math.floor(a.first_seen / 1000), Math.floor(a.last_seen / 1000)),
    );
  }
  for (const id of (snap.resolved_alert_ids || []).slice(0, 100)) {
    stmts.push(
      env.DB.prepare("UPDATE alerts SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL").bind(tsSafe, id),
    );
  }

  try {
    await env.DB.batch(stmts);
  } catch (e) {
    console.error("d1 batch failed", e);
    return err(500, "写入失败");
  }

  let configVersion = 0;
  try {
    const raw = await env.KV.get(CONFIG_KEY);
    if (raw) configVersion = (JSON.parse(raw) as { version?: number }).version || 0;
  } catch { /* ignore */ }

  return json({ ok: true, config_version: configVersion });
}

/* ---------- /api/latest ---------- */
interface SourceRow {
  source: string;
  updated_at: number;
  snapshot: string;
}

const STALE_MS = 120_000;

export async function latest(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const rows = await env.DB.prepare("SELECT source, updated_at, snapshot FROM latest ORDER BY updated_at DESC").all<SourceRow>();
  const list = rows.results || [];
  if (list.length === 0) return err(404, "尚无数据");

  const now = Date.now();
  const sources = list.map((r) => ({
    id: r.source,
    updated_at: r.updated_at,
    stale: now - r.updated_at > STALE_MS,
  }));

  const devices: Record<string, unknown>[] = [];
  const seenDev = new Set<string>();
  const services: Record<string, unknown>[] = [];
  const seenSvc = new Set<string>();
  const alerts: Record<string, unknown>[] = [];
  const seenAlert = new Set<string>();
  let maxTs = 0;

  for (const r of list) {
    const stale = now - r.updated_at > STALE_MS;
    let snap: SnapPart;
    try {
      snap = JSON.parse(r.snapshot) as SnapPart;
    } catch {
      continue;
    }
    maxTs = Math.max(maxTs, r.updated_at);
    for (const d of snap.devices || []) {
      const id = String((d as { id?: string }).id || "");
      if (!id || seenDev.has(id)) continue;
      seenDev.add(id);
      devices.push({ ...d, stale });
    }
    for (const s of snap.services || []) {
      const name = String((s as { name?: string }).name || "");
      if (!name || seenSvc.has(name)) continue;
      seenSvc.add(name);
      services.push(s);
    }
    for (const a of snap.alerts || []) {
      const id = String((a as { id?: string }).id || "");
      if (!id || seenAlert.has(id)) continue;
      seenAlert.add(id);
      alerts.push(a);
    }
  }

  return json({
    ts: maxTs,
    devices,
    services,
    alerts,
    sources,
    stale: sources.every((s) => s.stale),
  });
}

interface SnapPart {
  ts: number;
  source?: string;
  devices?: Record<string, unknown>[];
  services?: Record<string, unknown>[];
  alerts?: Record<string, unknown>[];
}

/* ---------- /api/history ---------- */
const BUCKETS: Record<string, { bucket_s: number; window_s: number }> = {
  "24h": { bucket_s: 300, window_s: 86400 },
  "7d": { bucket_s: 1800, window_s: 7 * 86400 },
  "30d": { bucket_s: 7200, window_s: 30 * 86400 },
};

interface Row {
  bucket: number;
  rx_avg: number | null;
  rx_max: number | null;
  tx_avg: number | null;
  tx_max: number | null;
  conn_avg: number | null;
  conn_max: number | null;
}

interface DayRow {
  d: number;
  gb: number | null; // rx 日流量 GB
  tb: number | null; // tx 日流量 GB
}

export async function history(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");

  const url = new URL(req.url);
  const device = url.searchParams.get("device") || "";
  const range = url.searchParams.get("range") || "24h";
  const cfg = BUCKETS[range];
  if (!cfg || !device || !/^[\w.-]{1,64}$/.test(device)) return err(400, "参数错误");

  const now = Math.floor(Date.now() / 1000);
  const since = now - cfg.window_s;
  const b = cfg.bucket_s;

  const agg = await env.DB.prepare(
    "SELECT (ts / ?) * ? AS bucket, AVG(rx_bps) AS rx_avg, MAX(rx_bps) AS rx_max, AVG(tx_bps) AS tx_avg, MAX(tx_bps) AS tx_max, AVG(conn) AS conn_avg, MAX(conn) AS conn_max " +
      "FROM samples WHERE device = ? AND ts > ? GROUP BY bucket ORDER BY bucket",
  )
    .bind(b, b, device, since)
    .all<Row>();

  // 日流量：不能硬编码 60 秒采样间隔（采集器 interval 可配 60/120s，云端拿不到该值）。
  // 用相邻样本的 ts 差推断每个样本代表的实际时长；末尾样本用前一间隔，孤点回退 60；
  // clamp 到 1..600 秒，避免断网后的超长间隔把日流量算爆。rx/tx 一次查出，少一次 D1 往返。
  const dailyRows = await env.DB.prepare(
    "WITH g AS (" +
      "SELECT ts, rx_bps, tx_bps, " +
      "LEAD(ts) OVER w - ts AS next_gap, ts - LAG(ts) OVER w AS prev_gap " +
      "FROM samples WHERE device = ? AND ts > ? WINDOW w AS (PARTITION BY device ORDER BY ts)" +
    ") " +
      "SELECT (ts / 86400) AS d, " +
      "SUM(rx_bps * MAX(1, MIN(COALESCE(next_gap, prev_gap, 60), 600))) / 1e9 AS gb, " +
      "SUM(tx_bps * MAX(1, MIN(COALESCE(next_gap, prev_gap, 60), 600))) / 1e9 AS tb " +
      "FROM g GROUP BY d ORDER BY d",
  )
    .bind(device, since)
    .all<DayRow>();

  const points = agg.results.map((r) => ({
    ts: r.bucket * 1000,
    rx_avg: r.rx_avg ?? 0,
    rx_max: r.rx_max ?? 0,
    tx_avg: r.tx_avg ?? 0,
    tx_max: r.tx_max ?? 0,
    conn_avg: r.conn_avg ?? undefined,
    conn_max: r.conn_max ?? undefined,
  }));

  const days = dailyRows.results.map((r) => ({
    day: new Date(r.d * 86400 * 1000).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
    rx_gb: +(r.gb ?? 0).toFixed(2),
    tx_gb: +(r.tb ?? 0).toFixed(2),
  }));

  return json({ device, range, bucket_s: b, points, daily: days });
}

/* ---------- /api/weather（Worker 代理：和风天气优先，Open-Meteo 兜底；国内浏览器直连均不可达） ---------- */
interface WeatherResp {
  city: string;
  temp: number;
  code: number; // 统一为 WMO weather code，前端图标映射不变
  dailyMax: number;
  dailyMin: number;
  fetchedAt: number;
  source?: "qweather" | "open-meteo";
}

export async function weather(env: Env, city: string): Promise<Response> {
  // 天气 Key 优先从 Worker Secret 读取（不进 KV、不出现在 /api/config 或日志）；
  // 未配置 Secret 时回退 KV config，兼容现有 UI 配置路径。旧配置无 provider → Open-Meteo 兜底。
  let provider: "open-meteo" | "qweather" = "open-meteo";
  let qhHost = "";
  let qhKey = "";
  if (env.QWEATHER_KEY && env.QWEATHER_HOST) {
    provider = "qweather";
    qhHost = env.QWEATHER_HOST.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    qhKey = env.QWEATHER_KEY;
  } else {
    try {
      const raw = await env.KV.get(CONFIG_KEY);
      const w = raw ? (JSON.parse(raw) as { site?: { weather?: Record<string, string> } }).site?.weather : null;
      if (w?.provider === "qweather" && w.qweatherHost && w.qweatherKey) {
        provider = "qweather";
        qhHost = w.qweatherHost.replace(/^https?:\/\//, "").replace(/\/+$/, "");
        qhKey = w.qweatherKey;
      }
    } catch { /* 配置解析失败 → 兜底 */ }
  }

  const cacheKey = `weather:${provider}:${city}`;
  const cached = await env.KV.get<WeatherResp>(cacheKey, "json");
  if (cached) return json(cached);

  let out: WeatherResp | null = null;
  if (provider === "qweather") {
    out = await fetchQWeather(qhHost, qhKey, city); // 失败时内部返回 null，落到 Open-Meteo
  }
  if (!out) out = await fetchOpenMeteo(city);
  if (!out) return err(502, "天气服务不可用");

  // KV 缓存 30 分钟（免费额度友好 + 多访客共享；expirationTtl 最低 60s）
  await env.KV.put(cacheKey, JSON.stringify(out), { expirationTtl: 1800 });
  return json(out);
}

/** Open-Meteo（免密钥）：地理编码 + 当前天气 + 今日高低温 */
async function fetchOpenMeteo(city: string): Promise<WeatherResp | null> {
  const geoUrl =
    "https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=" +
    encodeURIComponent(city);
  const geoRes = await fetch(geoUrl, { headers: { "user-agent": "nav-worker" } });
  if (!geoRes.ok) return null;
  const geo = (await geoRes.json()) as {
    results?: { latitude: number; longitude: number; name: string }[];
  };
  const hit = geo.results?.[0];
  if (!hit) return null;

  const fcUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
    "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto";
  const fcRes = await fetch(fcUrl, { headers: { "user-agent": "nav-worker" } });
  if (!fcRes.ok) return null;
  const fc = (await fcRes.json()) as {
    current?: { temperature_2m: number; weather_code: number };
    daily?: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  };
  if (!fc.current) return null;

  return {
    city: hit.name || city,
    temp: Math.round(fc.current.temperature_2m),
    code: fc.current.weather_code,
    dailyMax: Math.round(fc.daily?.temperature_2m_max?.[0] ?? fc.current.temperature_2m),
    dailyMin: Math.round(fc.daily?.temperature_2m_min?.[0] ?? fc.current.temperature_2m),
    fetchedAt: Date.now(),
    source: "open-meteo",
  };
}

/** 和风天气 QWeather（专属 API Host + Key）：GeoAPI 城市查询 → 实时 + 3日预报 */
async function fetchQWeather(host: string, key: string, city: string): Promise<WeatherResp | null> {
  const base = `https://${host}`;
  const common = { headers: { "user-agent": "nav-worker" } };

  const lookupRes = await fetch(
    `${base}/v2/city/lookup?location=${encodeURIComponent(city)}&lang=zh&key=${key}`,
    common,
  );
  if (!lookupRes.ok) return null;
  const lookup = (await lookupRes.json()) as {
    code?: string; location?: { id: string; name: string }[];
  };
  const loc = lookup.code === "200" ? lookup.location?.[0] : undefined;
  if (!loc) return null;

  const [nowRes, d3Res] = await Promise.all([
    fetch(`${base}/v7/weather/now?location=${loc.id}&key=${key}`, common),
    fetch(`${base}/v7/weather/3d?location=${loc.id}&key=${key}`, common),
  ]);
  if (!nowRes.ok || !d3Res.ok) return null;
  const now = (await nowRes.json()) as { code?: string; now?: { temp: string; icon: string } };
  const d3 = (await d3Res.json()) as { code?: string; daily?: { tempMax: string; tempMin: string }[] };
  if (now.code !== "200" || !now.now) return null;

  const temp = Number(now.now.temp);
  if (!Number.isFinite(temp)) return null;
  const today = d3.code === "200" ? d3.daily?.[0] : undefined;

  return {
    city: loc.name || city,
    temp: Math.round(temp),
    code: qweatherToWmo(now.now.icon),
    dailyMax: today ? Math.round(Number(today.tempMax) || temp) : Math.round(temp),
    dailyMin: today ? Math.round(Number(today.tempMin) || temp) : Math.round(temp),
    fetchedAt: Date.now(),
    source: "qweather",
  };
}

/** 和风天气现象 code → WMO weather code（前端 weatherInfo 图标映射不变） */
function qweatherToWmo(code: string): number {
  const map: Record<string, number> = {
    "100": 0, "150": 0, // 晴
    "101": 3, "102": 2, "103": 2, "104": 3, // 多云/阴
    "300": 80, "301": 81, "302": 95, "303": 97, "304": 99, // 阵雨/雷
    "305": 61, "306": 63, "307": 65, "308": 65, "309": 51, "310": 65,
    "311": 65, "312": 65, "313": 65, "314": 65, "315": 65,
    "316": 67, "317": 67, "318": 67, "399": 61, // 雨夹雪/雨
    "350": 80, "351": 80, "352": 80, "353": 80, "354": 81, "355": 82,
    "356": 82, "357": 82, "358": 82, "359": 81, "360": 81, "361": 82,
    "362": 82, "363": 82, "364": 82, "365": 82, // 阵雨变体
    "400": 71, "401": 73, "402": 75, "403": 75, "404": 67, "405": 67, "406": 67,
    "407": 75, "408": 75, "409": 75, "410": 75, "456": 67, "499": 71, // 雪
    "500": 45, "501": 45, "502": 45, "503": 45, "504": 45, "507": 45, "508": 45, // 雾/霾/沙尘
    "900": 0, "901": 0, // 热/冷
  };
  return map[code] ?? 3; // 未知 → 多云
}

/* ---------- /api/hotsearch ---------- */
export type HotsearchSource = "baidu" | "weibo" | "zhihu" | "bilibili";

export interface HotsearchItem {
  rank: number;
  title: string;
  url: string;
  hot?: string | number;
}

export interface HotsearchResp {
  source: HotsearchSource;
  updated_at: number;
  fallback: boolean;
  items: HotsearchItem[];
}

const HOTSEARCH_SOURCES = new Set<string>(["baidu", "weibo", "zhihu", "bilibili"]);

export function isHotsearchSource(s: string): s is HotsearchSource {
  return HOTSEARCH_SOURCES.has(s);
}

const HOTSEARCH_FALLBACK: Record<HotsearchSource, HotsearchItem[]> = {
  baidu: [
    { rank: 1, title: "人工智能大模型开源生态加速演进", url: "https://www.baidu.com/s?wd=人工智能大模型开源生态", hot: "498万" },
    { rank: 2, title: "新一代国产芯片架构性能公布", url: "https://www.baidu.com/s?wd=新一代国产芯片架构", hot: "452万" },
    { rank: 3, title: "多地推出数字经济高质量发展新举措", url: "https://www.baidu.com/s?wd=数字经济高质量发展", hot: "410万" },
    { rank: 4, title: "新能源汽车充电基础设施持续完善", url: "https://www.baidu.com/s?wd=新能源汽车充电基础设施", hot: "376万" },
    { rank: 5, title: "全球开发者大会聚焦端侧智能应用", url: "https://www.baidu.com/s?wd=端侧智能应用", hot: "341万" },
    { rank: 6, title: "云计算边缘节点部署规模再创新高", url: "https://www.baidu.com/s?wd=云计算边缘节点", hot: "298万" },
    { rank: 7, title: "家庭 NAS 私有云存储方案成热门选择", url: "https://www.baidu.com/s?wd=家庭NAS私有云", hot: "265万" },
    { rank: 8, title: "开源浏览器引擎安全更新发布", url: "https://www.baidu.com/s?wd=浏览器引擎安全更新", hot: "230万" },
  ],
  weibo: [
    { rank: 1, title: "AI 编程助手效率提升讨论", url: "https://s.weibo.com/weibo?q=AI编程助手", hot: 2154000 },
    { rank: 2, title: "今日全国多地迎来晴好天气", url: "https://s.weibo.com/weibo?q=全国晴好天气", hot: 1842000 },
    { rank: 3, title: "智能家居全屋联动体验分享", url: "https://s.weibo.com/weibo?q=智能家居全屋联动", hot: 1523000 },
    { rank: 4, title: "开源社区年度最受欢迎项目榜单", url: "https://s.weibo.com/weibo?q=开源社区年度项目", hot: 1290000 },
    { rank: 5, title: "国产独立游戏出海斩获多项大奖", url: "https://s.weibo.com/weibo?q=国产独立游戏出海", hot: 1085000 },
    { rank: 6, title: "高速铁路新线路联调联试顺利推进", url: "https://s.weibo.com/weibo?q=高铁新线路", hot: 924000 },
    { rank: 7, title: "极简桌面搭建与效率工具推荐", url: "https://s.weibo.com/weibo?q=极简桌面搭建", hot: 781000 },
    { rank: 8, title: "周末城市漫步打卡路线合集", url: "https://s.weibo.com/weibo?q=城市漫步路线", hot: 643000 },
  ],
  zhihu: [
    { rank: 1, title: "如何评价当前端侧 AI 与本地知识库的发展趋势？", url: "https://www.zhihu.com/search?q=端侧AI本地知识库", hot: "1420万热度" },
    { rank: 2, title: "自建 Homelab 和 NAS 有哪些值得推荐的开源服务？", url: "https://www.zhihu.com/search?q=Homelab+NAS+开源服务", hot: "980万热度" },
    { rank: 3, title: "为什么越来越多人开始使用极简起始页和个人导航？", url: "https://www.zhihu.com/search?q=极简起始页", hot: "760万热度" },
    { rank: 4, title: "现代前端工程化在 2026 年有哪些关键变化？", url: "https://www.zhihu.com/search?q=前端工程化", hot: "615万热度" },
    { rank: 5, title: "边缘计算（Serverless Workers）适合承担哪些个人项目？", url: "https://www.zhihu.com/search?q=Serverless+Workers", hot: "530万热度" },
    { rank: 6, title: "有哪些相见恨晚的效率提升习惯或工具？", url: "https://www.zhihu.com/search?q=效率工具", hot: "448万热度" },
    { rank: 7, title: "家庭网络万兆升级有哪些实用避坑指南？", url: "https://www.zhihu.com/search?q=万兆家庭网络", hot: "372万热度" },
    { rank: 8, title: "如何设计一套既美观又实用的数据监控面板？", url: "https://www.zhihu.com/search?q=数据监控面板", hot: "295万热度" },
  ],
  bilibili: [
    { rank: 1, title: "【极客向】从零搭建全栈个人导航与服务器监控面板", url: "https://search.bilibili.com/all?keyword=个人导航监控面板", hot: "186.4万" },
    { rank: 2, title: "2026 年最值得部署的 10 个 Docker 开源神器", url: "https://search.bilibili.com/all?keyword=Docker开源神器", hot: "142.8万" },
    { rank: 3, title: "家庭 NAS 折腾指南：媒体库与自动化备份全流程", url: "https://search.bilibili.com/all?keyword=NAS媒体库", hot: "118.5万" },
    { rank: 4, title: "手搓桌面级迷你主机，静音与性能全都要！", url: "https://search.bilibili.com/all?keyword=迷你主机", hot: "95.2万" },
    { rank: 5, title: "AI 工作流实战：用本地大模型打造个人效率助理", url: "https://search.bilibili.com/all?keyword=AI工作流", hot: "83.6万" },
    { rank: 6, title: "软路由进阶玩法：流量监控与多线分流配置", url: "https://search.bilibili.com/all?keyword=软路由流量监控", hot: "71.9万" },
    { rank: 7, title: "极简主义桌面改造：让工作空间回归纯粹", url: "https://search.bilibili.com/all?keyword=极简桌面改造", hot: "64.3万" },
    { rank: 8, title: "程序员的周末：48 小时极限开发一个开源小工具", url: "https://search.bilibili.com/all?keyword=极限开发开源工具", hot: "52.1万" },
  ],
};

async function fetchJsonWithTimeout<T>(url: string, headers: Record<string, string>, timeoutMs = 4000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHotsearchUpstream(source: HotsearchSource): Promise<HotsearchItem[] | null> {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  if (source === "baidu") {
    const data = await fetchJsonWithTimeout<{
      data?: { cards?: { content?: { word?: string; url?: string; rawUrl?: string; hotScore?: string | number }[] }[] };
    }>("https://top.baidu.com/api/board?platform=wise&tab=realtime", { "user-agent": ua });
    const list = data?.data?.cards?.[0]?.content;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list
      .filter((x) => x.word)
      .slice(0, 20)
      .map((x, i) => ({
        rank: i + 1,
        title: String(x.word),
        url: x.rawUrl || x.url || `https://www.baidu.com/s?wd=${encodeURIComponent(String(x.word))}`,
        hot: x.hotScore,
      }));
  }
  if (source === "weibo") {
    const data = await fetchJsonWithTimeout<{
      data?: { realtime?: { word?: string; note?: string; num?: number; raw_hot?: number }[] };
    }>("https://weibo.com/ajax/side/hotSearch", { "user-agent": ua, referer: "https://weibo.com/" });
    const list = data?.data?.realtime;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list
      .filter((x) => x.word || x.note)
      .slice(0, 20)
      .map((x, i) => {
        const title = String(x.note || x.word);
        return {
          rank: i + 1,
          title,
          url: `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${title}#`)}`,
          hot: x.raw_hot ?? x.num,
        };
      });
  }
  if (source === "zhihu") {
    const data = await fetchJsonWithTimeout<{
      data?: { target?: { id?: number | string; title?: string }; detail_text?: string }[];
    }>("https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=20", { "user-agent": ua });
    const list = data?.data;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list
      .filter((x) => x.target?.title)
      .slice(0, 20)
      .map((x, i) => ({
        rank: i + 1,
        title: String(x.target!.title),
        url: x.target?.id ? `https://www.zhihu.com/question/${x.target.id}` : `https://www.zhihu.com/search?q=${encodeURIComponent(String(x.target!.title))}`,
        hot: x.detail_text,
      }));
  }
  // bilibili
  const data = await fetchJsonWithTimeout<{
    data?: { list?: { title?: string; bvid?: string; stat?: { view?: number } }[] };
  }>("https://api.bilibili.com/x/web-interface/popular?ps=20&pn=1", { "user-agent": ua });
  const list = data?.data?.list;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list
    .filter((x) => x.title && x.bvid)
    .slice(0, 20)
    .map((x, i) => ({
      rank: i + 1,
      title: String(x.title),
      url: `https://www.bilibili.com/video/${x.bvid}`,
      hot: x.stat?.view,
    }));
}

export async function hotsearch(env: Env, source: HotsearchSource): Promise<Response> {
  const cacheKey = `hotsearch:${source}`;
  const cached = await env.KV.get<HotsearchResp>(cacheKey, "json");
  if (cached) return json(cached);

  const items = await fetchHotsearchUpstream(source);
  if (items && items.length > 0) {
    const out: HotsearchResp = {
      source,
      updated_at: Date.now(),
      fallback: false,
      items,
    };
    await env.KV.put(cacheKey, JSON.stringify(out), { expirationTtl: 600 });
    return json(out);
  }

  const fallbackOut: HotsearchResp = {
    source,
    updated_at: Date.now(),
    fallback: true,
    items: HOTSEARCH_FALLBACK[source],
  };
  return json(fallbackOut);
}

/* ---------- /api/alerts ---------- */
export async function alerts(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const rows = await env.DB.prepare(
    "SELECT id, device, rule, severity, message, first_seen, last_seen, resolved_at FROM alerts " +
      "ORDER BY (resolved_at IS NULL) DESC, last_seen DESC LIMIT 100",
  ).all<{
    id: string; device: string; rule: string; severity: string; message: string;
    first_seen: number; last_seen: number; resolved_at: number | null;
  }>();
  return json({
    alerts: (rows.results || []).map((r) => ({
      id: r.id, device: r.device, rule: r.rule, severity: r.severity, message: r.message,
      first_seen: r.first_seen * 1000, last_seen: r.last_seen * 1000,
      resolved_at: r.resolved_at ? r.resolved_at * 1000 : null,
    })),
  });
}

/* ---------- /api/todos（Cloudflare KV 云端多端同步） ---------- */
export interface CloudTodoItem {
  id: string;
  text: string;
  done: boolean;
  starred?: boolean;
  ts: number;
}

const KV_TODOS_KEY = "todos:data";

export async function getTodos(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const raw = await env.KV.get<{ todos?: CloudTodoItem[]; updatedAt?: number }>(KV_TODOS_KEY, "json");
  return json({
    todos: Array.isArray(raw?.todos) ? raw.todos : [],
    updatedAt: raw?.updatedAt || null,
  });
}

export async function putTodos(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  let body: { todos?: unknown };
  try {
    body = await requestJson<{ todos?: unknown }>(req);
  } catch {
    return err(400, "JSON 格式错误");
  }
  if (!Array.isArray(body.todos)) return err(400, "todos 必须是数组");
  if (body.todos.length > 200) return err(400, "最多保存 200 条待办");

  const cleaned: CloudTodoItem[] = [];
  for (const raw of body.todos) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = String(r.id || "").trim().slice(0, 64);
    const text = String(r.text || "").trim().slice(0, 255);
    if (!id || !text) continue;
    cleaned.push({
      id,
      text,
      done: Boolean(r.done),
      starred: Boolean(r.starred),
      ts: Number.isFinite(Number(r.ts)) ? Number(r.ts) : Date.now(),
    });
  }
  const updatedAt = Date.now();
  await env.KV.put(KV_TODOS_KEY, JSON.stringify({ todos: cleaned, updatedAt }));
  return json({ ok: true, todos: cleaned, updatedAt });
}

/* ---------- 公共 ---------- */
async function requestJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
