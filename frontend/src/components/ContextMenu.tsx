/* 通用右键菜单：定位到光标，点击外部/Escape 关闭 */
import React, { useEffect, useRef } from "react";

export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  dividerBefore?: boolean;
  onSelect?: () => void;
}

export function ContextMenu(props: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x: props.x, y: props.y });

  useEffect(() => {
    // 边缘收拢：超出视口时往回偏移
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({
        x: Math.min(props.x, window.innerWidth - r.width - 8),
        y: Math.min(props.y, window.innerHeight - r.height - 8),
      });
    }
    const close = () => props.onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("mousedown", close);
    document.addEventListener("contextmenu", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("contextmenu", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [props]);

  return (
    <div
      ref={ref}
      className="ctxmenu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {props.items.map((it, i) =>
        it.dividerBefore && i > 0 ? <div key={`d${i}`} className="ctxdivider" /> : null,
      )}
      {props.items.map((it) => (
        <button
          key={it.key}
          className={`ctxitem${it.danger ? " danger" : ""}`}
          onClick={() => { it.onSelect?.(); props.onClose(); }}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
