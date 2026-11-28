/* 品牌底色与首字符回退（当卡片未命中 D1 图标库且无基础图形时使用，不依赖任何上游图标库） */
import { hueFor } from "./wallpapers";

export interface Brand {
  color: string;
  label?: string;
}

const FULL_HOST: Record<string, Brand> = {
  "mail.google.com": { color: "#EA4335" },
  "music.163.com": { color: "#C20C0C" },
  "weixin.qq.com": { color: "#07C160" },
};

const BY_DOMAIN: Record<string, Brand> = {
  "github.com": { color: "#24292F" },
  "gitlab.com": { color: "#FC6D26" },
  "cloudflare.com": { color: "#F6821F" },
  "google.com": { color: "#4285F4" },
  "youtube.com": { color: "#FF0000" },
  "vercel.com": { color: "#171717" },
  "docker.com": { color: "#2496ED" },
  "npmjs.com": { color: "#CB3837" },
  "x.com": { color: "#1D9BF0" },
  "baidu.com": { color: "#2932E1" },
  "bilibili.com": { color: "#FB7299" },
  "sspai.com": { color: "#D71E18" },
  "zhihu.com": { color: "#0084FF" },
  "fnnas.com": { color: "#3674FF" },
  "istoreos.com": { color: "#2E90FA" },
  "openwrt.org": { color: "#00B5E2" },
  "alistgo.com": { color: "#4F5BE8" },
};

const BY_NAME: Record<string, Brand> = {
  "飞牛 fnos": { color: "#3674FF" },
  fnos: { color: "#3674FF" },
  istoreos: { color: "#2E90FA" },
  jellyfin: { color: "#AA5CC3" },
  qbittorrent: { color: "#2F67BA" },
  vaultwarden: { color: "#175DDC" },
  alist: { color: "#4F5BE8" },
};

function hostOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function brandFor(url?: string, name?: string): Brand | undefined {
  const h = hostOf(url);
  if (h) {
    if (FULL_HOST[h]) return FULL_HOST[h];
    const parts = h.split(".");
    const main = parts.length >= 2 ? parts.slice(-2).join(".") : h;
    if (BY_DOMAIN[main]) return BY_DOMAIN[main];
  }
  if (name) {
    const n = name.trim().toLowerCase();
    if (BY_NAME[n]) return BY_NAME[n];
  }
  return undefined;
}

export function brandBg(url?: string, name?: string): string {
  return brandFor(url, name)?.color ?? `hsl(${hueFor(name || "")} 62% 52%)`;
}

export function firstGlyph(name: string): string {
  const t = name.trim();
  return t ? [...t][0].toUpperCase() : "?";
}
