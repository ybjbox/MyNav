/* 常访小组件：按本机点击统计最常用站点（WeTab 纯白 Bento 卡片） */
import { useMemo } from "react";
import { IconBlock } from "../components/IconBlock";
import { IconFlame } from "../components/icons";
import { loadVisits, recordVisit } from "../lib/storage";
import { useStore } from "../state/store";
import type { WidgetProps } from "./registry";

export function WidgetFrequent(_props: WidgetProps) {
  const { config } = useStore();
  const visits = useMemo(() => loadVisits(), [config.version]);

  const items = useMemo(() => {
    const all: { id: string; name: string; url: string; icon?: string; count: number; last: number }[] = [];
    for (const g of config.groups) {
      for (const s of g.services) {
        if (s.children) continue;
        const v = visits[s.id];
        if (v && v.count > 0) {
          all.push({ id: s.id, name: s.name, url: s.url, icon: s.icon, count: v.count, last: v.last });
        }
      }
    }
    const sorted = all.sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 8);
    if (sorted.length >= 2) return { list: sorted, fallback: false };

    // 暂无足够点击记录时，兜底展示首个分组的前 6 个图标（确保组件库预览与新用户首屏美观饱满）
    const defaults = (config.groups[0]?.services || [])
      .filter((s) => !s.children)
      .slice(0, 6)
      .map((s) => ({ id: s.id, name: s.name, url: s.url, icon: s.icon, count: 0, last: 0 }));
    return { list: defaults, fallback: true };
  }, [config.groups, visits]);

  return (
    <div
      style={{
        height: "100%",
        padding: "16px 18px",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.94)",
        color: "#1e2430",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>
          <IconFlame size={15} />
          常用图标
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          {items.fallback ? "推荐 · 按点击自动更新" : "按本机点击统计"}
        </span>
      </div>

      {items.list.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 12.5 }}>
          暂无常用图标
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))",
            gap: "10px 8px",
            alignContent: "start",
            overflowY: "auto",
          }}
        >
          {items.list.map((t) => (
            <a
              key={t.id}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordVisit(t.id)}
              title={t.count > 0 ? `${t.name} · 已访问 ${t.count} 次` : t.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                textDecoration: "none",
                color: "#334155",
                textAlign: "center",
              }}
            >
              <IconBlock className="ico-block" url={t.url} name={t.name} icon={t.icon} size={22} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.name}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
