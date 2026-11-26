#!/usr/bin/env node
/* 生成部署密钥：JWT_SECRET、COLLECTOR_TOKEN、ADMIN_PASSWORD_HASH（PBKDF2-SHA256）
 * 用法：node scripts/gen-secret.mjs [管理密码]
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

const password = argv[2];
if (!password) {
  console.error("用法: node scripts/gen-secret.mjs <管理密码>");
  exit(1);
}

const [hash] = await Promise.all([pbkdf2Hash(password)]);
console.log("JWT_SECRET=" + randomB64url(32));
console.log("COLLECTOR_TOKEN=" + randomB64url(24));
console.log("ADMIN_PASSWORD_HASH=" + hash);
