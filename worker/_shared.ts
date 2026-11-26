/* 共享工具：会话鉴权（JWT）、collector 令牌、密码哈希、限速 */
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
  JWT_SECRET: string;
  COLLECTOR_TOKEN: string;
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
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

export interface AuthResult {
  authed: boolean;
  payload?: Record<string, unknown>;
}

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
export async function signSession(env: Env, days = 7): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { sub: "admin", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + days * 86400 };
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(env.JWT_SECRET);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

export async function verifySession(env: Env, token: string): Promise<AuthResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { authed: false };
  const [h, p, sig] = parts;
  const key = await hmacKey(env.JWT_SECRET);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), enc.encode(`${h}.${p}`));
  if (!ok) return { authed: false };
  let payload: { sub?: string; exp?: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  } catch {
    return { authed: false };
  }
  if (payload.sub !== "admin" || !payload.exp || payload.exp * 1000 < Date.now()) return { authed: false };
  return { authed: true, payload };
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
  return verifySession(env, token);
}

export function requireToken(req: Request, env: Env): boolean {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1] === env.COLLECTOR_TOKEN && env.COLLECTOR_TOKEN.length >= 16;
}

/* ---------- 密码（PBKDF2-SHA256） ---------- */
export async function hashPassword(pw: string, iterations = 100000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${iterations}$${b64urlEncode(salt)}$${b64urlEncode(bits)}`;
}

export async function verifyPassword(env: Env, pw: string): Promise<boolean> {
  const stored = await env.KV.get("admin:password_hash");
  const target = stored || env.ADMIN_PASSWORD_HASH;
  if (target) {
    const [algo, iterStr, saltB64, hashB64] = target.split("$");
    if (algo !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
    const salt = b64urlDecode(saltB64);
    const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: parseInt(iterStr), hash: "SHA-256" }, key, 256);
    const want = b64urlDecode(hashB64);
    if (bits.byteLength !== want.byteLength) return false;
    let diff = 0;
    const a = new Uint8Array(bits), b = want;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
  // 开发兜底：明文 ADMIN_PASSWORD（仅限本地 dev）
  return !!env.ADMIN_PASSWORD && pw === env.ADMIN_PASSWORD;
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
