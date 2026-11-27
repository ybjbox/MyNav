/* WeTab 式品牌图标：站点真实品牌纯色底 + 白色品牌字/图形（扁平：无渐变、无阴影、无描边）。
 * 未命中品牌的站回退 hueFor 稳定纯色 + 首字符白字，保持同一视觉体系。 */
import { hueFor } from "./wallpapers";
import { BRAND_CATALOG, type BrandCatalogItem } from "./brandCatalog";

export interface Brand {
  color: string; // 品牌主色（纯色）
  label?: string; // 品牌以文字为 logo 的站（京东 JD、淘宝 淘），图标内容直接用品牌字
}

/* 子域有独立品牌的完整域名（优先于主域匹配） */
const FULL_HOST: Record<string, Brand> = {
  "mail.google.com": { color: "#EA4335" }, // Gmail
  "music.163.com": { color: "#C20C0C" }, // 网易云音乐
  "weixin.qq.com": { color: "#07C160" }, // 微信
};

/* 主域名（hostname 后两段）→ 品牌 */
const BY_DOMAIN: Record<string, Brand> = {
  // 开发 / 国际
  "github.com": { color: "#24292F" },
  "gitlab.com": { color: "#FC6D26" },
  "cloudflare.com": { color: "#F6821F" },
  "google.com": { color: "#4285F4" },
  "youtube.com": { color: "#FF0000" },
  "vercel.com": { color: "#171717" },
  "docker.com": { color: "#2496ED" },
  "npmjs.com": { color: "#CB3837" },
  "npmjs.org": { color: "#CB3837" },
  "x.com": { color: "#1D9BF0" },
  "twitter.com": { color: "#1D9BF0" },
  "t.me": { color: "#229ED9" },
  "telegram.org": { color: "#229ED9" },
  "reddit.com": { color: "#FF4500" },
  "openai.com": { color: "#10A37F" },
  "chatgpt.com": { color: "#10A37F" },
  "claude.ai": { color: "#D97757" },
  "deepseek.com": { color: "#4D6BFE" },
  "notion.so": { color: "#2F3437" },
  "proton.me": { color: "#6D4AFF" },
  "apple.com": { color: "#1D1D1F" },
  "microsoft.com": { color: "#00A4EF" },
  "netflix.com": { color: "#E50914" },
  "spotify.com": { color: "#1DB954" },
  "amazon.com": { color: "#FF9900" },
  "discord.com": { color: "#5865F2" },
  "steampowered.com": { color: "#1B2838" },
  "pixiv.net": { color: "#0096FA" },
  "bing.com": { color: "#008373" },
  "duckduckgo.com": { color: "#DE5833" },
  // 国内
  "taobao.com": { color: "#FF5000", label: "淘" },
  "tmall.com": { color: "#FF0036" },
  "jd.com": { color: "#E1251B", label: "JD" },
  "baidu.com": { color: "#2932E1" },
  "vip.com": { color: "#F10180" },
  "bilibili.com": { color: "#FB7299" },
  "sspai.com": { color: "#D71E18" },
  "zhihu.com": { color: "#0084FF" },
  "weibo.com": { color: "#E6162D" },
  "douyin.com": { color: "#1C1C1E" },
  "163.com": { color: "#D43C33" },
  "qq.com": { color: "#12B7F5" },
  "iqiyi.com": { color: "#00BE06" },
  "xiaomi.com": { color: "#FF6900" },
  "mi.com": { color: "#FF6900" },
  "aliyun.com": { color: "#FF6A00" },
  "pinduoduo.com": { color: "#E02E24" },
  "yangkeduo.com": { color: "#E02E24" },
  "gitee.com": { color: "#C71D23" },
  "csdn.net": { color: "#FC5531" },
  "juejin.cn": { color: "#1E80FF" },
  // 自托管常用
  "fnnas.com": { color: "#3674FF" },
  "istoreos.com": { color: "#2E90FA" },
  "openwrt.org": { color: "#00B5E2" },
  "alistgo.com": { color: "#4F5BE8" },
  "alist.ovh": { color: "#4F5BE8" },
};

