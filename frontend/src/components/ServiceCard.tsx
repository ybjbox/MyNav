import React, { useEffect, useRef, useState } from "react";
import { IconEdit, IconTrash } from "./icons";
import { IconBlock } from "./IconBlock";
import { useStore } from "../state/store";
import { recordVisit } from "../lib/storage";
import type { ServiceItem, ServiceStatus } from "../types";

type StatusInfo = Omit<ServiceStatus, "name">;

export function isFolder(item: ServiceItem): boolean {
  return Array.isArray(item.children);
}

/** 聚合子卡片最差状态（文件夹徽章用） */
export function folderWorst(children: ServiceItem[] | undefined, statusOf: (name: string) => StatusInfo | undefined):
  "ok" | "off" | "warn" | "unknown" {
  const kids = children || [];
  if (kids.length === 0) return "unknown";
  let worst: "ok" | "off" | "warn" | "unknown" = "unknown";
  for (const k of kids) {
    if (!k.check) continue;
    const st = statusOf(k.name);
    if (!st) { worst = worst === "unknown" ? "unknown" : worst; continue; }
    if (st.status === "offline") return "off";
    if (st.status === "slow") worst = "warn";
    else if (worst !== "warn") worst = "ok";
  }
  return worst;
}

/** 服务卡片（WeTab 极简图标风格）：1×1 圆角品牌图标块 + 下方名称；文件夹为磨砂 2×2 缩略方块 + 弹层 */
export function ServiceCard(props: {
  item: ServiceItem;
  status?: StatusInfo;
  statusOf?: (name: string) => StatusInfo | undefined;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenFolder?: (item: ServiceItem) => void;
  onContext?: (e: React.MouseEvent, item: ServiceItem) => void;
  onDragOutFromFolder?: (folder: ServiceItem, child: ServiceItem, clientX: number, clientY: number) => void;
  onReorderFolder?: (folderId: string, fromIdx: number, toIdx: number) => void;
  style?: React.CSSProperties;
}) {
  const { item, status } = props;
  const { admin } = useStore();
  const folder = isFolder(item);
  const [popupOpen, setPopupOpen] = useState(false);

  const visit = () => { if (!folder) recordVisit(item.id); };

  const onClick = (e: React.MouseEvent) => {
    if (admin) { e.preventDefault(); return; } // 管理模式下单击不跳转，交给编辑/拖拽
    visit();
    if (folder) { e.preventDefault(); setPopupOpen(true); props.onOpenFolder?.(item); }
  };

  const folderWorstCls = folder ? folderWorst(item.children, (n) => props.statusOf?.(n)) : "";
  const folderOffline = folder && folderWorstCls === "off";

  // 文件夹卡：磨砂圆角方块 + 2×2 子卡图标缩略 + 名称
  if (folder) {
    const kids = (item.children || []).slice(0, 4);
    return (
      <>
        <a
          className={`card wetab-icon folder-card enter${folderOffline ? " bad" : ""}`}
          style={props.style}
          href="#"
          onClick={(e) => { e.preventDefault(); setPopupOpen(true); }}
          onContextMenu={(e) => { e.preventDefault(); props.onContext?.(e, item); }}
          aria-label={`文件夹 ${item.name}，${(item.children || []).length} 个卡片`}
          title={`${item.name} (${(item.children || []).length})`}
        >
          <span className="ico-wrap">
            <span className="folder-thumb">
              {kids.map((k) => (
                <IconBlock className="mini-ico" key={k.id} url={k.url} name={k.name} icon={k.icon} size={15} />
              ))}
              {(item.children || []).length === 0 && <span className="mini-ico empty"><IconEdit size={14} /></span>}
            </span>
            {folderWorstCls !== "unknown" && (
              <span className={`badge-dot dot ${folderWorstCls === "ok" ? "" : folderWorstCls}`} aria-hidden="true" />
            )}
            {admin && props.onEdit && (
              <span className="editfloat" onClick={(e) => e.preventDefault()}>
                <button className="iconbtn" title="编辑" aria-label={`编辑文件夹 ${item.name}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onEdit!(); }}>
                  <IconEdit size={13} />
                </button>
                <button className="iconbtn" title="删除" aria-label={`删除文件夹 ${item.name}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onDelete!(); }}>
                  <IconTrash size={13} />
                </button>
              </span>
            )}
          </span>
          <span className="name">{item.name}</span>
        </a>
        {popupOpen && (
          <FolderPopup
            item={item}
            admin={admin}
            statusOf={props.statusOf}
            onClose={() => setPopupOpen(false)}
            onContext={props.onContext}
            onDragOut={props.onDragOutFromFolder}
            onReorder={props.onReorderFolder}
          />
        )}
      </>
    );
  }

  // 普通卡片：干净圆角品牌图标块 + 名称 + 启用探活时的右上角状态点
  let dotCls = "unknown";
  let statTxt = "";
  if (item.check) {
    if (!status) {
      dotCls = "unknown";
      statTxt = "等待采集器";
    } else if (status.status === "online") {
      dotCls = "";
      statTxt = `在线 · ${status.latency_ms ?? "—"}ms`;
    } else if (status.status === "slow") {
      dotCls = "warn";
      statTxt = `慢 · ${status.latency_ms}ms`;
    } else {
      dotCls = "off";
      statTxt = `离线${status.fails ? ` · ${status.fails} 次探活失败` : ""}`;
    }
  }
  const stateCls = dotCls === "off" ? "bad" : dotCls === "warn" ? "slowish" : "ok";

  return (
    <a
      className={`card wetab-icon enter state-${stateCls}${dotCls === "off" ? " bad" : ""}`}
      style={props.style}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); props.onContext?.(e, item); }}
      aria-label={`${item.name}${item.desc ? "，" + item.desc : ""}`}
      title={[item.name, item.desc, statTxt].filter(Boolean).join(" · ")}
    >
      <span className="ico-wrap">
        <IconBlock className="ico-block" url={item.url} name={item.name} icon={item.icon} size={26} />
        {item.check && (
          <span className={`badge-dot dot ${dotCls}`} title={statTxt} aria-hidden="true" />
        )}
        {admin && props.onEdit && (
          <span className="editfloat" onClick={(e) => e.preventDefault()}>
            <button className="iconbtn" title="编辑" aria-label={`编辑 ${item.name}`} onClick={(e) => { e.preventDefault(); props.onEdit!(); }}>
              <IconEdit size={13} />
            </button>
            <button className="iconbtn" title="删除" aria-label={`删除 ${item.name}`} onClick={(e) => { e.preventDefault(); props.onDelete!(); }}>
              <IconTrash size={13} />
            </button>
          </span>
        )}
      </span>
      <span className="name">{item.name}</span>
    </a>
  );
}

