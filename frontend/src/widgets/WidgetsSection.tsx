/* 组件区：react-grid-layout v2 声明式 8 列自由拖拽 + 自由缩放 Bento 网格 */
import { useMemo, type RefObject } from "react";
import {
  Responsive,
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";

import { manifestOf } from "./registry";
import { IconGrip, IconPlus } from "../components/icons";
import type { WidgetInstance, WidgetSize, WidgetType } from "../types";

/** 将旧版预设 size/span 映射为 8 列网格初始宽高 */
function defaultWH(w: WidgetInstance): { w: number; h: number } {
  if (typeof w.w === "number" && typeof w.h === "number" && w.w >= 1 && w.h >= 1) {
    return { w: w.w, h: w.h };
  }
  const sz = w.size || (w.span === 2 ? "4x2" : manifestOf(w.type)?.defaultSize) || "2x1";
  switch (sz) {
    case "1x1": return { w: 2, h: 2 };
    case "2x1": return { w: 4, h: 2 };
    case "2x2": return { w: 4, h: 4 };
    case "4x2": return { w: 8, h: 4 };
    default: return { w: 4, h: 2 };
  }
}

export function WidgetDragPreview({ inst }: { inst: WidgetInstance }) {
  const m = manifestOf(inst.type);
  if (!m) return null;
  const Comp = m.Component;
  return (
    <div style={{ width: "100%", height: "100%", borderRadius: 22, overflow: "hidden" }}>
      <Comp admin={false} inst={inst} data={inst.data} />
    </div>
  );
}

export function WidgetsSection(props: {
  widgets: WidgetInstance[];
  admin: boolean;
  onTrend: (id: string) => void;
  onReorder?: (oldIdx: number, newIdx: number) => void;
  onLayoutChange?: (items: { id: string; x: number; y: number; w: number; h: number }[]) => void;
  onAdd: (type: WidgetType) => void;
  onRemove: (id: string) => void;
  onToggleSpan?: (id: string) => void;
  onCycleSize?: (id: string, nextSize: WidgetSize) => void;
  onOpenStore?: () => void;
}) {
  const { width, containerRef, mounted } = useContainerWidth();

  const lgLayout: LayoutItem[] = useMemo(() => {
    let autoX = 0;
    let autoY = 0;
    return props.widgets.map((w) => {
      const dim = defaultWH(w);
      const hasPos = typeof w.x === "number" && typeof w.y === "number";
      let x = hasPos ? w.x! : autoX;
      let y = hasPos ? w.y! : autoY;
      if (!hasPos) {
        if (autoX + dim.w > 8) {
          autoX = 0;
          autoY += 2;
          x = 0;
          y = autoY;
        }
        autoX += dim.w;
      }
      return {
        i: w.id,
        x,
        y,
        w: dim.w,
        h: dim.h,
        minW: 1,
        minH: 1,
        maxW: 8,
      };
    });
  }, [props.widgets]);

  const layouts = useMemo(() => ({ lg: lgLayout }), [lgLayout]);

  const handleLayoutChange = (current: Layout) => {
    if (!props.admin || !props.onLayoutChange) return;
    // 仅在有实际坐标或尺寸变化时同步，避免初次挂载无谓触发 dirty
    let changed = false;
    const updates = current.map((it) => {
      const orig = props.widgets.find((w) => w.id === it.i);
      const dim = orig ? defaultWH(orig) : { w: it.w, h: it.h };
      if (!orig || orig.x !== it.x || orig.y !== it.y || dim.w !== it.w || dim.h !== it.h) {
        changed = true;
      }
      return { id: it.i, x: it.x, y: it.y, w: it.w, h: it.h };
    });
    if (changed && updates.length > 0) {
      props.onLayoutChange(updates);
    }
  };

  const activeCols = width >= 820 ? 8 : width >= 520 ? 4 : 2;
  const colWidth = width > 0 ? (width - 14 * (activeCols - 1)) / activeCols : 116;
  const rowHeight = Math.max(92, Math.round(colWidth + 16));

  return (
    <section className="block" aria-label="组件">
      <div ref={containerRef as RefObject<HTMLDivElement>} className={`wetab-rgl${props.admin ? " is-admin" : ""}`}>
        {mounted && (
          <Responsive
            width={width}
            layouts={layouts}
            breakpoints={{ lg: 820, md: 520, sm: 0 }}
            cols={{ lg: 8, md: 4, sm: 2 }}
            rowHeight={rowHeight}
            margin={[14, 14]}
            containerPadding={[0, 0]}
            dragConfig={{
              enabled: props.admin,
              handle: ".wetab-wcard",
              cancel: "input, textarea, button, select, a, .no-drag",
            }}
            resizeConfig={{
              enabled: props.admin,
              handles: ["e", "se", "s", "sw", "w"],
            }}
            compactor={verticalCompactor}
            onLayoutChange={handleLayoutChange}
          >
            {props.widgets.map((inst) => {
              const m = manifestOf(inst.type);
              if (!m) return null;
              const Comp = m.Component;
              const dim = defaultWH(inst);

              return (
                <div key={inst.id} className="wetab-rgl-item">
                  <div
                    className="widget wetab-widget"
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      background: "transparent",
                      border: "none",
                      boxShadow: "none",
                      padding: 0,
                    }}
                    aria-label={`组件 ${m.name}`}
                  >
                    <div
                      className={`wetab-wcard${props.admin ? " is-admin" : ""}`}
                      style={{
                        flex: 1,
                        minHeight: 0,
                        borderRadius: 22,
                        overflow: "hidden",
                        position: "relative",
                        containerType: "size",
                        containerName: "wcard",
                        cursor: props.admin ? "grab" : undefined,
                        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.65)",
                      }}
                    >
                      {props.admin && (
                        <div
                          className="wetab-wtools no-drag"
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            zIndex: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            background: "rgba(18, 22, 28, 0.72)",
                            backdropFilter: "blur(8px)",
                            padding: "3px 6px",
                            borderRadius: 999,
                            border: "1px solid rgba(255, 255, 255, 0.16)",
                            color: "#fff",
                          }}
                        >
                          <span
                            className="drag-handle"
                            title="拖拽调整位置，拖动右下角/边缘自由调整大小"
                            style={{ display: "inline-flex", padding: 2 }}
                          >
                            <IconGrip size={12} />
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              padding: "0 5px",
                              color: "rgba(255,255,255,0.82)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                            title="当前网格尺寸（可拖动边缘自由缩放）"
                          >
                            {dim.w}×{dim.h}
                          </span>
                          <button
                            className="iconbtn"
                            title="移除组件"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => props.onRemove(inst.id)}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 999,
                              border: "none",
                              background: "rgba(239, 68, 68, 0.25)",
                              color: "#fca5a5",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 13,
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <div className="wbody" style={{ height: "100%", padding: 0 }}>
                        <Comp admin={props.admin} inst={inst} data={inst.data} onTrend={props.onTrend} />
                      </div>
                    </div>

                    <div
                      className="wetab-wlabel"
                      style={{
                        marginTop: 6,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#ffffff",
                        textAlign: "center",
                        textShadow: "0 1px 4px rgba(0, 0, 0, 0.65)",
                        letterSpacing: "0.01em",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        flexShrink: 0,
                      }}
                    >
                      {m.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </Responsive>
        )}
      </div>

      {props.admin && (
        <div style={{ marginTop: 12 }}>
          <button
            className="addwidget"
            style={{ width: "100%" }}
            onClick={() => props.onOpenStore?.()}
          >
            <IconPlus size={18} />
            添加组件（管理模式下可拖动小组件边缘或角标自由缩放）
          </button>
        </div>
      )}
    </section>
  );
}
