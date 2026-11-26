/* 全网热搜 WeTab 风格组件：纯白卡片 + 顶部 < 平台 > 切换 + Top 5 彩色序号榜单 */
import { useCallback, useEffect, useState } from "react";
import { IconRefresh } from "../components/icons";
import type { WidgetProps } from "./registry";

type HotSource = "baidu" | "weibo" | "zhihu" | "bilibili";

interface HotItem {
  rank: number;
  title: string;
  url: string;
  hot?: string | number;
}

interface HotResp {
  source: HotSource;
  updated_at: number;
  fallback: boolean;
  items: HotItem[];
}

const SOURCES: { id: HotSource; label: string }[] = [
  { id: "baidu", label: "百度" },
  { id: "weibo", label: "微博" },
  { id: "zhihu", label: "知乎" },
  { id: "bilibili", label: "B站" },
];

function isValidSource(v: unknown): v is HotSource {
  return v === "baidu" || v === "weibo" || v === "zhihu" || v === "bilibili";
}

function rankColor(rank: number): string {
  if (rank === 1) return "#ef4444";
  if (rank === 2) return "#f97316";
  if (rank === 3) return "#f59e0b";
  return "#94a3b8";
}

export function WidgetHotSearch({ inst, data }: WidgetProps) {
  const initSrc = data?.source ?? inst?.data?.source;
  const [source, setSource] = useState<HotSource>(isValidSource(initSrc) ? initSrc : "baidu");
  const [resp, setResp] = useState<HotResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (src: HotSource) => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch(`/api/hotsearch?source=${src}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as HotResp;
      if (!Array.isArray(d?.items)) throw new Error("数据格式错误");
      setResp(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(source);
  }, [source, load]);

  const curIdx = SOURCES.findIndex((s) => s.id === source);
  const curLabel = SOURCES[curIdx]?.label ?? "百度";
  const stepSource = (delta: number) => {
    const next = SOURCES[(curIdx + delta + SOURCES.length) % SOURCES.length];
    setSource(next.id);
  };

  const items = resp?.items.slice(0, 5) ?? [];

  return (
    <div
      className="widget-hotsearch"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        minHeight: 0,
        padding: "18px 20px",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.94)",
        color: "#1e2430",
      }}
    >
      {/* 顶部 < 平台 > 切换栏 */}
      <div
        className="whs-head"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          paddingBottom: 6,
          borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() => stepSource(-1)}
            title="上一个平台"
            aria-label="上一个热搜平台"
            style={{
              border: "none",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 13,
              padding: "2px 6px",
              borderRadius: 6,
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", minWidth: 32, textAlign: "center" }}>
            {curLabel}
          </span>
          <button
            type="button"
            onClick={() => stepSource(1)}
            title="下一个平台"
            aria-label="下一个热搜平台"
            style={{
              border: "none",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 13,
              padding: "2px 6px",
              borderRadius: 6,
            }}
          >
            ›
          </button>
        </div>

        <div className="whs-tabs" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {SOURCES.map((s) => {
            const active = source === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`whs-tab${active ? " on" : ""}`}
                aria-pressed={active}
                onClick={() => setSource(s.id)}
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  padding: "3px 8px",
                  borderRadius: 10,
                  border: "none",
                  background: active ? "var(--accent-dim)" : "transparent",
                  color: active ? "var(--accent)" : "#94a3b8",
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            );
          })}
          <button
            type="button"
            className="whs-refresh"
            onClick={() => void load(source)}
            disabled={loading}
            title="刷新榜单"
            aria-label="刷新热搜"
            style={{
              width: 22,
              height: 22,
              border: "none",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
            }}
          >
            <IconRefresh size={12} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="whs-loading" style={{ display: "flex", flexDirection: "column", gap: 9, padding: "2px 0" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 16, borderRadius: 6, background: "rgba(15, 23, 42, 0.06)" }} />
          ))}
        </div>
      ) : error || items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 8px", fontSize: 12.5, color: "#64748b" }}>
          热搜加载失败
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => void load(source)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: "#0f172a",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              重试
            </button>
          </div>
        </div>
      ) : (
        <ol
          className="whs-list"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          {items.map((item, idx) => {
            const rank = item.rank ?? idx + 1;
            return (
              <li key={`${source}-${rank}`} className="whs-item">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whs-link"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "2px 2px",
                    borderRadius: 6,
                    textDecoration: "none",
                    color: "#1e293b",
                    fontSize: 12.5,
                    lineHeight: 1.4,
                  }}
                >
                  <span
                    className={`whs-rank${rank <= 3 ? " top" : ""}`}
                    style={{
                      width: 14,
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                      color: rankColor(rank),
                    }}
                  >
                    {rank}
                  </span>
                  <span
                    className="whs-title"
                    title={item.title}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
