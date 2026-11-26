/* 可编辑图标库：基于 BRAND_CATALOG 初始化，支持增删改并持久化到 localStorage (nav:icon-library) */
import { BRAND_CATALOG, type BrandCategory } from "./brandCatalog";

export type IconLibraryCategory = BrandCategory | "自定义";

export interface IconLibraryEntry {
  id: string;
  name: string;
  category: IconLibraryCategory;
  color: string;
  defaultUrl: string;
  icon: string; // "brand:<slug>" | 基础图形键名 | https:// | data:
  builtin?: boolean;
}

export const ICON_LIB_STORAGE_KEY = "nav:icon-library";
export const ICON_LIB_EVENT = "nav:iconlib-change";
export const ICON_LIB_CATEGORIES: ("全部" | IconLibraryCategory)[] = [
  "全部", "常用", "AI", "开发", "影音", "自托管", "自定义",
];

export function defaultIconLibrary(): IconLibraryEntry[] {
  return BRAND_CATALOG.map((b) => ({
    id: `brand-${b.slug}`,
    name: b.name,
    category: b.category,
    color: b.color,
    defaultUrl: b.defaultUrl,
    icon: `brand:${b.slug}`,
    builtin: true,
  }));
}

export function loadIconLibrary(): IconLibraryEntry[] {
  try {
    const raw = localStorage.getItem(ICON_LIB_STORAGE_KEY);
    if (!raw) return defaultIconLibrary();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as IconLibraryEntry[];
  } catch {
    /* 忽略解析错误，回退默认 */
  }
  return defaultIconLibrary();
}

export function saveIconLibrary(list: IconLibraryEntry[]): void {
  try {
    localStorage.setItem(ICON_LIB_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 忽略存储配额错误 */
  }
  window.dispatchEvent(new CustomEvent(ICON_LIB_EVENT));
}

export function resetIconLibrary(): IconLibraryEntry[] {
  try {
    localStorage.removeItem(ICON_LIB_STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
  const defaults = defaultIconLibrary();
  window.dispatchEvent(new CustomEvent(ICON_LIB_EVENT));
  return defaults;
}
