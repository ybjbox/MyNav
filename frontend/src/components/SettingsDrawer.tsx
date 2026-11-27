/* 统一设置中心（WeTab / HyperOS 双栏模态框，Ant Design 控件）：外观与壁纸 / 搜索引擎 / 组件库 / 图标库 / 设备监控 / 数据管理 / 账户安全 */
import { useEffect, useState } from "react";
import { Button, ColorPicker, Input, InputNumber, Popconfirm, Segmented, Select, Switch } from "antd";
import { closestCenter, DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconX,
  IconTrash,
  IconDownload,
  IconUpload,
  IconSun,
  IconSearch,
  IconPlus,
  IconUp,
  IconDown,
  IconGrip,
  IconLayers,
  IconBox,
  IconActivity,
  IconShield,
  IconSparkles,
} from "./icons";
import { wallpapers } from "../lib/wallpapers";
import { cloneConfig, newId } from "../lib/defaultConfig";
import { useStore } from "../state/store";
import { api } from "../api/client";
import { AI_FALLBACK_MODELS, formatAiModelOption, resolveActiveModelId, type AiModelInfo, type AiUsageInfo } from "../lib/aiModels";
import { WidgetStoreModal } from "../widgets/WidgetStoreModal";
import { IconLibraryModal } from "./IconLibraryModal";
import type { NavConfig, SearchEngine, WidgetInstance, WidgetSize, WidgetType } from "../types";

export type SettingsTab = "appearance" | "search" | "widgets" | "icons" | "monitor" | "ai" | "data" | "account";

