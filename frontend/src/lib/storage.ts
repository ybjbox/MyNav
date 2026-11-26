/* 本地存储：访客统计 / 搜索历史 / 天气缓存（全部 localStorage，不上传） */

export interface VisitEntry { count: number; last: number }
export type VisitMap = Record<string, VisitEntry>;

const VISITS_KEY = "nav.visits";
const HISTORY_KEY = "nav.searchHistory";
const WEATHER_KEY = "nav.weather";
const TODOS_KEY = "nav.todos";

/* ---------- 待办（组件区，本机存储） ---------- */
export interface TodoItem { id: string; text: string; done: boolean; ts: number }

export function loadTodos(): TodoItem[] {
  try { return JSON.parse(localStorage.getItem(TODOS_KEY) || "[]") as TodoItem[]; } catch { return []; }
}
export function saveTodos(t: TodoItem[]): void {
  try { localStorage.setItem(TODOS_KEY, JSON.stringify(t.slice(0, 100))); } catch { /* 忽略 */ }
}

export interface SearchHistoryItem { q: string; engine: string; ts: number }

/* ---------- 访客统计 ---------- */
export function loadVisits(): VisitMap {
  try { return JSON.parse(localStorage.getItem(VISITS_KEY) || "{}") as VisitMap; } catch { return {}; }
}
export function recordVisit(serviceId: string): void {
  const v = loadVisits();
  const e = v[serviceId] || { count: 0, last: 0 };
  v[serviceId] = { count: e.count + 1, last: Date.now() };
  try { localStorage.setItem(VISITS_KEY, JSON.stringify(v)); } catch { /* 忽略 */ }
}

/* ---------- 搜索历史（最多 15 条，去重置顶） ---------- */
export function loadSearchHistory(): SearchHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as SearchHistoryItem[]; } catch { return []; }
}
export function addSearchHistory(q: string, engine: string): SearchHistoryItem[] {
  const list = loadSearchHistory().filter((x) => !(x.q === q && x.engine === engine));
  list.unshift({ q, engine, ts: Date.now() });
  const next = list.slice(0, 15);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
  return next;
}
export function clearSearchHistory(): SearchHistoryItem[] {
  try { localStorage.setItem(HISTORY_KEY, "[]"); } catch { /* 忽略 */ }
  return [];
}
export function removeSearchHistory(q: string, engine: string): SearchHistoryItem[] {
  const next = loadSearchHistory().filter((x) => !(x.q === q && x.engine === engine));
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
  return next;
}

/* ---------- 天气（Open-Meteo 免密钥；30 分钟缓存） ---------- */
export interface WeatherData {
  city: string;
  temp: number;
  code: number;
  dailyMax: number;
  dailyMin: number;
  fetchedAt: number;
  source?: "qweather" | "open-meteo";
}

const WEATHER_TTL = 30 * 60 * 1000;

export function loadWeatherCache(city: string): WeatherData | null {
  try {
    const d = JSON.parse(localStorage.getItem(WEATHER_KEY) || "null") as WeatherData | null;
    if (d && d.city === city && Date.now() - d.fetchedAt < WEATHER_TTL) return d;
  } catch { /* 忽略 */ }
  return null;
}
export function saveWeatherCache(d: WeatherData): void {
  try { localStorage.setItem(WEATHER_KEY, JSON.stringify(d)); } catch { /* 忽略 */ }
}

/** 天气代码 → 描述与图标键（Open-Meteo WMO codes） */
export function weatherInfo(code: number): { text: string; icon: string } {
  if (code === 0) return { text: "晴", icon: "sun" };
  if (code <= 2) return { text: "多云", icon: "cloud" };
  if (code === 3) return { text: "阴", icon: "cloud" };
  if (code === 45 || code === 48) return { text: "雾", icon: "cloud" };
  if (code >= 51 && code <= 67) return { text: "雨", icon: "up" };
  if (code >= 71 && code <= 77) return { text: "雪", icon: "cloud" };
  if (code >= 80 && code <= 82) return { text: "阵雨", icon: "up" };
  if (code >= 85 && code <= 86) return { text: "阵雪", icon: "cloud" };
  if (code >= 95) return { text: "雷雨", icon: "activity" };
  return { text: "—", icon: "globe" };
}