/* 卡片名 / 常用别名（小写）→ 品牌：域名未命中或 NAS 内网地址（nas.local 等）时兜底 */
const BY_NAME: Record<string, Brand> = {
  github: { color: "#24292F" },
  gitlab: { color: "#FC6D26" },
  cloudflare: { color: "#F6821F" },
  pages: { color: "#F6821F" },
  gmail: { color: "#EA4335" },
  google: { color: "#4285F4" },
  "哔哩哔哩": { color: "#FB7299" },
  "b站": { color: "#FB7299" },
  youtube: { color: "#FF0000" },
  少数派: { color: "#D71E18" },
  vercel: { color: "#171717" },
  "docker hub": { color: "#2496ED" },
  docker: { color: "#2496ED" },
  npm: { color: "#CB3837" },
  淘宝: { color: "#FF5000", label: "淘" },
  京东: { color: "#E1251B", label: "JD" },
  京东商城: { color: "#E1251B", label: "JD" },
  天猫: { color: "#FF0036" },
  百度: { color: "#2932E1" },
  知乎: { color: "#0084FF" },
  微博: { color: "#E6162D" },
  微信: { color: "#07C160" },
  网易云音乐: { color: "#C20C0C" },
  chatgpt: { color: "#10A37F" },
  openai: { color: "#10A37F" },
  claude: { color: "#D97757" },
  deepseek: { color: "#4D6BFE" },
  "飞牛 fnos": { color: "#3674FF" },
  fnos: { color: "#3674FF" },
  飞牛: { color: "#3674FF" },
  istoreos: { color: "#2E90FA" },
  istore: { color: "#2E90FA" },
  openwrt: { color: "#00B5E2" },
  jellyfin: { color: "#AA5CC3" },
  qbittorrent: { color: "#2F67BA" },
  vaultwarden: { color: "#175DDC" },
  bitwarden: { color: "#175DDC" },
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

/** 域名（优先）或名称匹配品牌；NAS 内网地址自动落到名称通道 */
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

/** 图标块底色：品牌纯色；未命中回退按名称稳定取色（同为纯色，WeTab 式扁平） */
export function brandBg(url?: string, name?: string): string {
  return brandFor(url, name)?.color ?? `hsl(${hueFor(name || "")} 62% 52%)`;
}

/** 图标内容优先用品牌字（label），否则无手绘图标时用名称首字符 */
export function firstGlyph(name: string): string {
  const t = name.trim();
  return t ? [...t][0].toUpperCase() : "?";
}

/** 从官方品牌库 BRAND_CATALOG 中按域名或名称自动匹配品牌条目 */
const NAME_ALIASES: Record<string, string> = {
  "飞牛 fnos": "fnnas",
  "飞牛": "fnnas",
  fnos: "fnnas",
  istoreos: "istoreos",
  istore: "istoreos",
  "少数派": "sspai",
  pages: "cloudflarepages",
  "cloudflare pages": "cloudflarepages",
  "docker hub": "docker",
  "b站": "bilibili",
  "谷歌": "google",
  chatgpt: "openai",
  claude: "anthropic",
  gemini: "googlegemini",
  vaultwarden: "vaultwarden",
  alist: "alist",
};

export function matchBrand(url?: string, name?: string): BrandCatalogItem | undefined {
  const h = hostOf(url);
  if (h) {
    const parts = h.split(".");
    const main = parts.length >= 2 ? parts.slice(-2).join(".") : h;
    const byExactHost = BRAND_CATALOG.find((b) => hostOf(b.defaultUrl) === h);
    if (byExactHost) return byExactHost;
    const byHost = BRAND_CATALOG.find((b) => {
      const bh = hostOf(b.defaultUrl);
      if (!bh) return false;
      const bParts = bh.split(".");
      const bMain = bParts.length >= 2 ? bParts.slice(-2).join(".") : bh;
      return bMain === main;
    });
    if (byHost) return byHost;
  }
  if (name) {
    const n = name.trim().toLowerCase();
    const aliasSlug = NAME_ALIASES[n];
    if (aliasSlug) {
      const byAlias = BRAND_CATALOG.find((b) => b.slug === aliasSlug);
      if (byAlias) return byAlias;
    }
    const byName = BRAND_CATALOG.find(
      (b) => b.name.toLowerCase() === n || b.slug.toLowerCase() === n || n.includes(b.slug.toLowerCase()),
    );
    if (byName) return byName;
  }
  return undefined;
}
