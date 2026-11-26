/* 全局状态：配置、会话、监控快照、主题应用、Toast */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, isUnauthorized } from "../api/client";
import { defaultConfig, cloneConfig } from "../lib/defaultConfig";
import { mockSnapshot } from "../lib/mock";
import { wallpaperImage } from "../lib/wallpapers";
import type { NavConfig, Snapshot, HistoryResp } from "../types";

export interface Toast { id: number; text: string; err?: boolean }

interface Store {
  ready: boolean;
  authed: boolean;
  collectorConfigured: boolean;
  config: NavConfig; // 始终有值（默认或远端）
  configIsDefault: boolean;
  previewSite: Partial<NavConfig["site"]> | null;
  setPreviewSite: (p: Partial<NavConfig["site"]> | null) => void;
  admin: boolean; // 管理模式开关
  setAdmin: (v: boolean) => void;
  snapshot: Snapshot | null;
  demoMode: boolean; // 无采集器数据时用示例快照渲染
  history: Record<string, HistoryResp>; // key: device|range
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  saveConfig: (next: NavConfig) => Promise<void>;
  resetConfig: () => Promise<void>;
  refreshLatest: () => Promise<void>;
  fetchHistory: (device: string, range: string) => Promise<HistoryResp>;
  toast: (text: string, err?: boolean) => void;
  toasts: Toast[];
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("store missing");
  return s;
}

