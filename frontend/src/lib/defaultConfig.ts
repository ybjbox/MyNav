import type { NavConfig } from "../types";

/** 默认配置：KV 无配置时兜底，也是"恢复默认"的基准 */
export const defaultConfig: NavConfig = {
  version: 1,
  site: {
    title: "MyNav",
    wallpaper: "meadow",
    accent: null,
    theme: "light",
    weather: { enabled: true, city: "南宁", provider: "open-meteo", qweatherHost: "", qweatherKey: "" },
    frequentBar: true,
    iconSize: "md",
    iconRadius: 12,
  },
  privacy: { publicNav: true },
  search: {
    engines: [
      { id: "google", name: "Google", url: "https://www.google.com/search?q=%s" },
      { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=%s" },
      { id: "github", name: "GitHub", url: "https://github.com/search?q=%s" },
      { id: "bili", name: "B站", url: "https://search.bilibili.com/all?keyword=%s" },
    ],
    default: "google",
    history: true,
    style: "default",
  },
  groups: [
    {
      id: "g-frequent",
      name: "常用",
      services: [
        { id: "s-github", name: "GitHub", url: "https://github.com", desc: "代码与协作", icon: "git" },
        { id: "s-cf", name: "Cloudflare", url: "https://dash.cloudflare.com", desc: "控制台", icon: "cloud" },
        { id: "s-mail", name: "Gmail", url: "https://mail.google.com", desc: "邮箱", icon: "mail" },
        { id: "s-bili", name: "哔哩哔哩", url: "https://www.bilibili.com", desc: "视频", icon: "tv", check: { type: "tcp", host: "www.bilibili.com", port: 443 } },
        { id: "s-yt", name: "YouTube", url: "https://www.youtube.com", desc: "视频", icon: "play" },
        { id: "s-sspai", name: "少数派", url: "https://sspai.com", desc: "阅读", icon: "globe" },
        {
          id: "f-reading",
          name: "效率工具",
          url: "",
          desc: "常用工具合集",
          icon: "folder",
          children: [
            { id: "s-notion", name: "Notion", url: "https://www.notion.so", desc: "笔记协作", icon: "book" },
            { id: "s-excalidraw", name: "Excalidraw", url: "https://excalidraw.com", desc: "白板绘图", icon: "layers" },
            { id: "s-regex", name: "Regex101", url: "https://regex101.com", desc: "正则调试", icon: "terminal" },
          ],
        },
      ],
    },
    {
      id: "g-ai",
      name: "AI办公",
      services: [
        { id: "s-chatgpt", name: "ChatGPT", url: "https://chatgpt.com", desc: "对话与写作", icon: "spark" },
        { id: "s-claude", name: "Claude", url: "https://claude.ai", desc: "深度推理", icon: "spark" },
        { id: "s-gemini", name: "Gemini", url: "https://gemini.google.com", desc: "多模态助手", icon: "spark" },
        { id: "s-kimi", name: "Kimi", url: "https://kimi.moonshot.cn", desc: "长文本阅读", icon: "book" },
      ],
    },
    {
      id: "g-selfhost",
      name: "自托管",
      services: [
        { id: "s-fnos", name: "飞牛 fnOS", url: "http://nas.local:5666", desc: "nas.local", icon: "nas", check: { type: "tcp", host: "nas.local", port: 5666 } },
        { id: "s-istore", name: "iStoreOS", url: "http://192.168.100.1", desc: "router.local", icon: "router", check: { type: "tcp", host: "192.168.100.1", port: 80 } },
        { id: "s-jelly", name: "Jellyfin", url: "http://nas.local:8096", desc: "媒体库", icon: "play", check: { type: "tcp", host: "nas.local", port: 8096 } },
        { id: "s-qb", name: "qBittorrent", url: "http://nas.local:8080", desc: "下载", icon: "down", check: { type: "tcp", host: "nas.local", port: 8080 } },
        { id: "s-alist", name: "Alist", url: "http://nas.local:5244", desc: "网盘挂载", icon: "folder", check: { type: "tcp", host: "nas.local", port: 5244 } },
        { id: "s-vw", name: "Vaultwarden", url: "http://nas.local:8222", desc: "密码库", icon: "key", check: { type: "tcp", host: "nas.local", port: 8222 } },
      ],
    },
    {
      id: "g-dev",
      name: "开发",
      services: [
        { id: "s-vercel", name: "Vercel", url: "https://vercel.com/dashboard", desc: "部署", icon: "layers" },
        { id: "s-pages", name: "Pages", url: "https://pages.cloudflare.com", desc: "CF Pages 项目", icon: "cloud" },
        { id: "s-docker", name: "Docker Hub", url: "https://hub.docker.com", desc: "镜像仓库", icon: "box" },
        { id: "s-npm", name: "npm", url: "https://www.npmjs.com", desc: "包管理", icon: "terminal" },
      ],
    },
  ],
  monitor: {
    thresholds: { cpu: 85, mem: 90, disk: 90, downMinutes: 3, temp: 65, conn: 30000 },
    sparkMinutes: 30,
    aiReasoningEffort: "high",
    staleAlert: {
      enabled: false,
      bark: { url: "https://api.day.app", key: "" },
      telegram: { token: "", chatId: "" },
      webhook: { url: "", template: '{"title":"{{title}}","message":"{{message}}","source":"{{source}}"}' },
    },
  },
  widgets: [
    { id: "w-countdown", type: "countdown", span: 1, size: "1x1", data: { title: "元旦倒计时", targetDate: "2027-01-01" } },
    { id: "w-calendar", type: "calendar", span: 1, size: "1x1" },
    { id: "w-weather", type: "weather", span: 1, size: "2x1" },
    { id: "w-hotsearch", type: "hotsearch", span: 1, size: "2x2", data: { source: "baidu" } },
    { id: "w-todo", type: "todo", span: 1, size: "2x2" },
    { id: "w-frequent", type: "frequent", span: 1, size: "2x1" },
    { id: "w-monitor-router", type: "monitor-router", span: 1, size: "2x2" },
    { id: "w-monitor-nas", type: "monitor-nas", span: 1, size: "2x2" },
    { id: "w-monitor-openclash", type: "monitor-openclash", span: 1, size: "2x2" },
    { id: "w-ai-diagnose", type: "ai-diagnose", span: 1, size: "2x2" },
  ],
};

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function cloneConfig(c: NavConfig): NavConfig {
  return JSON.parse(JSON.stringify(c)) as NavConfig;
}