/** 文件夹弹层：WeTab / iOS / HyperOS 磨砂居中文件夹弹层 */
export function FolderPopup(props: {
  item: ServiceItem;
  admin?: boolean;
  statusOf?: (name: string) => StatusInfo | undefined;
  onClose: () => void;
  onContext?: (e: React.MouseEvent, item: ServiceItem) => void;
  onDragOut?: (folder: ServiceItem, child: ServiceItem, clientX: number, clientY: number) => void;
  onReorder?: (folderId: string, fromIdx: number, toIdx: number) => void;
}) {
  const kids = props.item.children || [];
  const boxRef = useRef<HTMLDivElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  const startChildPointer = (e: React.PointerEvent, child: ServiceItem, idx: number) => {
    if (!props.admin || e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let active = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!active && Math.hypot(dx, dy) < 6) return;
      active = true;
      suppressClickRef.current = true;
      setDraggingIdx(idx);
      setDragPos({ x: ev.clientX, y: ev.clientY });

      const box = boxRef.current?.getBoundingClientRect();
      if (box && (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom)) {
        cleanup();
        setDraggingIdx(null);
        setDragPos(null);
        props.onDragOut?.(props.item, child, ev.clientX, ev.clientY);
        props.onClose();
      }
    };

    const onUp = (ev: PointerEvent) => {
      cleanup();
      if (active) {
        // 仍在弹窗内松手：检查是否落到其他子图标上以排序
        const els = boxRef.current?.querySelectorAll<HTMLElement>("[data-folder-idx]");
        if (els) {
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
              const toIdx = Number(el.dataset.folderIdx);
              if (Number.isFinite(toIdx) && toIdx !== idx) {
                props.onReorder?.(props.item.id, idx, toIdx);
              }
              break;
            }
          }
        }
        window.setTimeout(() => { suppressClickRef.current = false; }, 50);
      }
      setDraggingIdx(null);
      setDragPos(null);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      className="overlay folder-pop"
      role="dialog"
      aria-modal="true"
      aria-label={props.item.name}
      onClick={(e) => { if (e.target === e.currentTarget && !suppressClickRef.current) props.onClose(); }}
    >
      <div className="folder-wrap" onClick={(e) => { if (e.target === e.currentTarget && !suppressClickRef.current) props.onClose(); }}>
        <div className="folder-title">
          {props.item.name}
          {props.admin && <span style={{ display: "block", fontSize: 11.5, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>拖动图标到框外即可移出到桌面</span>}
        </div>
        <div className="folder-box" ref={boxRef}>
          <div className="folder-grid">
            {kids.map((k, idx) => {
              const st = k.check ? props.statusOf?.(k.name) : undefined;
              const dotCls = !st ? "unknown" : st.status === "online" ? "" : st.status === "slow" ? "warn" : "off";
              const off = st?.status === "offline";
              const isDrag = draggingIdx === idx;
              return (
                <a
                  key={k.id}
                  data-folder-idx={idx}
                  className={`folder-item${off ? " bad" : ""}`}
                  href={k.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerDown={(e) => startChildPointer(e, k, idx)}
                  onClick={(e) => {
                    if (props.admin || suppressClickRef.current) { e.preventDefault(); return; }
                    recordVisit(k.id);
                  }}
                  onContextMenu={(e) => { e.preventDefault(); props.onContext?.(e, k); }}
                  style={{
                    opacity: isDrag ? 0.28 : 1,
                    cursor: props.admin ? (isDrag ? "grabbing" : "grab") : undefined,
                    touchAction: props.admin ? "none" : undefined,
                  }}
                >
                  <span className="folder-ico-wrap">
                    <IconBlock className={`folder-ico${off ? " off" : ""}`} url={k.url} name={k.name} icon={k.icon} size={26} />
                    {k.check && <span className={`badge-dot dot ${dotCls}`} aria-hidden="true" />}
                  </span>
                  <span className="name">{k.name}</span>
                </a>
              );
            })}
          </div>
        </div>
        {draggingIdx !== null && dragPos && kids[draggingIdx] && (
          <div
            style={{
              position: "fixed",
              left: dragPos.x,
              top: dragPos.y,
              transform: "translate(-50%, -50%) scale(1.08)",
              pointerEvents: "none",
              zIndex: 60,
              filter: "drop-shadow(0 16px 32px rgba(0, 0, 0, 0.45))",
            }}
          >
            <div className="folder-item">
              <span className="folder-ico-wrap">
                <IconBlock className="folder-ico" url={kids[draggingIdx].url} name={kids[draggingIdx].name} icon={kids[draggingIdx].icon} size={26} />
              </span>
              <span className="name">{kids[draggingIdx].name}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