function detectTheme(pref: NavConfig["site"]["theme"]): "dark" | "light" {
  if (pref === "dark" || pref === "light") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return `rgba(67,224,160,${alpha})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function contrastInk(hex: string): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return "#ffffff";
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return lum > 0.62 ? "#0b0f14" : "#ffffff";
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [collectorConfigured, setCollectorConfigured] = useState(false);
  const [config, setConfig] = useState<NavConfig>(defaultConfig);
  const [configIsDefault, setConfigIsDefault] = useState(true);
  const [previewSite, setPreviewSite] = useState<Partial<NavConfig["site"]> | null>(null);
  const [admin, setAdmin] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [history, setHistory] = useState<Record<string, HistoryResp>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(1);

  const toast = useCallback((text: string, err?: boolean) => {
    const id = toastSeq.current++;
    setToasts((t) => [...t, { id, text, err }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  /* 主题与强调色、壁纸（支持设置抽屉实时预览） */
  useEffect(() => {
    const site = previewSite ? { ...config.site, ...previewSite } : config.site;
    const theme = detectTheme(site.theme);
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    // 壁纸：html 背景承载图片，body 渐变遮罩保证对比度；玻璃面经 has-wallpaper 加厚
    const hasWallpaper = !!(site.wallpaper && site.wallpaper !== "none");
    root.classList.toggle("has-wallpaper", hasWallpaper);
    document.body.classList.toggle("has-wallpaper-scrim", hasWallpaper);
    root.style.backgroundImage = wallpaperImage(site.wallpaper);
    root.style.backgroundSize = "cover";
    const icoSizes: Record<string, number> = { sm: 40, md: 48, lg: 56 };
    root.style.setProperty("--ico-size", (icoSizes[site.iconSize || "md"] || 48) + "px");
    root.style.setProperty("--ico-radius", (site.iconRadius ?? 12) + "px");
    root.style.backgroundPosition = "center";
    root.style.backgroundAttachment = "fixed";
    if (site.accent) {
      root.style.setProperty("--accent", site.accent);
      root.style.setProperty("--accent-ink", contrastInk(site.accent));
      root.style.setProperty("--success", site.accent);
      root.style.setProperty("--accent-dim", hexToRgba(site.accent, 0.13));
      root.style.setProperty("--accent-glow", hexToRgba(site.accent, 0.35));
    } else {
      ["--accent", "--accent-ink", "--success", "--accent-dim", "--accent-glow"].forEach((k) => root.style.removeProperty(k));
    }
    document.title = `${site.title} · 个人导航`;
  }, [config.site, previewSite]);

  /* 初始化 */
  const loadConfig = useCallback(async () => {
    const r = await api.getConfig();
    setAuthed(r.authenticated);
    // 云端旧配置可能缺少新增字段：用默认值补齐，避免 undefined
    if (r.config) {
      const merged: NavConfig = {
        ...defaultConfig,
        ...r.config,
        monitor: {
          ...defaultConfig.monitor,
          ...(r.config.monitor || {}),
          thresholds: { ...defaultConfig.monitor.thresholds, ...(r.config.monitor?.thresholds || {}) },
        },
        site: {
          ...defaultConfig.site,
          ...(r.config.site || {}),
          weather: { ...defaultConfig.site.weather, ...(r.config.site?.weather || {}) },
        },
        privacy: { ...defaultConfig.privacy, ...(r.config.privacy || {}) },
        search: { ...defaultConfig.search, ...(r.config.search || {}) },
        widgets: Array.isArray(r.config.widgets) ? r.config.widgets : defaultConfig.widgets,
      };
      setConfig(merged);
    } else {
      setConfig(defaultConfig);
    }
    setConfigIsDefault(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadConfig();
        const s = await api.session();
        setCollectorConfigured(s.collectorConfigured);
      } catch (e) {
        if (!isUnauthorized(e)) console.warn(e);
        // 401 时 config 接口已返回公开配置或抛错（全站私有场景）
        try {
          await loadConfig();
        } catch {
          setConfigIsDefault(true);
        }
      } finally {
        setReady(true);
      }
    })();
  }, [loadConfig]);

  /* 快照轮询（登录后） */
  const refreshLatest = useCallback(async () => {
    try {
      const snap = await api.latest();
      setSnapshot(snap);
      setDemoMode(false);
      setCollectorConfigured(true);
    } catch (e) {
      if (isUnauthorized(e)) {
        setAuthed(false);
        setAdmin(false);
        setSnapshot(null);
        return;
      }
      // 无数据（采集器未推送）→ 演示模式
      if ((e as Error & { status?: number }).status === 404) {
        if (collectorConfigured !== false) setCollectorConfigured(false);
        setSnapshot(mockSnapshot);
        setDemoMode(true);
      } else {
        console.warn(e);
        setDemoMode(false);
      }
    }
  }, [collectorConfigured]);

  useEffect(() => {
    if (!authed) return;
    refreshLatest();
    const t = window.setInterval(refreshLatest, 30000);
    return () => window.clearInterval(t);
  }, [authed, refreshLatest]);

  const fetchHistory = useCallback(async (device: string, range: string) => {
    const key = `${device}|${range}`;
    const cached = history[key];
    if (cached) return cached;
    const r = await api.history(device, range);
    setHistory((h) => ({ ...h, [key]: r }));
    return r;
  }, [history]);

  const login = useCallback(async (password: string) => {
    await api.login(password);
    setAuthed(true);
    await loadConfig();
    await refreshLatest();
  }, [loadConfig, refreshLatest]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setAuthed(false);
    setAdmin(false);
    setSnapshot(null);
    setDemoMode(false);
    await loadConfig();
  }, [loadConfig]);

  const saveConfig = useCallback(async (next: NavConfig) => {
    const r = await api.putConfig(next);
    setConfig({ ...next, version: r.version });
    setConfigIsDefault(false);
    toast("配置已保存");
  }, [toast]);

  const resetConfig = useCallback(async () => {
    const base = cloneConfig(defaultConfig);
    await saveConfig(base);
  }, [saveConfig]);

  const value = useMemo<Store>(
    () => ({
      ready, authed, collectorConfigured, config, configIsDefault, previewSite, setPreviewSite, admin, setAdmin,
      snapshot, demoMode, history, login, logout, saveConfig, resetConfig,
      refreshLatest, fetchHistory, toast, toasts,
    }),
    [ready, authed, collectorConfigured, config, configIsDefault, previewSite, admin, snapshot, demoMode, history,
      login, logout, saveConfig, resetConfig, refreshLatest, fetchHistory, toast, toasts],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
