/* 番茄钟 WeTab 风格组件：25:00 专注 / 05:00 短休切换 + 开始/暂停/重置 */
import { useEffect, useState } from "react";
import { IconPlay, IconRefresh } from "../components/icons";
import type { WidgetProps } from "./registry";

type Mode = "focus" | "break";

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  break: 5 * 60,
};

function fmtTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function WidgetPomodoro(_props: WidgetProps) {
  const [mode, setMode] = useState<Mode>("focus");
  const [left, setLeft] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const switchMode = (next: Mode) => {
    setRunning(false);
    setMode(next);
    setLeft(DURATIONS[next]);
  };

  const reset = () => {
    setRunning(false);
    setLeft(DURATIONS[mode]);
  };

  const total = DURATIONS[mode];
  const pct = Math.max(0, Math.min(100, ((total - left) / total) * 100));

  return (
    <div
      className="widget-pomodoro"
      style={{
        height: "100%",
        minHeight: 0,
        padding: "18px 20px",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.94)",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["focus", "break"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => switchMode(m)}
                style={{
                  fontSize: 11.5,
                  fontWeight: active ? 600 : 500,
                  padding: "3px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: active ? (m === "focus" ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)") : "transparent",
                  color: active ? (m === "focus" ? "#ef4444" : "#10b981") : "#64748b",
                  cursor: "pointer",
                }}
              >
                {m === "focus" ? "专注 25m" : "短休 5m"}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            aria-label={running ? "暂停" : "开始"}
            title={running ? "暂停" : "开始"}
            style={{
              width: 28,
              height: 28,
              borderRadius: 12,
              border: "none",
              background: mode === "focus" ? "#ef4444" : "#10b981",
              color: "#fff",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {running ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <IconPlay size={13} />
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="重置"
            title="重置"
            style={{
              width: 28,
              height: 28,
              borderRadius: 12,
              border: "1px solid rgba(15, 23, 42, 0.1)",
              background: "#f8fafc",
              color: "#64748b",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconRefresh size={12} />
          </button>
        </div>
      </div>

      <div
        className="wpm-time"
        style={{
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          color: "#0f172a",
        }}
      >
        {fmtTimer(left)}
      </div>

      <div style={{ height: 4, borderRadius: 999, background: "rgba(15, 23, 42, 0.08)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 999,
            background: mode === "focus" ? "#ef4444" : "#10b981",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
