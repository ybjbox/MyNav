#!/usr/bin/env node
/* 生成部署凭据：JWT_SECRET、USERNAME、PASSWORD（支持明文或 PBKDF2-SHA256 哈希）及 D1 初始化 SQL
 * 用法：node scripts/gen-secret.mjs <账号名> <密码>
 */
import { webcrypto as crypto } from "node:crypto";
import { argv, exit } from "node:process";

const randomB64url = (bytes) => {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Buffer.from(b).toString("base64url");
};

async function pbkdf2Hash(password, iterations = 100000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  const enc = (x) => Buffer.from(x).toString("base64url");
  return `pbkdf2$${iterations}$${enc(salt)}$${enc(new Uint8Array(bits))}`;
}

const username = (argv[2] || "").trim();
const password = argv[3] || "";
if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username) || password.length < 6) {
  console.error("用法: node scripts/gen-secret.mjs <账号名(2-32位字母数字._-)> <密码(≥6位)>");
  exit(1);
}

const hash = await pbkdf2Hash(password);
const now = Date.now();
console.log("JWT_SECRET=" + randomB64url(32));
console.log("USERNAME=" + username);
console.log("PASSWORD=" + hash + "   # 也可直接填明文密码，首次登录后自动哈希存入 D1");
console.log("\n-- 可选直接写入远端 D1 users 表的 SQL：");
console.log(
  `INSERT INTO users (username, password_hash, role, token_version, created_at, updated_at) VALUES ('${username}', '${hash}', 'admin', 1, ${now}, ${now}) ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, token_version = token_version + 1, updated_at = excluded.updated_at;`,
);