const PRESET_ENGINES: SearchEngine[] = [
  { id: "google", name: "Google", url: "https://www.google.com/search?q=%s" },
  { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=%s" },
  { id: "baidu", name: "百度", url: "https://www.baidu.com/s?wd=%s" },
  { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s" },
  { id: "github", name: "GitHub", url: "https://github.com/search?q=%s" },
  { id: "bili", name: "B站", url: "https://search.bilibili.com/all?keyword=%s" },
  { id: "zhihu", name: "知乎", url: "https://www.zhihu.com/search?type=content&q=%s" },
  { id: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/search?q=%s" },
  { id: "metaso", name: "秘塔搜索", url: "https://metaso.cn/?q=%s" },
];

const ACCENTS = [
  { name: "默认蓝", v: null },
  { name: "极光绿", v: "#0b8f5f" },
  { name: "湖青", v: "#3ec9c9" },
  { name: "天蓝", v: "#4cc9f0" },
  { name: "珊瑚", v: "#ef7b6d" },
  { name: "紫薇", v: "#9d8cff" },
  { name: "鎏金", v: "#d9a441" },
];

const DEFAULT_STALE_ALERT: NonNullable<NavConfig["monitor"]["staleAlert"]> = {
  enabled: false,
  bark: { url: "https://api.day.app", key: "" },
  telegram: { token: "", chatId: "" },
  webhook: { url: "", template: '{"title":"{{title}}","message":"{{message}}","source":"{{source}}"}' },
};

const NAV_ITEMS: { id: SettingsTab; label: string; icon: typeof IconSun; authOnly?: boolean }[] = [
  { id: "appearance", label: "外观与壁纸", icon: IconSun },
  { id: "search", label: "搜索引擎", icon: IconSearch },
  { id: "widgets", label: "组件库", icon: IconLayers },
  { id: "icons", label: "图标库", icon: IconBox },
  { id: "monitor", label: "设备监控", icon: IconActivity },
  { id: "ai", label: "AI 诊断", icon: IconSparkles, authOnly: true },
  { id: "data", label: "数据管理", icon: IconDownload },
  { id: "account", label: "账户安全", icon: IconShield },
];

function SortableEngineRow(props: {
  eng: SearchEngine;
  isDef: boolean;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onUpdate: (patch: Partial<SearchEngine>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  const { eng, isDef, isFirst, isLast, canDelete } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: eng.id });

  return (
    <div
      ref={setNodeRef}
      className="settings-row"
      style={{
        gap: 8,
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? "none" : transition,
        position: "relative",
        zIndex: isDragging ? 1 : 0,
        opacity: isDragging ? 0.28 : 1,
        background: "#ffffff",
      }}
    >
      <span
        {...attributes}
        {...listeners}
        title="拖拽排序"
        style={{ display: "inline-flex", color: isDragging ? "var(--accent)" : "#94a3b8", cursor: isDragging ? "grabbing" : "grab", flexShrink: 0, touchAction: "none" }}
      >
        <IconGrip size={15} />
      </span>
      <Input
        value={eng.name}
        onChange={(e) => props.onUpdate({ name: e.target.value })}
        placeholder="名称"
        style={{ width: 100, flexShrink: 0 }}
      />
      <Input
        value={eng.url}
        onChange={(e) => props.onUpdate({ url: e.target.value })}
        placeholder="https://example.com/search?q=%s"
        style={{ flex: 1, maxWidth: "none" }}
      />
      <Button size="small" icon={<IconUp size={12} />} disabled={isFirst} title="上移" onClick={props.onMoveUp} />
      <Button size="small" icon={<IconDown size={12} />} disabled={isLast} title="下移" onClick={props.onMoveDown} />
      <Button size="small" type={isDef ? "primary" : "default"} onClick={props.onSetDefault}>
        {isDef ? "默认" : "设为默认"}
      </Button>
      <Button
        size="small"
        danger
        icon={<IconTrash size={13} />}
        disabled={!canDelete}
        title={!canDelete ? "至少保留一个引擎" : "删除"}
        onClick={props.onRemove}
      />
    </div>
  );
}

export function SettingsDrawer(props: {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  widgets?: WidgetInstance[];
  activeConfig?: NavConfig;
  onAddWidget?: (type: WidgetType, size?: WidgetSize) => void;
  onRemoveWidget?: (id: string) => void;
  onSaved?: (saved: NavConfig) => void;
}) {
  const { config, saveConfig, resetConfig, toast, authed, username, login, logout, updateAccount, setPreviewSite } = useStore();
  const [tab, setTab] = useState<SettingsTab>(props.initialTab || "appearance");
  const [draft, setDraft] = useState<NavConfig>(config);
  const [importText, setImportText] = useState("");
  const [loginUser, setLoginUser] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [pwOld, setPwOld] = useState("");
  const [newAccUser, setNewAccUser] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [msStatus, setMsStatus] = useState<{ configured: boolean; connected: boolean; listId: string | null; listName: string | null } | null>(null);
  const [msLists, setMsLists] = useState<{ id: string; displayName: string }[]>([]);
  const [msBusy, setMsBusy] = useState(false);
  const [aiModels, setAiModels] = useState<AiModelInfo[]>([]);
  const [aiModelsSrc, setAiModelsSrc] = useState<"online" | "builtin" | null>(null);
  const [aiModelsBusy, setAiModelsBusy] = useState(false);
  const [aiUsage, setAiUsage] = useState<AiUsageInfo | null>(null);
  const [aiUsageBusy, setAiUsageBusy] = useState(false);

  const [newEngineName, setNewEngineName] = useState("");
  const [newEngineUrl, setNewEngineUrl] = useState("");
  const [activeEngineId, setActiveEngineId] = useState<string | null>(null);
  const engineSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  useEffect(() => {
    if (props.open && props.initialTab) setTab(props.initialTab);
  }, [props.open, props.initialTab]);

  useEffect(() => setDraft(config), [config]);

  // 实时预览外观设置（强调色、主题、壁纸、图标尺寸/圆角），关闭抽屉时清除未保存预览
  useEffect(() => {
    if (!props.open) {
      setPreviewSite(null);
      return;
    }
    setPreviewSite(draft.site);
    return () => setPreviewSite(null);
  }, [props.open, draft.site, setPreviewSite]);

  useEffect(() => {
    if (!props.open || !authed || tab !== "account") return;
    let cancelled = false;
    api.msTodoStatus()
      .then(async (s) => {
        if (cancelled) return;
        setMsStatus(s);
        if (s.connected) {
          const r = await api.msTodoLists().catch(() => null);
          if (!cancelled && r?.lists) setMsLists(r.lists);
        }
      })
      .catch(() => {
        if (!cancelled) setMsStatus(null);
      });
    return () => { cancelled = true; };
  }, [props.open, authed, tab]);

  useEffect(() => {
    if (!props.open || !authed || tab !== "ai") return;
    let cancelled = false;
    if (aiModels.length === 0) {
      api.aiModels()
        .then((r) => {
          if (!cancelled) {
            setAiModels(r.models || []);
            setAiModelsSrc(r.source);
          }
        })
        .catch(() => {});
    }
    api.aiUsage(false)
      .then((u) => {
        if (!cancelled) setAiUsage(u);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [props.open, authed, tab, aiModels.length]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  // 锁定 body 滚动，防止弹窗打开时底层页面跟随滚动
  useEffect(() => {
    if (!props.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [props.open]);

  if (!props.open) return null;

  const patchSite = (p: Partial<NavConfig["site"]>) => setDraft((d) => ({ ...d, site: { ...d.site, ...p } }));
  const patchMon = (p: Partial<NavConfig["monitor"]["thresholds"]>) =>
    setDraft((d) => ({ ...d, monitor: { ...d.monitor, thresholds: { ...d.monitor.thresholds, ...p } } }));
  const patchStale = (p: Partial<NonNullable<NavConfig["monitor"]["staleAlert"]>>) =>
    setDraft((d) => {
      const cur = d.monitor.staleAlert || DEFAULT_STALE_ALERT;
      return {
        ...d,
        monitor: {
          ...d.monitor,
          staleAlert: {
            ...DEFAULT_STALE_ALERT,
            ...cur,
            ...p,
            bark: { ...DEFAULT_STALE_ALERT.bark, ...cur.bark, ...(p.bark || {}) },
            telegram: { ...DEFAULT_STALE_ALERT.telegram, ...cur.telegram, ...(p.telegram || {}) },
            webhook: { ...DEFAULT_STALE_ALERT.webhook, ...cur.webhook, ...(p.webhook || {}) },
          },
        },
      };
    });

  const doSave = async () => {
    const engines = draft.search.engines
      .map((e) => ({ id: e.id.trim(), name: e.name.trim(), url: e.url.trim() }))
      .filter((e) => e.name && e.url);
    if (engines.length === 0) {
      toast("至少保留一个搜索引擎", true);
      return;
    }
    const invalid = engines.find((e) => !/^https?:\/\//i.test(e.url) || !e.url.includes("%s"));
    if (invalid) {
      toast(`搜索引擎「${invalid.name}」的 URL 需以 http(s):// 开头并包含 %s 占位符`, true);
      return;
    }
    const defaultId = engines.some((e) => e.id === draft.search.default) ? draft.search.default : engines[0].id;
    const base = props.activeConfig || config;
    const nextDraft: NavConfig = {
      ...base,
      site: draft.site,
      privacy: draft.privacy,
      search: { ...draft.search, engines, default: defaultId },
      monitor: draft.monitor,
    };
    try {
      await saveConfig(nextDraft);
      props.onSaved?.(nextDraft);
    } catch (e) {
      toast(`保存失败：${(e as Error).message}`, true);
    }
  };

  const updateEngine = (id: string, patch: Partial<SearchEngine>) => {
    setDraft((d) => ({
      ...d,
      search: {
        ...d.search,
        engines: d.search.engines.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    }));
  };

  const removeEngine = (id: string) => {
    setDraft((d) => {
      if (d.search.engines.length <= 1) return d;
      const next = d.search.engines.filter((e) => e.id !== id);
      const nextDefault = next.some((e) => e.id === d.search.default) ? d.search.default : next[0].id;
      return { ...d, search: { ...d.search, engines: next, default: nextDefault } };
    });
  };

  const addEngine = (name: string, url: string, id?: string) => {
    const n = name.trim();
    const u = url.trim();
    if (!n || !u) {
      toast("请填写搜索引擎名称和搜索地址", true);
      return;
    }
    if (!/^https?:\/\//i.test(u) || !u.includes("%s")) {
      toast("搜索地址需以 http(s):// 开头并包含 %s 占位符", true);
      return;
    }
    setDraft((d) => {
      const eid = id || newId("eng");
      if (d.search.engines.some((e) => e.id === eid)) return d;
      return {
        ...d,
        search: { ...d.search, engines: [...d.search.engines, { id: eid, name: n, url: u }] },
      };
    });
    setNewEngineName("");
    setNewEngineUrl("");
  };

  const reorderEngine = (fromIdx: number, toIdx: number) => {
    setDraft((d) => {
      const list = d.search.engines;
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length || fromIdx === toIdx) return d;
      return { ...d, search: { ...d.search, engines: arrayMove(list, fromIdx, toIdx) } };
    });
  };

  const onEngineDragStart = (e: DragStartEvent) => {
    setActiveEngineId(String(e.active.id));
  };

  const onEngineDragEnd = (e: DragEndEvent) => {
    setActiveEngineId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = draft.search.engines.findIndex((x) => x.id === active.id);
    const newIdx = draft.search.engines.findIndex((x) => x.id === over.id);
    if (oldIdx >= 0 && newIdx >= 0) reorderEngine(oldIdx, newIdx);
  };

  const doImport = async () => {
    try {
      const parsed = JSON.parse(importText) as NavConfig;
      if (!parsed.groups || !parsed.site) throw new Error("格式不符");
      await saveConfig(parsed);
      setImportText("");
    } catch (e) {
      toast(`导入失败：${(e as Error).message}`, true);
    }
  };

  const doExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nav-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    if (username && !newAccUser) setNewAccUser(username);
  }, [username, newAccUser]);

  const doChangeAccount = async () => {
    const trimmedUser = newAccUser.trim();
    const userChanged = !!trimmedUser && trimmedUser !== (username || "");
    if (!pwOld) { toast("请输入当前密码", true); return; }
    if (!userChanged && !pwNew) { toast("请填写新账号或新密码", true); return; }
    if (pwNew && pwNew !== pwNew2) { toast("两次输入的新密码不一致", true); return; }
    if (pwNew && pwNew.length < 6) { toast("新密码至少 6 位", true); return; }
    try {
      const nextName = await updateAccount({
        currentPassword: pwOld,
        ...(userChanged ? { newUsername: trimmedUser } : {}),
        ...(pwNew ? { newPassword: pwNew } : {}),
      });
      setNewAccUser(nextName);
      toast("账号凭据已更新");
      setPwOld(""); setPwNew(""); setPwNew2("");
    } catch (e) {
      toast(`修改失败：${(e as Error).message}`, true);
    }
  };

  const th = draft.monitor.thresholds;
  const sa: NonNullable<NavConfig["monitor"]["staleAlert"]> = {
    ...DEFAULT_STALE_ALERT,
    ...(draft.monitor.staleAlert || {}),
    bark: { ...DEFAULT_STALE_ALERT.bark, ...(draft.monitor.staleAlert?.bark || {}) },
    telegram: { ...DEFAULT_STALE_ALERT.telegram, ...(draft.monitor.staleAlert?.telegram || {}) },
    webhook: { ...DEFAULT_STALE_ALERT.webhook, ...(draft.monitor.staleAlert?.webhook || {}) },
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === tab);

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="modal settings-modal">
        <div className="settings-shell">
          <aside className="settings-nav" aria-label="设置分类">
            <div className="settings-nav-title">设置</div>
            <div className="settings-nav-list">
              {NAV_ITEMS.filter((n) => !n.authOnly || authed).map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`settings-nav-item${tab === n.id ? " on" : ""}`}
                    aria-current={tab === n.id ? "page" : undefined}
                    onClick={() => setTab(n.id)}
                  >
                    <Icon size={15} />
                    <span>{n.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="settings-body">
            <div className="settings-head">
              <span className="t">{activeNav?.label || "设置"}</span>
              <button className="iconbtn close" aria-label="关闭" onClick={props.onClose}>
                <IconX size={16} />
              </button>
            </div>

            <div className="settings-body-scroll">
              {tab === "appearance" && (
                <>
                  <div className="settings-card">
                    <div className="settings-row">
                      <label>站点标题</label>
                      <Input
                        value={draft.site.title}
                        onChange={(e) => patchSite({ title: e.target.value })}
                        style={{ maxWidth: 240 }}
                      />
                    </div>
                    <div className="settings-row">
                      <label>主题</label>
                      <Segmented
                        value={draft.site.theme}
                        onChange={(v) => patchSite({ theme: v as NavConfig["site"]["theme"] })}
                        options={[
                          { label: "深色", value: "dark" },
                          { label: "浅色", value: "light" },
                          { label: "跟随系统", value: "auto" },
                        ]}
                      />
                    </div>
                    <div className="settings-row">
                      <label>强调色</label>
                      <div className="swatches">
                        {ACCENTS.map((a) => (
                          <button
                            key={a.name}
                            type="button"
                            className={`swatch${(draft.site.accent ?? null) === a.v ? " on" : ""}`}
                            style={{ background: a.v ?? "#3261e3" }}
                            title={a.name}
                            aria-label={`强调色 ${a.name}`}
                            onClick={() => patchSite({ accent: a.v })}
                          />
                        ))}
                        <ColorPicker
                          value={draft.site.accent || "#3261e3"}
                          disabledAlpha
                          showText={(c) => c.toHexString().toUpperCase()}
                          presets={[
                            {
                              label: "推荐强调色",
                              colors: ["#3261e3", "#0b8f5f", "#43e0a0", "#3ec9c9", "#4cc9f0", "#ef7b6d", "#9d8cff", "#d9a441", "#ff6b9d"],
                            },
                          ]}
                          onChange={(c) => patchSite({ accent: c.toHexString() })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-block" style={{ padding: "14px 18px", borderBottom: "1px solid rgba(16,26,36,0.06)" }}>
                      <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#1e293b", marginBottom: 10 }}>壁纸</label>
                      <div className="wp-grid">
                        {wallpapers.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            className={`wp${(draft.site.wallpaper ?? "none") === w.id ? " on" : ""}`}
                            style={{ background: w.css || "var(--surface)", backgroundSize: w.id === "grid" ? "12px 12px" : undefined }}
                            title={w.name}
                            aria-label={`壁纸 ${w.name}`}
                            onClick={() => patchSite({ wallpaper: w.id === "none" ? null : w.id })}
                          />
                        ))}
                      </div>
                      <Input
                        value={/^https?:/.test(draft.site.wallpaper || "") ? draft.site.wallpaper! : ""}
                        onChange={(e) => patchSite({ wallpaper: e.target.value || null })}
                        placeholder="或粘贴壁纸图片 URL（可选）"
                        style={{ marginTop: 10 }}
                      />
                    </div>
                    <div className="settings-row">
                      <label>卡片图标尺寸与圆角</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Segmented
                          value={draft.site.iconSize}
                          onChange={(v) => patchSite({ iconSize: v as NavConfig["site"]["iconSize"] })}
                          options={[
                            { label: "紧凑", value: "sm" },
                            { label: "标准", value: "md" },
                            { label: "大", value: "lg" },
                          ]}
                        />
                        <InputNumber
                          min={4}
                          max={20}
                          value={draft.site.iconRadius}
                          onChange={(v) => patchSite({ iconRadius: Number(v) || 12 })}
                          title="图标块圆角 px"
                          style={{ width: 76 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-block" style={{ padding: "14px 18px", borderBottom: "1px solid rgba(16,26,36,0.06)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                        <label style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>天气小组件</label>
                        <Switch
                          checked={draft.site.weather.enabled}
                          onChange={(checked) => patchSite({ weather: { ...draft.site.weather, enabled: checked } })}
                        />
                      </div>
                      {draft.site.weather.enabled && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Input
                              value={draft.site.weather.city}
                              onChange={(e) => patchSite({ weather: { ...draft.site.weather, city: e.target.value } })}
                              placeholder="城市名（如：深圳）"
                              style={{ flex: 1 }}
                            />
                            <Select
                              value={draft.site.weather.provider}
                              onChange={(v) => patchSite({ weather: { ...draft.site.weather, provider: v } })}
                              options={[
                                { label: "Open-Meteo（免密钥）", value: "open-meteo" },
                                { label: "和风天气（国内更准）", value: "qweather" },
                              ]}
                              style={{ width: 200 }}
                            />
                          </div>
                          {draft.site.weather.provider === "qweather" && (
                            <>
                              <Input
                                value={draft.site.weather.qweatherHost}
                                onChange={(e) => patchSite({ weather: { ...draft.site.weather, qweatherHost: e.target.value.trim() } })}
                                placeholder="和风专属 API Host（Console→设置，如 abc123.re.qweather.com）"
                              />
                              <Input.Password
                                value={draft.site.weather.qweatherKey}
                                onChange={(e) => patchSite({ weather: { ...draft.site.weather, qweatherKey: e.target.value.trim() } })}
                                placeholder="和风 API Key"
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="settings-row">
                      <label>未登录访客可看导航卡片（关闭 = 全站需登录）</label>
                      <Switch
                        checked={draft.privacy.publicNav}
                        onChange={(checked) => setDraft((d) => ({ ...d, privacy: { publicNav: checked } }))}
                      />
                    </div>
                  </div>

                  <div className="formfoot">
                    <Button onClick={() => setDraft(cloneConfig(config))}>还原</Button>
                    <Button type="primary" onClick={doSave}>保存设置</Button>
                  </div>
                </>
              )}

              {tab === "search" && (
                <>
                  <div className="settings-card">
                    <div className="settings-row">
                      <label>默认搜索引擎</label>
                      <Select
                        value={draft.search.default}
                        onChange={(v) => setDraft((d) => ({ ...d, search: { ...d.search, default: v } }))}
                        options={draft.search.engines.map((e) => ({ label: e.name || e.id, value: e.id }))}
                        style={{ width: 180 }}
                      />
                    </div>
                    <div className="settings-row">
                      <label>搜索框样式</label>
                      <Segmented
                        value={draft.search.style}
                        onChange={(v) => setDraft((d) => ({ ...d, search: { ...d.search, style: v as NavConfig["search"]["style"] } }))}
                        options={[
                          { label: "标准", value: "default" },
                          { label: "紧凑", value: "compact" },
                          { label: "隐藏", value: "hidden" },
                        ]}
                      />
                    </div>
                    <div className="settings-row">
                      <label>搜索历史（本机存储，最多 15 条）</label>
                      <Switch
                        checked={draft.search.history}
                        onChange={(checked) => setDraft((d) => ({ ...d, search: { ...d.search, history: checked } }))}
                      />
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-card-title">已配置的搜索引擎（搜索词用 %s 代替，拖拽手柄或点击箭头调整顺序）</div>
                    <DndContext
                      sensors={engineSensors}
                      collisionDetection={closestCenter}
                      onDragStart={onEngineDragStart}
                      onDragEnd={onEngineDragEnd}
                      onDragCancel={() => setActiveEngineId(null)}
                    >
                      <SortableContext items={draft.search.engines.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                        {draft.search.engines.map((eng, idx) => (
                          <SortableEngineRow
                            key={eng.id}
                            eng={eng}
                            isDef={draft.search.default === eng.id}
                            isFirst={idx === 0}
                            isLast={idx === draft.search.engines.length - 1}
                            canDelete={draft.search.engines.length > 1}
                            onUpdate={(patch) => updateEngine(eng.id, patch)}
                            onMoveUp={() => reorderEngine(idx, idx - 1)}
                            onMoveDown={() => reorderEngine(idx, idx + 1)}
                            onSetDefault={() => setDraft((d) => ({ ...d, search: { ...d.search, default: eng.id } }))}
                            onRemove={() => removeEngine(eng.id)}
                          />
                        ))}
                      </SortableContext>
                      <DragOverlay dropAnimation={null}>
                        {activeEngineId ? (() => {
                          const eng = draft.search.engines.find((x) => x.id === activeEngineId);
                          if (!eng) return null;
                          const isDef = draft.search.default === eng.id;
                          return (
                            <div
                              className="settings-row"
                              style={{
                                gap: 8,
                                pointerEvents: "none",
                                background: "#ffffff",
                                borderRadius: 12,
                                border: "1.5px solid var(--accent)",
                                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.18)",
                                transform: "scale(1.015)",
                                cursor: "grabbing",
                              }}
                            >
                              <span style={{ display: "inline-flex", color: "var(--accent)", flexShrink: 0 }}>
                                <IconGrip size={15} />
                              </span>
                              <Input value={eng.name} readOnly style={{ width: 100, flexShrink: 0 }} />
                              <Input value={eng.url} readOnly style={{ flex: 1, maxWidth: "none" }} />
                              <Button size="small" icon={<IconUp size={12} />} />
                              <Button size="small" icon={<IconDown size={12} />} />
                              <Button size="small" type={isDef ? "primary" : "default"}>
                                {isDef ? "默认" : "设为默认"}
                              </Button>
                              <Button size="small" danger icon={<IconTrash size={13} />} />
                            </div>
                          );
                        })() : null}
                      </DragOverlay>
                    </DndContext>

                    <div className="settings-block" style={{ borderTop: "1px solid rgba(16,26,36,0.06)" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}>添加自定义引擎</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Input
                          value={newEngineName}
                          onChange={(e) => setNewEngineName(e.target.value)}
                          placeholder="名称（如：小红书）"
                          style={{ width: 130 }}
                        />
                        <Input
                          value={newEngineUrl}
                          onChange={(e) => setNewEngineUrl(e.target.value)}
                          placeholder="搜索地址（需包含 %s，如 https://www.google.com/search?q=%s）"
                          style={{ flex: 1, minWidth: 220 }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addEngine(newEngineName, newEngineUrl);
                            }
                          }}
                        />
                        <Button
                          type="primary"
                          icon={<IconPlus size={14} />}
                          onClick={() => addEngine(newEngineName, newEngineUrl)}
                        >
                          添加
                        </Button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>快捷预设：</span>
                        {PRESET_ENGINES.filter((p) => !draft.search.engines.some((e) => e.id === p.id)).map((p) => (
                          <Button
                            key={p.id}
                            size="small"
                            onClick={() => addEngine(p.name, p.url, p.id)}
                          >
                            + {p.name}
                          </Button>
                        ))}
                        {PRESET_ENGINES.every((p) => draft.search.engines.some((e) => e.id === p.id)) && (
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>已全部添加</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="formfoot">
                    <Button onClick={() => setDraft(cloneConfig(config))}>还原</Button>
                    <Button type="primary" onClick={doSave}>保存设置</Button>
                  </div>
                </>
              )}

              {tab === "widgets" && (
                authed && props.onAddWidget && props.onRemoveWidget ? (
                  <WidgetStoreModal
                    embedded
                    widgets={props.widgets ?? config.widgets ?? []}
                    onAdd={props.onAddWidget}
                    onRemove={props.onRemoveWidget}
                    onClose={props.onClose}
                  />
                ) : (
                  <div className="settings-card">
                    <div className="settings-block" style={{ textAlign: "center", padding: "32px 18px" }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>登录后可添加或移除桌面组件</div>
                      <div className="formhint" style={{ marginBottom: 14 }}>请先在「账户安全」中登录管理员账户，组件布局将自动同步到云端。</div>
                      <Button type="primary" onClick={() => setTab("account")}>前往登录</Button>
                    </div>
                  </div>
                )
              )}

              {tab === "icons" && (
                <IconLibraryModal embedded onClose={props.onClose} />
              )}

              {tab === "monitor" && (
                <>
                  <div className="formhint" style={{ marginBottom: 10 }}>阈值同时用于界面高亮与采集器告警推送</div>
                  <div className="settings-card">
                    <div className="settings-row">
                      <label>CPU 告警阈值（%）</label>
                      <InputNumber min={1} max={100} value={th.cpu} onChange={(v) => patchMon({ cpu: Number(v) || 0 })} />
                    </div>
                    <div className="settings-row">
                      <label>内存告警阈值（%）</label>
                      <InputNumber min={1} max={100} value={th.mem} onChange={(v) => patchMon({ mem: Number(v) || 0 })} />
                    </div>
                    <div className="settings-row">
                      <label>磁盘告警阈值（%）</label>
                      <InputNumber min={1} max={100} value={th.disk} onChange={(v) => patchMon({ disk: Number(v) || 0 })} />
                    </div>
                    <div className="settings-row">
                      <label>离线判定（连续失败次数）</label>
                      <InputNumber min={1} max={60} value={th.downMinutes} onChange={(v) => patchMon({ downMinutes: Number(v) || 1 })} />
                    </div>
                    <div className="settings-row">
                      <label>温度告警阈值（°C）</label>
                      <InputNumber min={20} max={120} value={th.temp} onChange={(v) => patchMon({ temp: Number(v) || 0 })} />
                    </div>
                    <div className="settings-row">
                      <label>连接数告警阈值（conntrack / Clash 连接）</label>
                      <InputNumber min={100} step={1000} value={th.conn} onChange={(v) => patchMon({ conn: Number(v) || 0 })} />
                    </div>
                    <div className="settings-row">
                      <label>迷你曲线窗口（分钟）</label>
                      <InputNumber
                        min={5}
                        max={120}
                        value={draft.monitor.sparkMinutes}
                        onChange={(v) => setDraft((d) => ({ ...d, monitor: { ...d.monitor, sparkMinutes: Number(v) || 30 } }))}
                      />
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-block" style={{ padding: "14px 18px", borderBottom: sa.enabled ? "1px solid rgba(16,26,36,0.06)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>失联告警（云端 Cron）</div>
                          <div className="formhint" style={{ marginTop: 2 }}>
                            采集器停止推送超过 10 分钟时，由 Cloudflare Workers 定时任务直接推送通知；恢复时推送"已恢复"
                          </div>
                        </div>
                        <Switch checked={sa.enabled} onChange={(checked) => patchStale({ enabled: checked })} />
                      </div>
                    </div>
                    {sa.enabled && (
                      <>
                        <div className="settings-row">
                          <label>Bark（iOS）</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Input value={sa.bark.url} onChange={(e) => patchStale({ bark: { ...sa.bark, url: e.target.value } })} placeholder="https://api.day.app" />
                            <Input value={sa.bark.key} onChange={(e) => patchStale({ bark: { ...sa.bark, key: e.target.value } })} placeholder="设备 key" />
                          </div>
                        </div>
                        <div className="settings-row">
                          <label>Telegram Bot</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Input value={sa.telegram.token} onChange={(e) => patchStale({ telegram: { ...sa.telegram, token: e.target.value } })} placeholder="bot token" />
                            <Input value={sa.telegram.chatId} onChange={(e) => patchStale({ telegram: { ...sa.telegram, chatId: e.target.value } })} placeholder="chat id" />
                          </div>
                        </div>
                        <div className="settings-row">
                          <label>通用 Webhook URL</label>
                          <Input value={sa.webhook.url} onChange={(e) => patchStale({ webhook: { ...sa.webhook, url: e.target.value } })} placeholder="https://…" style={{ maxWidth: 260 }} />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="formfoot">
                    <Button onClick={() => setDraft(cloneConfig(config))}>还原</Button>
                    <Button type="primary" onClick={doSave}>保存设置</Button>
                  </div>
                </>
              )}

              {tab === "ai" && (
                (() => {
                  const catalog = aiModels.length > 0 ? aiModels : AI_FALLBACK_MODELS;
                  const activeId = resolveActiveModelId(draft.monitor.aiModel);
                  const selectedModel = catalog.find((m) => m.id === activeId);
                  const limit = aiUsage?.dailyFreeLimit || 10000;
                  const used = aiUsage?.todayNeurons ?? 0;
                  const pct = Math.min(100, Math.round((used / limit) * 1000) / 10);
                  const barColor = pct >= 85 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#10b981";
                  const compareList = catalog.filter((m) => !m.paidOnly && typeof m.outputUsdPerM === "number").slice(0, 8);
                  const fmtCtx = (cw?: number) =>
                    !cw ? "—" : cw >= 1_000_000 ? `${Math.round(cw / 1024 / 1024)}M` : `${Math.round(cw / 1024)}K`;

                  return (
                    <>
                      <div className="settings-card">
                        <div className="settings-block" style={{ padding: "14px 18px", borderBottom: "1px solid rgba(16,26,36,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>今日 Workers AI 额度（UTC）</div>
                            <div className="formhint" style={{ marginTop: 2 }}>
                              {aiUsage?.available
                                ? `统计日期 UTC ${aiUsage.dateUtc} · 免费额度每日 ${limit.toLocaleString()} Neurons`
                                : aiUsage?.reason
                                  ? `暂无法读取账号用量：${aiUsage.reason}`
                                  : "正在读取 Cloudflare Workers AI 今日用量…"}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Button
                              size="small"
                              loading={aiUsageBusy}
                              onClick={async () => {
                                setAiUsageBusy(true);
                                try {
                                  const u = await api.aiUsage(true);
                                  setAiUsage(u);
                                } catch (e) {
                                  toast(`刷新额度失败：${(e as Error).message}`, true);
                                } finally {
                                  setAiUsageBusy(false);
                                }
                              }}
                            >
                              刷新额度
                            </Button>
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => {
                                props.onClose();
                                window.dispatchEvent(new CustomEvent("nav:open-ai"));
                              }}
                            >
                              打开 AI 诊断
                            </Button>
                          </div>
                        </div>

                        {aiUsage?.available && (
                          <div className="settings-block" style={{ padding: "14px 18px", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13 }}>
                              <span>
                                已用 <strong style={{ color: "#0f172a", fontSize: 15 }}>{used}</strong> / {limit.toLocaleString()} Neurons
                                <span style={{ color: "#64748b", marginLeft: 8 }}>({pct}%)</span>
                              </span>
                              <span style={{ color: "#64748b", fontSize: 12 }}>
                                今日 {aiUsage.requests || 0} 次 · 入 {(aiUsage.inputTokens || 0).toLocaleString()} / 出 {(aiUsage.outputTokens || 0).toLocaleString()} tokens
                              </span>
                            </div>
                            <div style={{ height: 7, borderRadius: 999, background: "rgba(15, 23, 42, 0.08)", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: barColor, transition: "width 0.3s ease" }} />
                            </div>
                            {aiUsage.byModel && aiUsage.byModel.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                                {aiUsage.byModel.map((row) => (
                                  <span
                                    key={row.modelId}
                                    style={{
                                      fontSize: 11.5,
                                      padding: "3px 8px",
                                      borderRadius: 999,
                                      background: "rgba(15, 23, 42, 0.04)",
                                      border: "1px solid rgba(15, 23, 42, 0.07)",
                                      color: "#334155",
                                    }}
                                  >
                                    {row.modelId.replace(/^@(?:cf|hf)\/[^/]+\//, "")}: {row.neurons} N ({row.requests}次)
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="settings-card">
                        <div className="settings-block" style={{ padding: "14px 18px", borderBottom: "1px solid rgba(16,26,36,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                              诊断模型配置
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  padding: "1px 7px",
                                  borderRadius: 999,
                                  background: aiModelsSrc === "online" ? "rgba(16, 185, 129, 0.12)" : "rgba(100, 116, 139, 0.12)",
                                  color: aiModelsSrc === "online" ? "#059669" : "#475569",
                                }}
                              >
                                {aiModelsSrc === "online" ? `在线目录 (${catalog.length})` : "内置精选"}
                              </span>
                            </div>
                            <div className="formhint" style={{ marginTop: 2 }}>
                              主界面小组件与「一键 AI 诊断」将默认使用这里选定的模型（基准 1.0x = 输出 $0.40/M）
                            </div>
                          </div>
                          <Button
                            size="small"
                            loading={aiModelsBusy}
                            onClick={async () => {
                              setAiModelsBusy(true);
                              try {
                                const r = await api.aiModels(true);
                                setAiModels(r.models || []);
                                setAiModelsSrc(r.source);
                                toast(r.source === "online" ? `已在线获取 ${r.models.length} 个可用模型` : "已刷新内置模型列表");
                              } catch (e) {
                                toast(`获取失败：${(e as Error).message}`, true);
                              } finally {
                                setAiModelsBusy(false);
                              }
                            }}
                          >
                            在线刷新模型
                          </Button>
                        </div>

                        <div className="settings-row">
                          <div>
                            <label>默认诊断模型</label>
                            <div className="sr-desc">{activeId}</div>
                          </div>
                          <Select
                            showSearch
                            optionFilterProp="label"
                            value={activeId}
                            style={{ minWidth: 260, maxWidth: 380 }}
                            options={catalog.map(formatAiModelOption)}
                            onChange={(v) => setDraft((d) => ({ ...d, monitor: { ...d.monitor, aiModel: v } }))}
                          />
                        </div>

                        <div className="settings-row">
                          <div>
                            <label>思考推理档位</label>
                            <div className="sr-desc">
                              {selectedModel?.reasoning === false
                                ? "当前所选模型为直出模式（无推理档位差异）；仅推理模型按此档位运行"
                                : "默认高档位推理更透彻但耗时更长；中/低档位更快且更省 Neurons"}
                            </div>
                          </div>
                          <Segmented
                            value={draft.monitor.aiReasoningEffort || "high"}
                            onChange={(v) =>
                              setDraft((d) => ({
                                ...d,
                                monitor: { ...d.monitor, aiReasoningEffort: v as "low" | "medium" | "high" },
                              }))
                            }
                            options={[
                              { label: "高（默认）", value: "high" },
                              { label: "中（均衡）", value: "medium" },
                              { label: "低（快速）", value: "low" },
                            ]}
                          />
                        </div>

                        {selectedModel && (
                          <div className="settings-block" style={{ padding: "12px 18px", borderBottom: compareList.length > 0 ? "1px solid rgba(16,26,36,0.06)" : "none", background: "rgba(248, 250, 252, 0.7)" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12, color: "#334155" }}>
                              <span>上下文：<strong>{fmtCtx(selectedModel.contextWindow)}</strong></span>
                              {typeof selectedModel.inputUsdPerM === "number" && (
                                <span>输入：<strong>${selectedModel.inputUsdPerM}/M</strong> ({selectedModel.inputNeuronsPer1K ?? "—"} N/1K)</span>
                              )}
                              {typeof selectedModel.outputUsdPerM === "number" && (
                                <span>输出：<strong>${selectedModel.outputUsdPerM}/M</strong> ({selectedModel.outputNeuronsPer1K ?? "—"} N/1K)</span>
                              )}
                              {typeof selectedModel.costMultiplier === "number" && (
                                <span>消耗倍数：<strong>{selectedModel.costMultiplier}x</strong></span>
                              )}
                              <span>{selectedModel.reasoning ? "深度推理（耗时较长）" : "直出响应（快速）"}</span>
                              <span style={{ color: selectedModel.paidOnly ? "#dc2626" : "#059669", fontWeight: 600 }}>
                                {selectedModel.paidOnly ? "需 Workers Paid" : "免费额度可用"}
                              </span>
                            </div>
                          </div>
                        )}

                        {compareList.length > 0 && (
                          <div className="settings-block" style={{ padding: "12px 18px", gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>免费可用模型快速切换与消耗对比</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                              {compareList.map((m) => {
                                const on = m.id === activeId;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setDraft((d) => ({ ...d, monitor: { ...d.monitor, aiModel: m.id } }))}
                                    style={{
                                      textAlign: "left",
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      cursor: "pointer",
                                      background: on ? "var(--accent-dim)" : "#fff",
                                      border: on ? "1px solid var(--accent)" : "1px solid rgba(15, 23, 42, 0.09)",
                                      color: "#0f172a",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                                      <span style={{ fontSize: 11, color: (m.costMultiplier || 1) <= 1.5 ? "#059669" : "#d97706", flexShrink: 0 }}>
                                        {m.costMultiplier}x
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                      {fmtCtx(m.contextWindow)} · 出 ${m.outputUsdPerM}/M · {m.reasoning ? "推理" : "快速"}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="formfoot">
                        <Button onClick={() => setDraft(cloneConfig(config))}>还原</Button>
                        <Button type="primary" onClick={doSave}>保存设置</Button>
                      </div>
                    </>
                  );
                })()
              )}

              {tab === "data" && (
                <>
                  <div className="settings-card">
                    <div className="settings-row">
                      <label>导出配置</label>
                      <Button icon={<IconDownload size={14} />} onClick={doExport}>下载 nav-config.json</Button>
                    </div>
                    <div className="settings-block" style={{ padding: "14px 18px" }}>
                      <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#1e293b", marginBottom: 8 }}>导入配置（粘贴 JSON）</label>
                      <Input.TextArea
                        rows={4}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder='{"site": …, "groups": […]}'
                      />
                      <Button style={{ marginTop: 8 }} icon={<IconUpload size={14} />} disabled={!importText.trim()} onClick={doImport}>
                        导入并保存
                      </Button>
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-row">
                      <label>危险操作</label>
                      <Popconfirm
                        title="确定恢复默认配置？"
                        description="当前所有分组和卡片配置将被覆盖。"
                        okText="确定恢复"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={async () => {
                          await resetConfig();
                          toast("已恢复默认配置");
                        }}
                      >
                        <Button danger icon={<IconTrash size={14} />}>
                          恢复默认配置
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </>
              )}

              {tab === "account" && !authed && (
                <form
                  className="settings-card"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!loginUser.trim() || !loginPw) return;
                    setLoginBusy(true);
                    setLoginErr("");
                    try {
                      await login(loginUser.trim(), loginPw);
                      setLoginUser("");
                      setLoginPw("");
                      toast("已登录");
                    } catch (ex) {
                      setLoginErr((ex as Error).message || "登录失败");
                    } finally {
                      setLoginBusy(false);
                    }
                  }}
                >
                  <div className="settings-block" style={{ padding: "12px 18px", borderBottom: "1px solid rgba(16,26,36,0.06)" }}>
                    <div className="formhint">使用账号与密码登录后，可编辑导航、调整桌面组件与查看设备监控及告警</div>
                  </div>
                  {loginErr && (
                    <div className="settings-block" style={{ padding: "10px 18px 0" }}>
                      <div className="formerr" style={{ margin: 0 }}>{loginErr}</div>
                    </div>
                  )}
                  <div className="settings-row">
                    <label htmlFor="settings-lg-user">账号</label>
                    <Input
                      id="settings-lg-user"
                      autoComplete="username"
                      placeholder="请输入登录账号"
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                      style={{ maxWidth: 240 }}
                    />
                  </div>
                  <div className="settings-row">
                    <label htmlFor="settings-lg-pw">密码</label>
                    <Input.Password
                      id="settings-lg-pw"
                      autoComplete="current-password"
                      placeholder="请输入登录密码"
                      value={loginPw}
                      onChange={(e) => setLoginPw(e.target.value)}
                      style={{ maxWidth: 240 }}
                    />
                  </div>
                  <div className="settings-block" style={{ padding: "14px 18px" }}>
                    <div className="formfoot" style={{ margin: 0 }}>
                      <Button type="primary" htmlType="submit" loading={loginBusy} disabled={!loginUser.trim() || !loginPw}>登录</Button>
                    </div>
                  </div>
                </form>
              )}

              {tab === "account" && authed && (
                <>
                  <div className="settings-card">
                    <div className="settings-block" style={{ padding: "14px 18px", borderBottom: "1px solid rgba(16,26,36,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Microsoft To Do 多端同步</div>
                        <div className="formhint" style={{ margin: "2px 0 0" }}>
                          {msStatus === null
                            ? "正在检查连接状态…"
                            : !msStatus.configured
                              ? "需在 Cloudflare Secrets 配置 MS_CLIENT_ID 与 MS_CLIENT_SECRET"
                              : msStatus.connected
                                ? `已连接微软账户${msStatus.listName ? `（默认清单：${msStatus.listName}）` : ""}`
                                : "未连接，连接后桌面待办卡片将与微软 To Do 实时双向同步"}
                        </div>
                      </div>
                      {msStatus?.connected ? (
                        <Button
                          size="small"
                          danger
                          loading={msBusy}
                          onClick={async () => {
                            setMsBusy(true);
                            try {
                              await api.msTodoDisconnect();
                              setMsStatus((prev) => (prev ? { ...prev, connected: false, listId: null, listName: null } : prev));
                              setMsLists([]);
                              toast("已断开 Microsoft To Do");
                            } catch (e) {
                              toast(`断开失败：${(e as Error).message}`, true);
                            } finally {
                              setMsBusy(false);
                            }
                          }}
                        >
                          断开连接
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          type="primary"
                          loading={msBusy}
                          disabled={!msStatus?.configured}
                          onClick={async () => {
                            setMsBusy(true);
                            try {
                              const { url } = await api.msTodoAuthUrl();
                              window.location.href = url;
                            } catch (e) {
                              toast(`无法获取授权链接：${(e as Error).message}`, true);
                              setMsBusy(false);
                            }
                          }}
                        >
                          连接微软账号
                        </Button>
                      )}
                    </div>
                    {msStatus?.connected && msLists.length > 0 && (
                      <div className="settings-row">
                        <label>默认同步清单</label>
                        <Select
                          value={msStatus.listId || msLists[0]?.id}
                          style={{ minWidth: 200 }}
                          options={msLists.map((l) => ({ label: l.displayName, value: l.id }))}
                          onChange={async (id) => {
                            const found = msLists.find((l) => l.id === id);
                            const name = found?.displayName || "任务";
                            try {
                              await api.msTodoSelectList(id, name);
                              setMsStatus((prev) => (prev ? { ...prev, listId: id, listName: name } : prev));
                              toast(`默认清单已切换为「${name}」`);
                            } catch (e) {
                              toast(`切换失败：${(e as Error).message}`, true);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="settings-card">
                    <div className="settings-block" style={{ padding: "12px 18px", borderBottom: "1px solid rgba(16,26,36,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div className="formhint" style={{ margin: 0 }}>
                        当前账号：<strong style={{ color: "#0f172a" }}>{username || "admin"}</strong>（采集器亦使用账号密码登录换取短期令牌）
                      </div>
                      <Button
                        size="small"
                        danger
                        onClick={async () => {
                          await logout();
                          toast("已退出登录");
                        }}
                      >
                        退出登录
                      </Button>
                    </div>
                    <div className="settings-row">
                      <label>当前密码</label>
                      <Input.Password value={pwOld} onChange={(e) => setPwOld(e.target.value)} placeholder="验证当前密码" style={{ maxWidth: 240 }} />
                    </div>
                    <div className="settings-row">
                      <label>账号名称</label>
                      <Input value={newAccUser} onChange={(e) => setNewAccUser(e.target.value)} placeholder="2-32 位字母数字或 ._-" style={{ maxWidth: 240 }} />
                    </div>
                    <div className="settings-row">
                      <label>新密码（可选，≥6 位）</label>
                      <Input.Password value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="不改密码请留空" style={{ maxWidth: 240 }} />
                    </div>
                    <div className="settings-row">
                      <label>确认新密码</label>
                      <Input.Password value={pwNew2} onChange={(e) => setPwNew2(e.target.value)} placeholder="再次输入新密码" style={{ maxWidth: 240 }} />
                    </div>
                    <div className="settings-block" style={{ padding: "14px 18px" }}>
                      <div className="formfoot" style={{ margin: 0 }}>
                        <Button
                          type="primary"
                          disabled={!pwOld || (!pwNew && (!newAccUser.trim() || newAccUser.trim() === (username || "")))}
                          onClick={doChangeAccount}
                        >
                          保存账号设置
                        </Button>
                      </div>
                      <div className="formhint" style={{ marginTop: 10 }}>
                        修改后旧网页会话与采集器旧令牌会自动失效；若路由器采集器使用同一账号密码，请在 LuCI 同步更新后重启采集器。
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
