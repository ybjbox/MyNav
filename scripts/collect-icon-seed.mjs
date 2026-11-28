/* 一次性采集常用网站实际图标并固化为项目自维护的本地种子库 worker/iconSeed.json
 * 用法：node scripts/collect-icon-seed.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const brandIconsPath = path.join(rootDir, "frontend/src/lib/brand-icons.json");
const brandIcons = JSON.parse(fs.readFileSync(brandIconsPath, "utf8"));

const SITES = [
  // 常用
  { slug: "google", name: "Google", category: "常用", color: "#4285F4", siteUrl: "https://www.google.com" },
  { slug: "bing", name: "Bing", category: "常用", color: "#008373", siteUrl: "https://www.bing.com" },
  {
    slug: "gmail",
    name: "Gmail",
    category: "常用",
    color: "#EA4335",
    siteUrl: "https://mail.google.com",
    overrideIconUrls: ["https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico"],
  },
  { slug: "baidu", name: "百度", category: "常用", color: "#2932E1", siteUrl: "https://www.baidu.com" },
  { slug: "zhihu", name: "知乎", category: "常用", color: "#0066FF", siteUrl: "https://www.zhihu.com" },
  { slug: "sspai", name: "少数派", category: "常用", color: "#D71E18", siteUrl: "https://sspai.com" },
  { slug: "sinaweibo", name: "微博", category: "常用", color: "#E6162D", siteUrl: "https://weibo.com" },
  { slug: "xiaohongshu", name: "小红书", category: "常用", color: "#FF2442", siteUrl: "https://www.xiaohongshu.com" },
  { slug: "taobao", name: "淘宝", category: "常用", color: "#FF5000", siteUrl: "https://www.taobao.com" },
  { slug: "jd", name: "京东", category: "常用", color: "#E1251B", siteUrl: "https://www.jd.com" },
  { slug: "wechat", name: "微信", category: "常用", color: "#07C160", siteUrl: "https://wx.qq.com" },
  { slug: "qq", name: "QQ", category: "常用", color: "#12B7F5", siteUrl: "https://im.qq.com" },
  { slug: "douyin", name: "抖音", category: "常用", color: "#1C1C1E", siteUrl: "https://www.douyin.com" },
  { slug: "notion", name: "Notion", category: "常用", color: "#111111", siteUrl: "https://www.notion.so" },
  { slug: "obsidian", name: "Obsidian", category: "常用", color: "#7C3AED", siteUrl: "https://obsidian.md" },
  { slug: "apple", name: "Apple", category: "常用", color: "#1D1D1F", siteUrl: "https://www.apple.com" },
  { slug: "microsoft", name: "Microsoft", category: "常用", color: "#00A4EF", siteUrl: "https://www.microsoft.com" },
  { slug: "discord", name: "Discord", category: "常用", color: "#5865F2", siteUrl: "https://discord.com" },
  { slug: "telegram", name: "Telegram", category: "常用", color: "#26A5E4", siteUrl: "https://web.telegram.org" },
  { slug: "x", name: "X", category: "常用", color: "#111111", siteUrl: "https://x.com" },
  { slug: "reddit", name: "Reddit", category: "常用", color: "#FF4500", siteUrl: "https://www.reddit.com" },
  { slug: "amazon", name: "Amazon", category: "常用", color: "#FF9900", siteUrl: "https://www.amazon.com" },

  // AI
  { slug: "openai", name: "ChatGPT", category: "AI", color: "#10A37F", siteUrl: "https://chatgpt.com" },
  { slug: "anthropic", name: "Claude", category: "AI", color: "#D97757", siteUrl: "https://claude.ai" },
  { slug: "googlegemini", name: "Gemini", category: "AI", color: "#4E82EE", siteUrl: "https://gemini.google.com" },
  { slug: "deepseek", name: "DeepSeek", category: "AI", color: "#4D6BFE", siteUrl: "https://chat.deepseek.com" },
  { slug: "perplexity", name: "Perplexity", category: "AI", color: "#20808D", siteUrl: "https://www.perplexity.ai" },
  { slug: "metaso", name: "秘塔搜索", category: "AI", color: "#3B82F6", siteUrl: "https://metaso.cn" },

  // 开发
  { slug: "github", name: "GitHub", category: "开发", color: "#181717", siteUrl: "https://github.com" },
  { slug: "gitlab", name: "GitLab", category: "开发", color: "#FC6D26", siteUrl: "https://gitlab.com" },
  { slug: "gitee", name: "Gitee", category: "开发", color: "#C71D23", siteUrl: "https://gitee.com" },
  { slug: "juejin", name: "掘金", category: "开发", color: "#1E80FF", siteUrl: "https://juejin.cn" },
  { slug: "csdn", name: "CSDN", category: "开发", color: "#FC5531", siteUrl: "https://www.csdn.net" },
  { slug: "stackoverflow", name: "Stack Overflow", category: "开发", color: "#F58025", siteUrl: "https://stackoverflow.com" },
  { slug: "figma", name: "Figma", category: "开发", color: "#F24E1E", siteUrl: "https://www.figma.com" },
  { slug: "vercel", name: "Vercel", category: "开发", color: "#111111", siteUrl: "https://vercel.com" },
  { slug: "cloudflare", name: "Cloudflare", category: "开发", color: "#F38020", siteUrl: "https://dash.cloudflare.com" },
  { slug: "cloudflarepages", name: "Pages", category: "开发", color: "#F38020", siteUrl: "https://pages.cloudflare.com" },
  { slug: "cloudflareworkers", name: "CF Workers", category: "开发", color: "#F38020", siteUrl: "https://workers.cloudflare.com" },
  { slug: "alibabacloud", name: "阿里云", category: "开发", color: "#FF6A00", siteUrl: "https://www.aliyun.com" },
  { slug: "npm", name: "npm", category: "开发", color: "#CB3837", siteUrl: "https://www.npmjs.com" },
  { slug: "vite", name: "Vite", category: "开发", color: "#646CFF", siteUrl: "https://vite.dev" },
  { slug: "react", name: "React", category: "开发", color: "#087EA4", siteUrl: "https://react.dev" },
  { slug: "vuedotjs", name: "Vue.js", category: "开发", color: "#4FC08D", siteUrl: "https://vuejs.org" },
  { slug: "typescript", name: "TypeScript", category: "开发", color: "#3178C6", siteUrl: "https://www.typescriptlang.org" },
  { slug: "python", name: "Python", category: "开发", color: "#3776AB", siteUrl: "https://www.python.org" },
  { slug: "rust", name: "Rust", category: "开发", color: "#111111", siteUrl: "https://www.rust-lang.org" },
  { slug: "go", name: "Go", category: "开发", color: "#00ADD8", siteUrl: "https://go.dev" },
  { slug: "nodedotjs", name: "Node.js", category: "开发", color: "#5FA04E", siteUrl: "https://nodejs.org" },
  { slug: "linux", name: "Linux", category: "开发", color: "#FCC624", siteUrl: "https://www.kernel.org" },
  { slug: "linear", name: "Linear", category: "开发", color: "#5E6AD2", siteUrl: "https://linear.app" },
  { slug: "raycast", name: "Raycast", category: "开发", color: "#FF6363", siteUrl: "https://www.raycast.com" },
  { slug: "codepen", name: "CodePen", category: "开发", color: "#111111", siteUrl: "https://codepen.io" },

  // 影音
  { slug: "bilibili", name: "哔哩哔哩", category: "影音", color: "#00A1D6", siteUrl: "https://www.bilibili.com" },
  { slug: "youtube", name: "YouTube", category: "影音", color: "#FF0000", siteUrl: "https://www.youtube.com" },
  { slug: "tiktok", name: "TikTok", category: "影音", color: "#111111", siteUrl: "https://www.tiktok.com" },
  { slug: "neteasecloudmusic", name: "网易云音乐", category: "影音", color: "#E60026", siteUrl: "https://music.163.com" },
  { slug: "spotify", name: "Spotify", category: "影音", color: "#1DB954", siteUrl: "https://open.spotify.com" },
  { slug: "netflix", name: "Netflix", category: "影音", color: "#E50914", siteUrl: "https://www.netflix.com" },
  { slug: "twitch", name: "Twitch", category: "影音", color: "#9146FF", siteUrl: "https://www.twitch.tv" },
  { slug: "steam", name: "Steam", category: "影音", color: "#171A21", siteUrl: "https://store.steampowered.com" },

  // 自托管
  { slug: "fnnas", name: "飞牛 fnOS", category: "自托管", color: "#3674FF", siteUrl: "https://www.fnnas.com" },
  { slug: "istoreos", name: "iStoreOS", category: "自托管", color: "#2E90FA", siteUrl: "https://www.istoreos.com" },
  { slug: "alist", name: "Alist", category: "自托管", color: "#4F5BE8", siteUrl: "https://alistgo.com" },
  { slug: "vaultwarden", name: "Vaultwarden", category: "自托管", color: "#175DDC", siteUrl: "https://bitwarden.com" },
  { slug: "docker", name: "Docker", category: "自托管", color: "#2496ED", siteUrl: "https://hub.docker.com" },
  {
    slug: "portainer",
    name: "Portainer",
    category: "自托管",
    color: "#13BEF9",
    siteUrl: "https://www.portainer.io",
    overrideIconUrls: ["https://www.portainer.io/hubfs/portainer-favicon.png", "https://docs.portainer.io/favicon.ico"],
  },
  { slug: "nginx", name: "Nginx", category: "自托管", color: "#009639", siteUrl: "https://nginx.org" },
  { slug: "tailscale", name: "Tailscale", category: "自托管", color: "#242424", siteUrl: "https://tailscale.com" },
  { slug: "homeassistant", name: "Home Assistant", category: "自托管", color: "#18BCF2", siteUrl: "https://www.home-assistant.io" },
  { slug: "synology", name: "Synology", category: "自托管", color: "#0073E6", siteUrl: "https://www.synology.com" },
  { slug: "openwrt", name: "OpenWrt", category: "自托管", color: "#00B5E2", siteUrl: "https://openwrt.org" },
  { slug: "jellyfin", name: "Jellyfin", category: "自托管", color: "#00A4DC", siteUrl: "https://jellyfin.org" },
  { slug: "qbittorrent", name: "qBittorrent", category: "自托管", color: "#2F67BA", siteUrl: "https://www.qbittorrent.org" },
  { slug: "bitwarden", name: "Bitwarden", category: "自托管", color: "#175DDC", siteUrl: "https://bitwarden.com" },
  { slug: "nextcloud", name: "Nextcloud", category: "自托管", color: "#0082C9", siteUrl: "https://nextcloud.com" },
];

async function fetchOne(site) {
  const host = new URL(site.siteUrl).hostname.toLowerCase();
  const bare = host.startsWith("www.") ? host.slice(4) : host;
  const candidates = [
    ...(site.overrideIconUrls || []),
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bare)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(bare)}.ico`,
    `https://${host}/favicon.ico`,
  ];

  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        headers: { "user-agent": "MyNav-SeedCollector/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (r.status !== 200) continue;
      const rawCt = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!rawCt.startsWith("image/") && rawCt !== "application/octet-stream") continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.byteLength < 64 || buf.byteLength > 128 * 1024) continue;
      const mime = rawCt.startsWith("image/") ? rawCt : "image/x-icon";
      return {
        id: `brand-${site.slug}`,
        slug: site.slug,
        name: site.name,
        category: site.category,
        source: host,
        site_url: site.siteUrl,
        color: site.color,
        mime_type: mime,
        icon_content: `data:${mime};base64,${buf.toString("base64")}`,
        builtin: 1,
      };
    } catch {
      /* 尝试下一个源 */
    }
  }

  // 若官网图标全部不可达，从已有 SVG 路径生成独立彩色 SVG Data URL，不依赖任何上游运行时包
  const svgIcon = brandIcons.icons?.[site.slug];
  if (svgIcon?.body) {
    const coloredBody = svgIcon.body.replace(/currentColor/g, site.color);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${coloredBody}</svg>`;
    const mime = "image/svg+xml";
    return {
      id: `brand-${site.slug}`,
      slug: site.slug,
      name: site.name,
      category: site.category,
      source: `${host} (svg)`,
      site_url: site.siteUrl,
      color: site.color,
      mime_type: mime,
      icon_content: `data:${mime};base64,${Buffer.from(svg, "utf8").toString("base64")}`,
      builtin: 1,
    };
  }

  throw new Error(`无法收集 ${site.slug} (${site.siteUrl}) 的图标`);
}

async function main() {
  const results = [];
  for (let i = 0; i < SITES.length; i += 8) {
    const chunk = SITES.slice(i, i + 8);
    const part = await Promise.all(chunk.map(fetchOne));
    results.push(...part);
  }
  const outPath = path.join(rootDir, "worker/iconSeed.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
  const totalBytes = fs.statSync(outPath).size;
  const svgCount = results.filter((x) => x.mime_type === "image/svg+xml").length;
  console.log(`已采集 ${results.length} 个图标写入 ${outPath}（${(totalBytes / 1024).toFixed(1)} KB，其中 SVG 兜底 ${svgCount} 个）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
