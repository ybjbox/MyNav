/* 自维护图标库缓存与匹配工具：数据直接来自云端 D1 icon_library 表，不再依赖上游图标库或远程抓图 */
import { api } from "../api/client";

export type IconLibraryCategory = "常用" | "AI" | "开发" | "影音" | "自托管" | "自定义";

export interface IconLibraryEntry {
  id: string;
  slug: string;
  name: string;
  category: IconLibraryCategory;
  source: string;
  site_url: string;
  color: string;
  mime_type: string;
  icon_content: string; // data:image/... | /... | glyph:<key>
  builtin?: boolean;
  created_at?: number;
  updated_at?: number;
}

export const ICON_LIB_EVENT = "nav:iconlib-change";
export const ICON_LIB_CATEGORIES: ("全部" | IconLibraryCategory)[] = [
  "全部", "常用", "AI", "开发", "影音", "自托管", "自定义",
];

const LEGACY_KEYS = ["nav:icon-library:v2", "nav:icon-library"];

let dbEntries: IconLibraryEntry[] = [];
let dbLoaded = false;

function normalizeEntries(raw: unknown[]): IconLibraryEntry[] {
  return raw
    .filter((x): x is IconLibraryEntry => !!x && typeof x === "object" && "slug" in x && "icon_content" in x)
    .map((x) => ({
      ...x,
      category: (x.category || "自定义") as IconLibraryCategory,
      color: x.color || "#3261e3",
      source: x.source || "",
      site_url: x.site_url || "",
    }));
}

export function setIconLibraryCache(list: IconLibraryEntry[]): void {
  dbEntries = normalizeEntries(list);
  dbLoaded = true;
  window.dispatchEvent(new CustomEvent(ICON_LIB_EVENT));
}

export function isIconLibraryLoaded(): boolean {
  return dbLoaded;
}

export function loadIconLibrary(): IconLibraryEntry[] {
  return dbEntries;
}

export async function refreshIconLibraryFromDb(): Promise<IconLibraryEntry[]> {
  const res = await api.getIcons();
  setIconLibraryCache((res.icons || []) as IconLibraryEntry[]);
  return dbEntries;
}

export function getIconBySlug(slug: string): IconLibraryEntry | undefined {
  return dbEntries.find((e) => e.slug === slug);
}

function hostOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

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

/** 从 D1 图标库中按域名或名称平滑匹配已有图标（兼容旧卡片 config 中的 name/url/icon 字段） */
export function matchIconEntry(url?: string, name?: string): IconLibraryEntry | undefined {
  const h = hostOf(url);
  if (h) {
    const parts = h.split(".");
    const main = parts.length >= 2 ? parts.slice(-2).join(".") : h;
    const byExact = dbEntries.find((e) => hostOf(e.site_url) === h);
    if (byExact) return byExact;
    const byMain = dbEntries.find((e) => {
      const eh = hostOf(e.site_url);
      if (!eh) return false;
      const eParts = eh.split(".");
      const eMain = eParts.length >= 2 ? eParts.slice(-2).join(".") : eh;
      return eMain === main;
    });
    if (byMain) return byMain;
  }
  if (name) {
    const n = name.trim().toLowerCase();
    const aliasSlug = NAME_ALIASES[n];
    if (aliasSlug) {
      const byAlias = dbEntries.find((e) => e.slug === aliasSlug);
      if (byAlias) return byAlias;
    }
    const byName = dbEntries.find(
      (e) => e.name.toLowerCase() === n || e.slug.toLowerCase() === n || n.includes(e.slug.toLowerCase()),
    );
    if (byName) return byName;
  }
  return undefined;
}

/** 读取旧版浏览器 localStorage 中用户自定义图标，便于一次性迁入 D1 */
export function peekLegacyLocalCustomIcons(): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        if (rec.builtin === true) continue;
        const k = String(rec.id || rec.name || "");
        if (!k || seen.has(k)) continue;
        seen.add(k);
        found.push(rec);
      }
    } catch {
      /* 忽略 */
    }
  }
  return found;
}

export function clearLegacyLocalIcons(): void {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* 忽略 */
    }
  }
}
