/* 共享工具：账号密码会话鉴权（JWT）、采集器凭据校验、PBKDF2 密码哈希、限速 */
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
  JWT_SECRET: string;
  // 初始管理员账号凭据（D1 users 表为空时用于首次登录引导与自动落库）
  USERNAME?: string;
  PASSWORD?: string;
  // 天气 API Key 推荐走 Secret（不进 KV、不出现在配置接口/日志）。未设置时回退 KV config 以兼容现有 UI 配置。
  QWEATHER_KEY?: string;
  QWEATHER_HOST?: string;
  // Microsoft Graph To Do OAuth 应用凭据（推荐走 Secret）
  MS_CLIENT_ID?: string;
  MS_CLIENT_SECRET?: string;
  // 可选：用于在线拉取 Cloudflare Workers AI 账号可用模型目录
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}

export interface AuthUser {
  id?: number;
  username: string;
  role: string;
  token_version: number;
}

export interface AuthResult {
  authed: boolean;
  username?: string;
  role?: string;
  payload?: Record<string, unknown>;
}

export const USERNAME_RE = /^[a-zA-Z0-9._-]{2,32}$/;

const enc = new TextEncoder();

function b64urlDecode(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/* ---------- JWT（HS256） ---------- */
async function signToken(env: Env, user: AuthUser, kind: "web" | "collector", ttlSeconds: number): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    kind,
    sub: user.username,
    role: user.role || "admin",
    ver: user.token_version || 1,
    iat: now,
    exp: now + ttlSeconds,
  };
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(env.JWT_SECRET);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

export function signSession(env: Env, user: AuthUser, days = 7): Promise<string> {
  return signToken(env, user, "web", days * 86400);
}

export function signCollectorToken(env: Env, user: AuthUser, hours = 24): Promise<string> {
  return signToken(env, user, "collector", hours * 3600);
}

let usersTableReady = false;
export async function ensureUsersTable(env: Env): Promise<void> {
  if (usersTableReady) return;
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', token_version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);",
  );
  usersTableReady = true;
}

export async function verifyJwt(env: Env, token: string, expectedKind: "web" | "collector"): Promise<AuthResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { authed: false };
  const [h, p, sig] = parts;
  const key = await hmacKey(env.JWT_SECRET);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), enc.encode(`${h}.${p}`));
  if (!ok) return { authed: false };
  let payload: { kind?: string; sub?: string; role?: string; ver?: number; exp?: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  } catch {
    return { authed: false };
  }
  if (payload.kind !== expectedKind || !payload.sub || !payload.exp || payload.exp * 1000 < Date.now()) {
    return { authed: false };
  }
  try {
    await ensureUsersTable(env);
    const row = await env.DB.prepare("SELECT token_version, role FROM users WHERE username = ?")
      .bind(payload.sub)
      .first<{ token_version: number; role: string }>();
    if (row) {
      if (Number(row.token_version) !== Number(payload.ver || 1)) return { authed: false };
      return { authed: true, username: payload.sub, role: row.role, payload };
    }
    // D1 尚未落库时（仅靠 USERNAME Secret 登录的首次场景），校验表确实为空
    const cntRow = await env.DB.prepare("SELECT COUNT(*) AS cnt FROM users").first<{ cnt: number }>();
    if ((cntRow?.cnt ?? 0) === 0 && env.USERNAME?.trim() === payload.sub) {
      return { authed: true, username: payload.sub, role: payload.role || "admin", payload };
    }
    return { authed: false };
  } catch {
    return { authed: false };
  }
}

export function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function requireAdmin(req: Request, env: Env): Promise<AuthResult> {
  const token = getCookie(req, "nav_session");
  if (!token) return { authed: false };
  return verifyJwt(env, token, "web");
}

