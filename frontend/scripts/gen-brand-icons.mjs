/* 从 @iconify-json/simple-icons 抽取常用网站品牌图标子集 → src/lib/brand-icons.json
 * 运行：node frontend/scripts/gen-brand-icons.mjs */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { getIcons } from "@iconify/utils";

const require = createRequire(import.meta.url);
const simpleIcons = require("@iconify-json/simple-icons/icons.json");

const NAMES = [
  "github", "gitlab", "google", "gmail", "youtube", "bilibili", "zhihu", "baidu",
  "sinaweibo", "tiktok", "taobao", "xiaohongshu", "neteasecloudmusic", "tencentqq",
  "wechat", "openai", "anthropic", "googlegemini", "notion", "figma", "vercel",
  "cloudflare", "docker", "npm", "tailscale", "homeassistant", "synology", "jellyfin",
  "qbittorrent", "bitwarden", "linux", "apple", "microsoft", "netflix", "spotify",
  "discord", "telegram", "x", "reddit", "stackoverflow", "vite", "react", "vuedotjs",
  "typescript", "python", "rust", "go", "nodedotjs", "cloudflareworkers", "nginx",
  "portainer", "openwrt", "nextcloud", "obsidian", "linear", "raycast", "codepen",
  "steam", "twitch", "amazon", "alibabacloud", "gitee", "juejin", "csdn",
];

const available = NAMES.filter((n) => Boolean(simpleIcons.icons[n]));
const missing = NAMES.filter((n) => !simpleIcons.icons[n]);
if (missing.length) {
  console.warn("以下 slug 未在 simple-icons 中找到，已跳过:", missing.join(", "));
}

const subset = getIcons(simpleIcons, available);
const out = new URL("../src/lib/brand-icons.json", import.meta.url);
writeFileSync(out, JSON.stringify(subset));
console.log(`已写入 ${Object.keys(subset.icons).length} 个品牌图标 → src/lib/brand-icons.json`);
