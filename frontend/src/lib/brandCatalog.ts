import brandIcons from "./brand-icons.json";

export type BrandCategory = "常用" | "AI" | "开发" | "影音" | "自托管";

export interface BrandCatalogItem {
  slug: string;
  name: string;
  category: BrandCategory;
  color: string;
  defaultUrl: string;
}

const ALL_BRANDS: BrandCatalogItem[] = [
  // 常用
  { slug: "google", name: "Google", category: "常用", color: "#4285F4", defaultUrl: "https://www.google.com" },
  { slug: "gmail", name: "Gmail", category: "常用", color: "#EA4335", defaultUrl: "https://mail.google.com" },
  { slug: "baidu", name: "百度", category: "常用", color: "#2932E1", defaultUrl: "https://www.baidu.com" },
  { slug: "zhihu", name: "知乎", category: "常用", color: "#0066FF", defaultUrl: "https://www.zhihu.com" },
  { slug: "sinaweibo", name: "微博", category: "常用", color: "#E6162D", defaultUrl: "https://weibo.com" },
  { slug: "xiaohongshu", name: "小红书", category: "常用", color: "#FF2442", defaultUrl: "https://www.xiaohongshu.com" },
  { slug: "taobao", name: "淘宝", category: "常用", color: "#FF5000", defaultUrl: "https://www.taobao.com" },
  { slug: "wechat", name: "微信", category: "常用", color: "#07C160", defaultUrl: "https://wx.qq.com" },
  { slug: "notion", name: "Notion", category: "常用", color: "#111111", defaultUrl: "https://www.notion.so" },
  { slug: "obsidian", name: "Obsidian", category: "常用", color: "#7C3AED", defaultUrl: "https://obsidian.md" },
  { slug: "apple", name: "Apple", category: "常用", color: "#1D1D1F", defaultUrl: "https://www.apple.com" },
  { slug: "microsoft", name: "Microsoft", category: "常用", color: "#00A4EF", defaultUrl: "https://www.microsoft.com" },
  { slug: "discord", name: "Discord", category: "常用", color: "#5865F2", defaultUrl: "https://discord.com" },
  { slug: "telegram", name: "Telegram", category: "常用", color: "#26A5E4", defaultUrl: "https://web.telegram.org" },
  { slug: "x", name: "X", category: "常用", color: "#111111", defaultUrl: "https://x.com" },
  { slug: "reddit", name: "Reddit", category: "常用", color: "#FF4500", defaultUrl: "https://www.reddit.com" },
  { slug: "amazon", name: "Amazon", category: "常用", color: "#FF9900", defaultUrl: "https://www.amazon.com" },

  // AI
  { slug: "openai", name: "ChatGPT", category: "AI", color: "#10A37F", defaultUrl: "https://chatgpt.com" },
  { slug: "anthropic", name: "Claude", category: "AI", color: "#D97757", defaultUrl: "https://claude.ai" },
  { slug: "googlegemini", name: "Gemini", category: "AI", color: "#4E82EE", defaultUrl: "https://gemini.google.com" },

  // 开发
  { slug: "github", name: "GitHub", category: "开发", color: "#181717", defaultUrl: "https://github.com" },
  { slug: "gitlab", name: "GitLab", category: "开发", color: "#FC6D26", defaultUrl: "https://gitlab.com" },
  { slug: "gitee", name: "Gitee", category: "开发", color: "#C71D23", defaultUrl: "https://gitee.com" },
  { slug: "juejin", name: "掘金", category: "开发", color: "#1E80FF", defaultUrl: "https://juejin.cn" },
  { slug: "csdn", name: "CSDN", category: "开发", color: "#FC5531", defaultUrl: "https://www.csdn.net" },
  { slug: "stackoverflow", name: "Stack Overflow", category: "开发", color: "#F58025", defaultUrl: "https://stackoverflow.com" },
  { slug: "figma", name: "Figma", category: "开发", color: "#F24E1E", defaultUrl: "https://www.figma.com" },
  { slug: "vercel", name: "Vercel", category: "开发", color: "#111111", defaultUrl: "https://vercel.com" },
  { slug: "cloudflare", name: "Cloudflare", category: "开发", color: "#F38020", defaultUrl: "https://dash.cloudflare.com" },
  { slug: "cloudflareworkers", name: "CF Workers", category: "开发", color: "#F38020", defaultUrl: "https://workers.cloudflare.com" },
  { slug: "alibabacloud", name: "阿里云", category: "开发", color: "#FF6A00", defaultUrl: "https://www.aliyun.com" },
  { slug: "npm", name: "npm", category: "开发", color: "#CB3837", defaultUrl: "https://www.npmjs.com" },
  { slug: "vite", name: "Vite", category: "开发", color: "#646CFF", defaultUrl: "https://vite.dev" },
  { slug: "react", name: "React", category: "开发", color: "#087EA4", defaultUrl: "https://react.dev" },
  { slug: "vuedotjs", name: "Vue.js", category: "开发", color: "#4FC08D", defaultUrl: "https://vuejs.org" },
  { slug: "typescript", name: "TypeScript", category: "开发", color: "#3178C6", defaultUrl: "https://www.typescriptlang.org" },
  { slug: "python", name: "Python", category: "开发", color: "#3776AB", defaultUrl: "https://www.python.org" },
  { slug: "rust", name: "Rust", category: "开发", color: "#111111", defaultUrl: "https://www.rust-lang.org" },
  { slug: "go", name: "Go", category: "开发", color: "#00ADD8", defaultUrl: "https://go.dev" },
  { slug: "nodedotjs", name: "Node.js", category: "开发", color: "#5FA04E", defaultUrl: "https://nodejs.org" },
  { slug: "linux", name: "Linux", category: "开发", color: "#FCC624", defaultUrl: "https://www.kernel.org" },
  { slug: "linear", name: "Linear", category: "开发", color: "#5E6AD2", defaultUrl: "https://linear.app" },
  { slug: "raycast", name: "Raycast", category: "开发", color: "#FF6363", defaultUrl: "https://www.raycast.com" },
  { slug: "codepen", name: "CodePen", category: "开发", color: "#111111", defaultUrl: "https://codepen.io" },

  // 影音
  { slug: "bilibili", name: "哔哩哔哩", category: "影音", color: "#00A1D6", defaultUrl: "https://www.bilibili.com" },
  { slug: "youtube", name: "YouTube", category: "影音", color: "#FF0000", defaultUrl: "https://www.youtube.com" },
  { slug: "tiktok", name: "TikTok", category: "影音", color: "#111111", defaultUrl: "https://www.tiktok.com" },
  { slug: "neteasecloudmusic", name: "网易云音乐", category: "影音", color: "#E60026", defaultUrl: "https://music.163.com" },
  { slug: "spotify", name: "Spotify", category: "影音", color: "#1DB954", defaultUrl: "https://open.spotify.com" },
  { slug: "netflix", name: "Netflix", category: "影音", color: "#E50914", defaultUrl: "https://www.netflix.com" },
  { slug: "twitch", name: "Twitch", category: "影音", color: "#9146FF", defaultUrl: "https://www.twitch.tv" },
  { slug: "steam", name: "Steam", category: "影音", color: "#171A21", defaultUrl: "https://store.steampowered.com" },

  // 自托管
  { slug: "docker", name: "Docker", category: "自托管", color: "#2496ED", defaultUrl: "https://hub.docker.com" },
  { slug: "portainer", name: "Portainer", category: "自托管", color: "#13BEF9", defaultUrl: "http://nas.local:9000" },
  { slug: "nginx", name: "Nginx", category: "自托管", color: "#009639", defaultUrl: "http://nas.local" },
  { slug: "tailscale", name: "Tailscale", category: "自托管", color: "#242424", defaultUrl: "https://login.tailscale.com" },
  { slug: "homeassistant", name: "Home Assistant", category: "自托管", color: "#18BCF2", defaultUrl: "http://homeassistant.local:8123" },
  { slug: "synology", name: "Synology", category: "自托管", color: "#0073E6", defaultUrl: "http://nas.local:5000" },
  { slug: "openwrt", name: "OpenWrt", category: "自托管", color: "#00B5E2", defaultUrl: "http://192.168.1.1" },
  { slug: "jellyfin", name: "Jellyfin", category: "自托管", color: "#00A4DC", defaultUrl: "http://nas.local:8096" },
  { slug: "qbittorrent", name: "qBittorrent", category: "自托管", color: "#2F67BA", defaultUrl: "http://nas.local:8080" },
  { slug: "bitwarden", name: "Bitwarden", category: "自托管", color: "#175DDC", defaultUrl: "http://nas.local:8222" },
  { slug: "nextcloud", name: "Nextcloud", category: "自托管", color: "#0082C9", defaultUrl: "http://nas.local:8081" },
];

const availableIcons = (brandIcons as { icons: Record<string, unknown> }).icons;

export const BRAND_CATALOG: BrandCatalogItem[] = ALL_BRANDS.filter((item) =>
  Object.prototype.hasOwnProperty.call(availableIcons, item.slug),
);
