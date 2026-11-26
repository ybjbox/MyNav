/* 组件库弹窗（Widget Store）：分类筛选 + 实时组件预览 + 尺寸选择 + 一键添加/移除 */
import { useEffect, useState } from "react";
import { Button, Segmented } from "antd";
import { IconX, IconPlus, IconTrash, IconRouter, IconNas } from "../components/icons";
import { widgetRegistry, type WidgetCategory, type WidgetManifest } from "./registry";
import { useStore } from "../state/store";
import type { WidgetInstance, WidgetSize, WidgetType } from "../types";

const CATEGORIES: ("全部" | WidgetCategory)[] = ["全部", "效率", "资讯", "系统"];
const SIZES: WidgetSize[] = ["1x1", "2x1", "2x2", "4x2"];

function MonitorDemoPreview({ kind }: { kind?: "router" | "nas" }) {
  const showRouter = !kind || kind === "router";
  const showNas = !kind || kind === "nas";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "12px 14px",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.94)",
        color: "#0f172a",
        display: "grid",
        gridTemplateColumns: showRouter && showNas ? "1fr 1fr" : "1fr",
        gap: 8,
        alignItems: "center",
      }}
    >
      {showRouter && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            <IconRouter size={13} /> iStoreOS 主路由
            <span style={{ marginLeft: "auto", color: "#10b981", fontSize: 10 }}>在线</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>CPU 18% · 内存 42%</div>
          <div style={{ height: 4, borderRadius: 999, background: "rgba(15,23,42,0.08)", marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: "42%", height: "100%", background: "#10b981" }} />
          </div>
        </div>
      )}
      {showNas && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            <IconNas size={13} /> 飞牛 NAS
            <span style={{ marginLeft: "auto", color: "#10b981", fontSize: 10 }}>在线</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>磁盘 64% · 38°C</div>
          <div style={{ height: 4, borderRadius: 999, background: "rgba(15,23,42,0.08)", marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: "64%", height: "100%", background: "#2563eb" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function WidgetPreviewBox({ m, authed }: { m: WidgetManifest; authed: boolean }) {
  const Comp = m.Component;
  const fakeInst: WidgetInstance = {
    id: `preview-${m.type}`,
    type: m.type,
    span: m.defaultSpan,
    size: m.defaultSize,
  };

  return (
    <div className="wstore-preview" aria-hidden="true">
      <div
        style={{
          width: "130%",
          height: "130%",
          transform: "scale(0.76)",
          transformOrigin: "center center",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "stretch",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 18, overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>
          {(m.type === "monitor" || m.type === "monitor-router" || m.type === "monitor-nas") && !authed ? (
            <MonitorDemoPreview kind={m.type === "monitor-router" ? "router" : m.type === "monitor-nas" ? "nas" : undefined} />
          ) : (
            <Comp admin={false} inst={fakeInst} />
          )}
        </div>
      </div>
    </div>
  );
}

export function WidgetStoreModal(props: {
  widgets: WidgetInstance[];
  onAdd: (type: WidgetType, size?: WidgetSize) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  embedded?: boolean;
}) {
  const { authed } = useStore();
  const [cat, setCat] = useState<"全部" | WidgetCategory>("全部");
  const [selectedSizes, setSelectedSizes] = useState<Partial<Record<WidgetType, WidgetSize>>>({});

  useEffect(() => {
    if (props.embedded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  const list = cat === "全部" ? widgetRegistry : widgetRegistry.filter((m) => m.category === cat);

  const body = (
    <>
      <div style={{ marginTop: props.embedded ? 0 : 14, marginBottom: 14 }}>
        <Segmented
          value={cat}
          onChange={(v) => setCat(v as "全部" | WidgetCategory)}
          options={CATEGORIES}
        />
      </div>

      <div className="wstore-grid">
        {list.map((m) => {
          const existing = props.widgets.find((w) => w.type === m.type);
          const curSize = selectedSizes[m.type] || m.defaultSize;
          return (
            <div key={m.type} className="wstore-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14.5 }}>{m.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                    fontWeight: 500,
                  }}
                >
                  {m.category}
                </span>
              </div>

              <WidgetPreviewBox m={m} authed={authed} />

              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }}>{m.desc}</div>

              <Segmented
                size="small"
                value={curSize}
                onChange={(sz) => setSelectedSizes((prev) => ({ ...prev, [m.type]: sz as WidgetSize }))}
                options={SIZES.map((sz) => ({ label: sz.replace("x", "×"), value: sz }))}
              />

              <div className="wstore-actions" style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 4 }}>
                {existing ? (
                  <>
                    <Button
                      danger
                      size="small"
                      icon={<IconTrash size={13} />}
                      style={{ flex: 1 }}
                      onClick={() => props.onRemove(existing.id)}
                    >
                      移除
                    </Button>
                    <Button
                      size="small"
                      title="再添加一个"
                      icon={<IconPlus size={13} />}
                      onClick={() => props.onAdd(m.type, curSize)}
                    />
                  </>
                ) : (
                  <Button
                    type="primary"
                    size="small"
                    icon={<IconPlus size={13} />}
                    style={{ flex: 1 }}
                    onClick={() => props.onAdd(m.type, curSize)}
                  >
                    添加
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (props.embedded) return body;

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="组件库"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 740, width: "94vw" }}>
        <div className="modal-head">
          <span className="t">组件库</span>
          <button className="iconbtn close" aria-label="关闭" onClick={props.onClose}>
            <IconX size={15} />
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
