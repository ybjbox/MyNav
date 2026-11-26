import React, { Suspense, lazy, useCallback, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { AppStoreProvider, useStore } from "./state/store";
import { Hero } from "./components/Hero";
import { ContextMenu, type MenuItem } from "./components/ContextMenu";
import { isFolder, FolderPopup } from "./components/ServiceCard";
import { AlertBar } from "./components/AlertBar";
import { ServiceCard } from "./components/ServiceCard";
import { SideRail } from "./components/SideRail";
import { WidgetsSection, WidgetDragPreview } from "./widgets/WidgetsSection";
import type { SettingsTab } from "./components/SettingsDrawer";
import type { GroupDialogState } from "./components/GroupModal";
import { IconGrip, IconPlus, IconEdit, IconCheck, IconActivity, IconExternalLink, IconCopy, IconFolder, IconMore } from "./components/icons";

const LazyAntdShell = lazy(() => import("./components/AntdShell"));
const LazyTrendModal = lazy(() => import("./components/TrendModal").then((m) => ({ default: m.TrendModal })));
const LazyAlertsDrawer = lazy(() => import("./components/AlertsDrawer").then((m) => ({ default: m.AlertsDrawer })));
const LazySettingsDrawer = lazy(() => import("./components/SettingsDrawer").then((m) => ({ default: m.SettingsDrawer })));
const LazyLoginModal = lazy(() => import("./components/LoginModal").then((m) => ({ default: m.LoginModal })));
const LazyEditServiceModal = lazy(() => import("./components/EditServiceModal").then((m) => ({ default: m.EditServiceModal })));
const LazyGroupModal = lazy(() => import("./components/GroupModal").then((m) => ({ default: m.GroupModal })));
const LazyAiDiagnoseModal = lazy(() => import("./components/AiDiagnoseModal").then((m) => ({ default: m.AiDiagnoseModal })));
import { widgetRegistry } from "./widgets/registry";
import { cloneConfig, newId } from "./lib/defaultConfig";
import type { Group, ServiceItem, NavConfig, ServiceStatus, WidgetInstance, WidgetSize, WidgetType } from "./types";

type StatusInfo = Omit<ServiceStatus, "name">;

export default function App() {
  return (
    <AppStoreProvider>
      <AppInner />
    </AppStoreProvider>
  );
}

function AppInner() {
  const { ready, authed, config, admin, setAdmin, snapshot, saveConfig, toast } = useStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [trendDevice, setTrendDevice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ groupId: string; item: ServiceItem | null } | null>(null);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; groupId: string; item: ServiceItem } | null>(null);
  const [folderPop, setFolderPop] = useState<ServiceItem | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("home");
  const pendingEditRef = React.useRef(false);

  React.useEffect(() => {
    if (authed && pendingEditRef.current) {
      pendingEditRef.current = false;
      setAdmin(true);
    }
  }, [authed, setAdmin]);

  /* 管理模式草稿（进入管理模式时从当前配置复制） */
  const [draft, setDraft] = useState<NavConfig | null>(null);
  React.useEffect(() => {
    if (admin && !draft) setDraft(cloneConfig(config));
    if (!admin && draft) setDraft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, config]);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(config);


  const ctxItems = (item: ServiceItem, groupId: string): MenuItem[] => {
    const folder = isFolder(item);
    const items: MenuItem[] = [];
    if (!folder) {
      items.push({ key: 'open', label: '新标签打开', icon: <IconExternalLink size={13} />, onSelect: () => window.open(item.url, '_blank', 'noopener') });
      items.push({ key: 'copy', label: '复制链接', icon: <IconCopy size={13} />, onSelect: () => { navigator.clipboard.writeText(item.url).catch(() => {}); toast('链接已复制'); } });
    } else {
      items.push({ key: 'openf', label: '打开文件夹', icon: <IconFolder size={13} />, onSelect: () => setFolderPop(item) });
    }
    const isChild = cfg.groups.some((g) => g.services.some((sv) => sv.children?.some((c) => c.id === item.id)));
    if (draft && admin && !isChild) {
      items.push({ key: 'edit', label: '编辑', dividerBefore: true, onSelect: () => setEditing({ groupId, item }) });
      items.push({ key: 'del', label: '删除', danger: true, onSelect: () => deleteService(groupId, item.id) });
    }
    return items;
  };

  const finishAdmin = async () => {
    if (draft && dirty) {
      try {
        await saveConfig(draft);
      } catch (e) {
        toast(`保存失败：${(e as Error).message}`, true);
        return;
      }
    }
    setDraft(null);
    setAdmin(false);
  };

  /* 拖拽 */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));
  const [dragType, setDragType] = useState<"group" | "service" | "widget" | null>(null);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [folderDragOut, setFolderDragOut] = useState<{
    groupId: string;
    folderId: string;
    item: ServiceItem;
    x: number;
    y: number;
  } | null>(null);

  const findMergeTarget = useCallback((activeId: string, px: number, py: number): string | null => {
    const tiles = document.querySelectorAll<HTMLElement>("[data-service-tile]");
    for (const el of tiles) {
      const key = el.dataset.serviceTile;
      if (!key || key === activeId) continue;
      const r = el.getBoundingClientRect();
      // 中心 66% 区域作为合并热区（四周各留 17% 触发排序让位）
      const padX = r.width * 0.17;
      const padY = r.height * 0.17;
      if (px >= r.left + padX && px <= r.right - padX && py >= r.top + padY && py <= r.bottom - padY) {
        return key;
      }
    }
    return null;
  }, []);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeData = args.active.data.current as { type?: string; isFolder?: boolean } | undefined;
    if (activeData?.type === "service" && args.pointerCoordinates) {
      const px = args.pointerCoordinates.x;
      const py = args.pointerCoordinates.y;
      if (!activeData.isFolder) {
        const hit = findMergeTarget(String(args.active.id), px, py);
        if (hit) return []; // 命中合并热区时不触发让位，保持目标图标稳在原地等待合并
      }
      const hits = closestCenter(args);
      if (hits.length > 0 && hits[0].id !== args.active.id) {
        const activeRect = args.droppableRects.get(args.active.id);
        const overRect = args.droppableRects.get(hits[0].id);
        if (activeRect && overRect) {
          const activeCX = activeRect.left + activeRect.width / 2;
          const activeCY = activeRect.top + activeRect.height / 2;
          const overCX = overRect.left + overRect.width / 2;
          const overCY = overRect.top + overRect.height / 2;
          const dx = overCX - activeCX;
          const dy = overCY - activeCY;
          const dot = (px - overCX) * dx + (py - overCY) * dy;
          if (dot < 0) return []; // 指针尚未越过目标图标中心时，阻止提前交换让位，避免目标逃跑
        }
      }
      return hits;
    }
    return closestCenter(args);
  }, [findMergeTarget]);

  const reorderFolderChild = useCallback((folderId: string, fromIdx: number, toIdx: number) => {
    if (!draft) return;
    const next = cloneConfig(draft);
    for (const g of next.groups) {
      const f = g.services.find((s) => s.id === folderId);
      if (f?.children) {
        f.children = arrayMove(f.children, fromIdx, toIdx);
        setDraft(next);
        return;
      }
    }
  }, [draft]);

  const startDragOutFromFolder = useCallback((folder: ServiceItem, child: ServiceItem, clientX: number, clientY: number) => {
    if (!draft) return;
    const g = draft.groups.find((gr) => gr.services.some((s) => s.id === folder.id));
    if (!g) return;
    setFolderDragOut({ groupId: g.id, folderId: folder.id, item: child, x: clientX, y: clientY });
  }, [draft]);

  React.useEffect(() => {
    if (!folderDragOut) return;
    const onMove = (ev: PointerEvent) => {
      setFolderDragOut((prev) => (prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null));
      const hit = findMergeTarget("", ev.clientX, ev.clientY);
      setMergeTargetId(hit);
    };
    const onUp = (ev: PointerEvent) => {
      setMergeTargetId(null);
      setFolderDragOut(null);
      if (!draft) return;
      const next = cloneConfig(draft);
      const srcG = next.groups.find((g) => g.id === folderDragOut.groupId);
      const srcFolderIdx = srcG ? srcG.services.findIndex((s) => s.id === folderDragOut.folderId) : -1;
      if (!srcG || srcFolderIdx < 0) return;

      const srcFolder = srcG.services[srcFolderIdx];
      const remaining = (srcFolder.children || []).filter((c) => c.id !== folderDragOut.item.id);
      if (remaining.length === 1) {
        // 文件夹只剩 1 个图标时自动解散为普通桌面图标
        srcG.services[srcFolderIdx] = remaining[0];
      } else {
        srcFolder.children = remaining;
      }

      // 检查是否落入某张卡片中心合并
      const mergeHit = findMergeTarget("", ev.clientX, ev.clientY);
      if (mergeHit) {
        const [tgId, tsId] = mergeHit.split("::");
        const toG = next.groups.find((g) => g.id === tgId);
        const tIdx = toG ? toG.services.findIndex((s) => s.id === tsId) : -1;
        if (toG && tIdx >= 0) {
          const target = toG.services[tIdx];
          if (target.children) {
            target.children = [...target.children, folderDragOut.item];
            toast(`已移入文件夹「${target.name}」（记得保存配置）`);
          } else {
            toG.services[tIdx] = {
              id: newId("f"),
              name: "新建文件夹",
              url: "",
              icon: "folder",
              children: [target, folderDragOut.item],
            };
            toast("已合并为新文件夹（记得保存配置）");
          }
          setDraft(next);
          return;
        }
      }

      // 否则寻找最近的桌面卡片位置插入
      const tiles = Array.from(document.querySelectorAll<HTMLElement>("[data-service-tile]"));
      let bestKey: string | null = null;
      let bestDist = Infinity;
      let insertAfter = false;
      for (const el of tiles) {
        const key = el.dataset.serviceTile;
        if (!key) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        if (d < bestDist) {
          bestDist = d;
          bestKey = key;
          insertAfter = ev.clientX > cx;
        }
      }

      if (bestKey) {
        const [tgId, tsId] = bestKey.split("::");
        const toG = next.groups.find((g) => g.id === tgId);
        const tIdx = toG ? toG.services.findIndex((s) => s.id === tsId) : -1;
        if (toG && tIdx >= 0) {
          toG.services.splice(insertAfter ? tIdx + 1 : tIdx, 0, folderDragOut.item);
          setDraft(next);
          toast("已移出到桌面（记得保存配置）");
          return;
        }
      }

      srcG.services.push(folderDragOut.item);
      setDraft(next);
      toast("已移出到桌面（记得保存配置）");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [folderDragOut, draft, findMergeTarget, toast]);

  const onDragStart = (e: DragStartEvent) => {
    const t = (e.active.data.current?.type as "group" | "service" | "widget") || null;
    setDragType(t);
    setActiveWidgetId(t === "widget" ? String(e.active.id) : null);
    setActiveServiceId(t === "service" ? String(e.active.id) : null);
    setMergeTargetId(null);
  };
  const onDragMove = (e: DragMoveEvent) => {
    const activeData = e.active.data.current as { type?: string; isFolder?: boolean } | undefined;
    if (activeData?.type !== "service" || activeData.isFolder || !draft) {
      if (mergeTargetId) setMergeTargetId(null);
      return;
    }
    const ev = e.activatorEvent as PointerEvent | MouseEvent | TouchEvent | undefined;
    let startX = 0, startY = 0;
    if (ev && "clientX" in ev) {
      startX = ev.clientX;
      startY = ev.clientY;
    } else if (ev && "touches" in ev && ev.touches[0]) {
      startX = ev.touches[0].clientX;
      startY = ev.touches[0].clientY;
    } else {
      return;
    }
    const hit = findMergeTarget(String(e.active.id), startX + e.delta.x, startY + e.delta.y);
    if (hit !== mergeTargetId) setMergeTargetId(hit);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const mergeKey = mergeTargetId;
    setDragType(null);
    setActiveWidgetId(null);
    setActiveServiceId(null);
    setMergeTargetId(null);
    const { active, over } = e;
    if (!draft) return;
    const type = active.data.current?.type as string;
    if (type === "widget") {
      if (!over) return;
      const ws = draft.widgets || [];
      const oldIdx = ws.findIndex((w) => w.id === active.id);
      const newIdx = ws.findIndex((w) => w.id === over.id);
      if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
        setDraft({ ...draft, widgets: arrayMove(ws, oldIdx, newIdx) });
      }
      return;
    }
    if (type === "group") {
      if (!over) return;
      const oldIdx = draft.groups.findIndex((g) => g.id === active.id);
      const newIdx = draft.groups.findIndex((g) => g.id === over.id);
      if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
        setDraft({ ...draft, groups: arrayMove(draft.groups, oldIdx, newIdx) });
      }
    } else if (type === "service") {
      const [gId, sId] = String(active.id).split("::");
      const g = draft.groups.find((x) => x.id === gId);
      const dragged = g?.services.find((sv) => sv.id === sId);
      if (!g || !dragged) return;

      // 优先处理拖拽重叠合并（拖到普通卡片中心生成文件夹，拖到文件夹中心加入其中）
      if (mergeKey && !dragged.children) {
        const [tgId, tsId] = mergeKey.split("::");
        if (tsId && tsId !== sId) {
          const next = cloneConfig(draft);
          const fromG = next.groups.find((x) => x.id === gId);
          const toG = next.groups.find((x) => x.id === tgId);
          const moved = fromG?.services.find((sv) => sv.id === sId);
          const tIdx = toG ? toG.services.findIndex((sv) => sv.id === tsId) : -1;
          if (fromG && toG && moved && tIdx >= 0) {
            const target = toG.services[tIdx];
            fromG.services = fromG.services.filter((sv) => sv.id !== sId);
            if (target.children) {
              target.children = [...target.children, moved];
              toast(`已移入文件夹「${target.name}」（记得保存配置）`);
            } else {
              const newFolder: ServiceItem = {
                id: newId("f"),
                name: "新建文件夹",
                url: "",
                icon: "folder",
                children: [target, moved],
              };
              const curIdx = toG.services.findIndex((sv) => sv.id === tsId);
              if (curIdx >= 0) toG.services[curIdx] = newFolder;
              toast("已合并为新文件夹（右键或点击编辑可重命名）");
            }
            setDraft(next);
            return;
          }
        }
      }

      if (!over) return;
      const [ogId, oId] = String(over.id).split("::");
      const og = draft.groups.find((x) => x.id === ogId);
      if (!og) return;
      if (gId === ogId) {
        const oldIdx = g.services.findIndex((s) => s.id === sId);
        const newIdx = g.services.findIndex((s) => s.id === oId);
        if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
          const next = cloneConfig(draft);
          const ng = next.groups.find((x) => x.id === gId)!;
          ng.services = arrayMove(ng.services, oldIdx, newIdx);
          setDraft(next);
        }
      } else {
        // 跨组：移到目标卡片位置
        const next = cloneConfig(draft);
        const from = next.groups.find((x) => x.id === gId)!;
        const to = next.groups.find((x) => x.id === ogId)!;
        const item = from.services.find((s) => s.id === sId);
        if (!item) return;
        from.services = from.services.filter((s) => s.id !== sId);
        const idx = to.services.findIndex((s) => s.id === oId);
        to.services.splice(idx >= 0 ? idx : to.services.length, 0, item);
        setDraft(next);
      }
    }
  };

  /* 卡片增删改 */
  const saveService = (groupId: string, item: ServiceItem) => {
    if (!draft) return;
    const next = cloneConfig(draft);
    for (const g of next.groups) {
      g.services = g.services.filter((s) => s.id !== item.id);
    }
    const g = next.groups.find((x) => x.id === groupId);
    if (g) g.services.push(item);
    setDraft(next);
    setEditing(null);
  };
  const deleteService = (groupId: string, id: string) => {
    if (!draft) return;
    const next = cloneConfig(draft);
    const g = next.groups.find((x) => x.id === groupId);
    if (g) g.services = g.services.filter((s) => s.id !== id);
    setDraft(next);
  };
  const renameGroup = (gid: string) => {
    if (!draft) return;
    const g = draft.groups.find((x) => x.id === gid);
    if (g) setGroupDialog({ mode: "rename", gid, name: g.name });
  };
  const deleteGroup = (gid: string) => {
    if (!draft) return;
    const g = draft.groups.find((x) => x.id === gid);
    if (g) setGroupDialog({ mode: "delete", gid, name: g.name, count: g.services.length });
  };
  const addGroup = () => {
    if (!draft) return;
    setGroupDialog({ mode: "add" });
  };
  const confirmGroupDialog = (name?: string) => {
    if (!draft || !groupDialog) return;
    const next = cloneConfig(draft);
    if (groupDialog.mode === "add" && name) {
      next.groups.push({ id: newId("g"), name, services: [] });
    } else if (groupDialog.mode === "rename" && name) {
      const target = next.groups.find((x) => x.id === groupDialog.gid);
      if (target) target.name = name;
    } else if (groupDialog.mode === "delete") {
      next.groups = next.groups.filter((x) => x.id !== groupDialog.gid);
      if (activeTab === groupDialog.gid) setActiveTab("home");
    }
    setDraft(next);
    setGroupDialog(null);
  };

  /* 组件区（widget）增删/跨列/尺寸同步 */
  const updateWidgets = (fn: (ws: WidgetInstance[]) => WidgetInstance[]) => {
    if (draft) {
      const next = cloneConfig(draft);
      next.widgets = fn(next.widgets || []);
      setDraft(next);
      return;
    }
    if (!authed) return;
    const next = cloneConfig(config);
    next.widgets = fn(next.widgets || []);
    saveConfig(next).catch((e) => toast(`保存失败：${(e as Error).message}`, true));
  };
  const addWidget = (type: WidgetType, size?: WidgetSize) => {
    const m = widgetRegistry.find((x) => x.type === type);
    if (!m) return;
    const chosenSize = size ?? (m as { defaultSize?: WidgetSize }).defaultSize;
    updateWidgets((ws) => [...ws, { id: newId("w"), type, span: m.defaultSpan, ...(chosenSize ? { size: chosenSize } : {}) }]);
  };
  const removeWidget = (id: string) => updateWidgets((ws) => ws.filter((w) => w.id !== id));

  /* 过滤 */
  const q = query.trim().toLowerCase();
  const visibleGroups: Group[] = useMemo(() => {
    const src = draft ?? config;
    if (!q) return src.groups;
    return src.groups
      .map((g) => ({
        ...g,
        services: g.services.filter(
          (s) => s.name.toLowerCase().includes(q) || (s.desc || "").toLowerCase().includes(q) || s.url.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.services.length > 0);
  }, [draft, config, q]);

  const flatMatches = useMemo(() => {
    if (!q) return null;
    const out: { group: Group; item: ServiceItem }[] = [];
    for (const g of visibleGroups) for (const s of g.services) out.push({ group: g, item: s });
    return out;
  }, [visibleGroups, q]);

  const statusOf = useCallback(
    (name: string) => snapshot?.services.find((s) => s.name === name),
    [snapshot],
  );

  const activeAlerts = snapshot?.alerts.filter((a) => !a.resolved_at) ?? [];

  /* 未就绪：与主界面结构一致的轻量骨架屏，避免突兀的空白长方形 */
  if (!ready) {
    return (
      <div className="app boot-skel" aria-busy="true" aria-label="正在加载">
        <div className="boot-hero">
          <div className="skel boot-clock" />
          <div className="skel boot-search" />
        </div>
        <div className="boot-bento">
          <div className="skel boot-card span2" />
          <div className="skel boot-card" />
          <div className="skel boot-card" />
          <div className="skel boot-card span2" />
        </div>
      </div>
    );
  }

  /* 全站登录墙 */
  if (!authed && !config.privacy.publicNav) {
    return (
      <div className="gate">
        <div className="gatebox">
          <div className="brand"><span className="mark"><IconActivity size={15} strokeWidth={1.8} /></span>{config.site.title}</div>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 18px" }}>此站点为私人导航页，请登录后使用。</p>
          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setLoginOpen(true)}>登录</button>
        </div>
        {loginOpen && (
          <Suspense fallback={null}>
            <LazyAntdShell>
              <LazyLoginModal onClose={() => setLoginOpen(false)} />
            </LazyAntdShell>
          </Suspense>
        )}
        <Toasts />
      </div>
    );
  }

  const cfg = draft ?? config;
  const activeGroup = cfg.groups.find((g) => g.id === activeTab) || null;
  const homeGroup = cfg.groups[0] || null;
  const openWidgetStore = () => {
    if (!authed) {
      setLoginOpen(true);
      return;
    }
    if (!admin) setAdmin(true);
    setSettingsTab("widgets");
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => { setDragType(null); setActiveWidgetId(null); setActiveServiceId(null); setMergeTargetId(null); }}
    >
      <div className="app">
        <SideRail
          groups={cfg.groups}
          activeTab={activeGroup ? activeGroup.id : "home"}
          onSelectTab={(tab) => { setActiveTab(tab); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          authed={authed}
          admin={admin && !!draft}
          activeAlerts={activeAlerts.length}
          onAlerts={() => setAlertsOpen(true)}
          onAiDiagnose={() => setAiOpen(true)}
          onSettings={() => setSettingsTab("appearance")}
          onAdd={addGroup}
        />

        {!(admin && draft) && (
          <div className="edit-trigger-zone">
            <button
              type="button"
              className="edit-dots-btn"
              title="进入编辑模式"
              aria-label="进入编辑模式"
              onClick={() => {
                if (authed) {
                  setAdmin(true);
                } else {
                  pendingEditRef.current = true;
                  setLoginOpen(true);
                }
              }}
            >
              <IconMore size={18} />
            </button>
          </div>
        )}

        {admin && draft && (
          <div className="admin-pill">
            <span className="st"><b>管理模式</b>{dirty ? " · 已修改" : ""}</span>
            <button className="btn small" onClick={addGroup}><IconPlus size={12} /> 分组</button>
            {dirty && (
              <button className="btn small" onClick={() => setDraft(cloneConfig(config))}>放弃</button>
            )}
            <button className="btn small primary" onClick={finishAdmin}><IconCheck size={12} /> 完成</button>
          </div>
        )}

        <Hero onFilter={setQuery} filtered={flatMatches} />

        <AlertBar />

        <main className="wetab-stage">
            {q !== "" ? (
              <div className="wetab-grid">
                {(flatMatches || []).map(({ group, item }, i) => (
                  <ServiceTile
                    key={item.id}
                    groupId={group.id}
                    item={item}
                    admin={admin && !!draft}
                    mergeTarget={mergeTargetId === `${group.id}::${item.id}`}
                    status={item.check ? statusOf(item.name) : undefined}
                    statusOf={statusOf}
                    onContext={(e, it) => setCtx({ x: e.clientX, y: e.clientY, groupId: group.id, item: it })}
                    onEdit={() => setEditing({ groupId: group.id, item })}
                    onDelete={() => deleteService(group.id, item.id)}
                    style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}
                  />
                ))}
                {(!flatMatches || flatMatches.length === 0) && (
                  <div className="empty" style={{ gridColumn: "1 / -1" }}>未找到匹配「{query}」的导航卡片</div>
                )}
              </div>
            ) : activeGroup ? (
              <GroupBlock
                group={activeGroup}
                admin={admin && !!draft}
                statusOf={statusOf}
                mergeTargetId={mergeTargetId}
                onDragOutFromFolder={startDragOutFromFolder}
                onReorderFolder={reorderFolderChild}
                onRename={() => renameGroup(activeGroup.id)}
                onDelete={() => { deleteGroup(activeGroup.id); setActiveTab("home"); }}
                onAdd={() => setEditing({ groupId: activeGroup.id, item: null })}
                onEditItem={(item) => setEditing({ groupId: activeGroup.id, item })}
                onDeleteItem={(id) => deleteService(activeGroup.id, id)}
                onContext={(e, item) => setCtx({ x: e.clientX, y: e.clientY, groupId: activeGroup.id, item })}
              />
            ) : (
              <>
                <WidgetsSection
                  widgets={cfg.widgets || []}
                  admin={admin && !!draft}
                  onTrend={setTrendDevice}
                  onLayoutChange={(items) => {
                    updateWidgets((ws) =>
                      ws.map((w) => {
                        const hit = items.find((it) => it.id === w.id);
                        return hit ? { ...w, x: hit.x, y: hit.y, w: hit.w, h: hit.h, span: hit.w >= 6 ? 2 : 1 } : w;
                      }),
                    );
                  }}
                  onAdd={addWidget}
                  onRemove={removeWidget}
                  onOpenStore={openWidgetStore}
                />
                {homeGroup && (
                  <GroupBlock
                    group={homeGroup}
                    hideHeader={!admin}
                    admin={admin && !!draft}
                    statusOf={statusOf}
                    mergeTargetId={mergeTargetId}
                    onDragOutFromFolder={startDragOutFromFolder}
                    onReorderFolder={reorderFolderChild}
                    onRename={() => renameGroup(homeGroup.id)}
                    onDelete={() => deleteGroup(homeGroup.id)}
                    onAdd={() => setEditing({ groupId: homeGroup.id, item: null })}
                    onEditItem={(item) => setEditing({ groupId: homeGroup.id, item })}
                    onDeleteItem={(id) => deleteService(homeGroup.id, id)}
                    onContext={(e, item) => setCtx({ x: e.clientX, y: e.clientY, groupId: homeGroup.id, item })}
                  />
                )}
              </>
            )}
          </main>

        {folderPop && (
          <FolderPopup item={folderPop} statusOf={statusOf} onClose={() => setFolderPop(null)} onContext={(e, item) => setCtx({ x: e.clientX, y: e.clientY, groupId: cfg.groups.find((g) => g.services.some((s) => s.id === item.id))?.id || "", item })} />
        )}

        {ctx && (
          <ContextMenu
            x={ctx.x}
            y={ctx.y}
            onClose={() => setCtx(null)}
            items={ctxItems(ctx.item, ctx.groupId)}
          />
        )}
      </div>

      {/* 拖拽浮影（小组件与服务卡片均渲染真实实体跟随鼠标指针轨迹） */}
      <DragOverlay dropAnimation={null}>
        {dragType === "widget" && activeWidgetId ? (
          (() => {
            const w = (cfg.widgets || []).find((x) => x.id === activeWidgetId);
            return w ? <WidgetDragPreview inst={w} /> : null;
          })()
        ) : dragType === "service" && activeServiceId ? (
          (() => {
            const [gId, sId] = activeServiceId.split("::");
            const g = cfg.groups.find((x) => x.id === gId);
            const it = g?.services.find((x) => x.id === sId);
            return it ? (
              <div
                style={{
                  pointerEvents: "none",
                  transform: "scale(1.06)",
                  filter: "drop-shadow(0 18px 34px rgba(0, 0, 0, 0.45))",
                  cursor: "grabbing",
                }}
              >
                <ServiceCard item={it} status={it.check ? statusOf(it.name) : undefined} statusOf={statusOf} />
              </div>
            ) : null;
          })()
        ) : dragType ? (
          <div style={{ width: 150, height: 8, borderRadius: 4, background: "var(--accent-dim)" }} />
        ) : null}
      </DragOverlay>

      {/* 从文件夹拖出时的全局鼠标跟随浮影 */}
      {folderDragOut && (
        <div
          style={{
            position: "fixed",
            left: folderDragOut.x,
            top: folderDragOut.y,
            transform: "translate(-50%, -50%) scale(1.06)",
            pointerEvents: "none",
            zIndex: 60,
            filter: "drop-shadow(0 18px 34px rgba(0, 0, 0, 0.45))",
            cursor: "grabbing",
          }}
        >
          <ServiceCard
            item={folderDragOut.item}
            status={folderDragOut.item.check ? statusOf(folderDragOut.item.name) : undefined}
            statusOf={statusOf}
          />
        </div>
      )}

      {(settingsTab !== null || !!editing || !!groupDialog || loginOpen || !!trendDevice || alertsOpen || aiOpen) && (
        <Suspense fallback={null}>
          <LazyAntdShell>
            {trendDevice && <LazyTrendModal deviceId={trendDevice} onClose={() => setTrendDevice(null)} />}
            {alertsOpen && <LazyAlertsDrawer open={alertsOpen} onClose={() => setAlertsOpen(false)} />}
            {aiOpen && <LazyAiDiagnoseModal open={aiOpen} onClose={() => setAiOpen(false)} />}
            {settingsTab !== null && (
              <LazySettingsDrawer
                open={settingsTab !== null}
                initialTab={settingsTab ?? "appearance"}
                widgets={cfg.widgets || []}
                activeConfig={cfg}
                onAddWidget={addWidget}
                onRemoveWidget={removeWidget}
                onSaved={(saved) => { if (admin && draft) setDraft(cloneConfig(saved)); }}
                onClose={() => setSettingsTab(null)}
              />
            )}
            {loginOpen && <LazyLoginModal onClose={() => setLoginOpen(false)} />}
            {groupDialog && (
              <LazyGroupModal
                state={groupDialog}
                onClose={() => setGroupDialog(null)}
                onConfirm={confirmGroupDialog}
              />
            )}
            {editing && draft && (
              <LazyEditServiceModal
                initial={editing.item}
                groups={draft.groups}
                groupId={editing.groupId}
                onClose={() => setEditing(null)}
                onSave={saveService}
                onDelete={editing.item ? () => deleteService(editing.groupId, editing.item!.id) : undefined}
                onManageIcons={() => setSettingsTab("icons")}
              />
            )}
          </LazyAntdShell>
        </Suspense>
      )}
      <Toasts />
    </DndContext>
  );
}

/* ---------- 分组（可排序） ---------- */
function GroupBlock(props: {
  group: Group;
  hideHeader?: boolean;
  admin: boolean;
  statusOf: (name: string) => StatusInfo | undefined;
  mergeTargetId?: string | null;
  onDragOutFromFolder?: (folder: ServiceItem, child: ServiceItem, x: number, y: number) => void;
  onReorderFolder?: (folderId: string, fromIdx: number, toIdx: number) => void;
  onRename: () => void;
  onDelete: () => void;
  onAdd: () => void;
  onEditItem: (item: ServiceItem) => void;
  onDeleteItem: (id: string) => void;
  onContext: (e: React.MouseEvent, item: ServiceItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.group.id,
    data: { type: "group" },
    disabled: !props.admin,
  });
  const ids = props.group.services.map((s) => `${props.group.id}::${s.id}`);

  return (
    <section
      ref={setNodeRef}
      id={`group-${props.group.id}`}
      className="block wetab-group"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      aria-label={props.group.name}
    >
      {!props.hideHeader && (
        <div className="group-head wetab-ghead">
          {props.admin && (
            <span className="drag-handle" {...attributes} {...listeners} title="拖拽调整分组顺序" aria-label="拖拽调整分组顺序">
              <IconGrip size={14} />
            </span>
          )}
          <span className="title">{props.group.name}</span>
          {props.admin && (
            <span className="grouphead-edit">
              <button className="iconbtn" title="重命名分组" aria-label={`重命名分组 ${props.group.name}`} onClick={props.onRename}><IconEdit size={12} /></button>
              <button className="iconbtn" title="删除分组" aria-label={`删除分组 ${props.group.name}`} onClick={props.onDelete}><span style={{ color: "var(--danger)" }}>×</span></button>
            </span>
          )}
        </div>
      )}
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid wetab-grid">
          {props.group.services.map((s, i) => (
            <ServiceTile key={s.id} groupId={props.group.id} item={s} admin={props.admin}
              mergeTarget={props.mergeTargetId === `${props.group.id}::${s.id}`}
              status={s.check ? props.statusOf(s.name) : undefined}
              statusOf={props.statusOf}
              onContext={(e, it) => props.onContext(e, it)}
              onEdit={() => props.onEditItem(s)}
              onDelete={() => props.onDeleteItem(s.id)}
              onDragOutFromFolder={props.onDragOutFromFolder}
              onReorderFolder={props.onReorderFolder}
              style={{ animationDelay: `${Math.min(i * 30 + 40, 400)}ms` }}
            />
          ))}
          {props.admin && (
            <button className="addcard" onClick={props.onAdd}>
              <IconPlus size={18} />
              添加卡片
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

/* ---------- 卡片（可排序） ---------- */
function ServiceTile(props: {
  groupId: string;
  item: ServiceItem;
  admin: boolean;
  mergeTarget?: boolean;
  status?: StatusInfo;
  statusOf?: (name: string) => StatusInfo | undefined;
  onContext: (e: React.MouseEvent, item: ServiceItem) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragOutFromFolder?: (folder: ServiceItem, child: ServiceItem, x: number, y: number) => void;
  onReorderFolder?: (folderId: string, fromIdx: number, toIdx: number) => void;
  style?: React.CSSProperties;
}) {
  const sortableId = `${props.groupId}::${props.item.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { type: "service", isFolder: Array.isArray(props.item.children) },
    disabled: !props.admin,
  });
  return (
    <div
      ref={setNodeRef}
      data-service-tile={sortableId}
      className={props.mergeTarget ? "merge-target" : undefined}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? "none" : transition,
        opacity: isDragging ? 0.28 : 1,
        zIndex: isDragging ? 1 : 0,
        display: "grid",
        ...(props.style || {}),
      }}
      {...attributes}
      {...(props.admin ? listeners : {})}
    >
      <ServiceCard
        item={props.item}
        status={props.status}
        statusOf={props.statusOf}
        onContext={props.onContext}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onDragOutFromFolder={props.onDragOutFromFolder}
        onReorderFolder={props.onReorderFolder}
      />
    </div>
  );
}

/* ---------- Toast ---------- */
function Toasts() {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.err ? " err" : ""}`}>{t.text}</div>
      ))}
    </div>
  );
}