function constTimeEqStr(a: string, b: string): boolean {
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

/** 采集器鉴权：校验 /api/collector/login 签发的 collector JWT */
export async function requireCollector(req: Request, env: Env): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const tok = m[1].trim();
  if (!tok || !tok.includes(".")) return false;
  const res = await verifyJwt(env, tok, "collector");
  return res.authed;
}

/* ---------- 密码（PBKDF2-SHA256） ---------- */
export async function hashPassword(pw: string, iterations = 100000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${iterations}$${b64urlEncode(salt)}$${b64urlEncode(bits)}`;
}

export async function verifyPbkdf2Hash(pw: string, target: string): Promise<boolean> {
  const [algo, iterStr, saltB64, hashB64] = target.split("$");
  if (algo !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
  const iter = parseInt(iterStr, 10);
  if (!Number.isFinite(iter) || iter < 10000) return false;
  const salt = b64urlDecode(saltB64);
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, key, 256);
  const want = b64urlDecode(hashB64);
  if (bits.byteLength !== want.byteLength) return false;
  let diff = 0;
  const a = new Uint8Array(bits);
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ want[i];
  return diff === 0;
}

export async function verifyAccountCredentials(
  env: Env,
  rawUsername: string,
  pw: string,
): Promise<{ ok: boolean; uninitialized?: boolean; user?: AuthUser }> {
  const username = rawUsername.trim();
  if (!username || !pw) return { ok: false };
  await ensureUsersTable(env);

  const row = await env.DB.prepare("SELECT id, username, password_hash, role, token_version FROM users WHERE username = ?")
    .bind(username)
    .first<{ id: number; username: string; password_hash: string; role: string; token_version: number }>();
  if (row) {
    const valid = await verifyPbkdf2Hash(pw, row.password_hash);
    if (!valid) return { ok: false };
    return { ok: true, user: { id: row.id, username: row.username, role: row.role, token_version: row.token_version } };
  }

  const cntRow = await env.DB.prepare("SELECT COUNT(*) AS cnt FROM users").first<{ cnt: number }>();
  if ((cntRow?.cnt ?? 0) === 0) {
    const seedUser = env.USERNAME?.trim() || "";
    const seedSecret = env.PASSWORD?.trim() || "";
    if (!seedUser || !seedSecret) {
      return { ok: false, uninitialized: true };
    }
    if (!constTimeEqStr(username, seedUser)) return { ok: false };
    // PASSWORD Secret 支持直接存明文密码或 pbkdf2$ 哈希；首次验证通过后统一转为 PBKDF2 哈希落库 D1
    const isHashed = seedSecret.startsWith("pbkdf2$");
    const valid = isHashed ? await verifyPbkdf2Hash(pw, seedSecret) : constTimeEqStr(pw, seedSecret);
    if (!valid) return { ok: false };
    const storedHash = isHashed ? seedSecret : await hashPassword(pw);
    const now = Date.now();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO users (username, password_hash, role, token_version, created_at, updated_at) VALUES (?, ?, 'admin', 1, ?, ?)",
    )
      .bind(seedUser, storedHash, now, now)
      .run();
    const seeded = await env.DB.prepare("SELECT id, username, role, token_version FROM users WHERE username = ?")
      .bind(seedUser)
      .first<{ id: number; username: string; role: string; token_version: number }>();
    return {
      ok: true,
      user: seeded || { username: seedUser, role: "admin", token_version: 1 },
    };
  }

  return { ok: false };
}

/* ---------- 简易限速（KV 计数，按 IP + 15 分钟窗口） ---------- */
export async function rateLimited(env: Env, req: Request, key: string, max: number): Promise<boolean> {
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const win = Math.floor(Date.now() / 900000);
  const k = `${key}:${ip}:${win}`;
  const cur = await env.KV.get(k);
  const n = cur ? parseInt(cur) : 0;
  if (n >= max) return true;
  await env.KV.put(k, String(n + 1), { expirationTtl: 1800 });
  return false;
}

/* ---------- 响应助手 ---------- */
export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}

export const err = (status: number, msg: string) => json({ error: msg }, status);
