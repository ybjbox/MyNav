/* 纪念日 / 倒数日 WeTab 风格组件：晴朗风景渐变底 + 白色大号天数 + 精致白色 SVG 模拟时钟 */
import { useEffect, useState } from "react";
import { IconEdit, IconCheck, IconX } from "../components/icons";
import type { WidgetProps } from "./registry";

interface CountdownOverride {
  title: string;
  date: string;
}

const DEFAULT_TITLE = "与你相识";
const DEFAULT_DATE = "2020-05-20";

function loadOverride(id: string): CountdownOverride | null {
  try {
    const raw = localStorage.getItem(`nav.countdown.${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CountdownOverride>;
    if (typeof parsed.title === "string" && typeof parsed.date === "string") {
      return { title: parsed.title, date: parsed.date };
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

function saveOverride(id: string, val: CountdownOverride | null): void {
  try {
    if (!val) localStorage.removeItem(`nav.countdown.${id}`);
    else localStorage.setItem(`nav.countdown.${id}`, JSON.stringify(val));
  } catch {
    /* 忽略 */
  }
}

function calcDayDiff(dateStr: string, now: Date): { days: number; mode: "past" | "future" | "today" } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return { days: 0, mode: "today" };
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff > 0) return { days: diff, mode: "future" };
  if (diff < 0) return { days: Math.abs(diff), mode: "past" };
  return { days: 0, mode: "today" };
}

function formatDateZh(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return dateStr;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

function AnalogClock({ now }: { now: Date }) {
  const sec = now.getSeconds();
  const min = now.getMinutes() + sec / 60;
  const hr = (now.getHours() % 12) + min / 60;

  const hrDeg = hr * 30;
  const minDeg = min * 6;
  const secDeg = sec * 6;

  return (
    <svg
      className="wcd-clock"
      width="88"
      height="88"
      viewBox="0 0 80 80"
      aria-hidden="true"
      style={{ flexShrink: 0, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.18))" }}
    >
      <circle
        cx="40"
        cy="40"
        r="36"
        fill="rgba(255, 255, 255, 0.1)"
        stroke="rgba(255, 255, 255, 0.92)"
        strokeWidth="1.8"
      />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const r1 = i % 3 === 0 ? 30 : 32;
        const r2 = 34.5;
        return (
          <line
            key={i}
            x1={40 + r1 * Math.sin(angle)}
            y1={40 - r1 * Math.cos(angle)}
            x2={40 + r2 * Math.sin(angle)}
            y2={40 - r2 * Math.cos(angle)}
            stroke="#ffffff"
            strokeWidth={i % 3 === 0 ? 1.8 : 1}
            strokeLinecap="round"
            opacity={i % 3 === 0 ? 0.95 : 0.65}
          />
        );
      })}
      {/* 时针 */}
      <line
        x1="40"
        y1="40"
        x2="40"
        y2="22"
        stroke="#ffffff"
        strokeWidth="3.2"
        strokeLinecap="round"
        transform={`rotate(${hrDeg} 40 40)`}
      />
      {/* 分针 */}
      <line
        x1="40"
        y1="40"
        x2="40"
        y2="14"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        transform={`rotate(${minDeg} 40 40)`}
      />
      {/* 秒针 */}
      <line
        x1="40"
        y1="45"
        x2="40"
        y2="11"
        stroke="rgba(255, 255, 255, 0.85)"
        strokeWidth="1.1"
        strokeLinecap="round"
        transform={`rotate(${secDeg} 40 40)`}
      />
      <circle cx="40" cy="40" r="3" fill="#ffffff" />
    </svg>
  );
}

export function WidgetCountdown({ admin, inst, data }: WidgetProps) {
  const instId = inst?.id || "default";
  const cfgData = data ?? inst?.data;
  const baseTitle = typeof cfgData?.title === "string" && cfgData.title.trim() ? cfgData.title.trim() : DEFAULT_TITLE;
  const rawDate = typeof cfgData?.date === "string" ? cfgData.date : typeof cfgData?.targetDate === "string" ? cfgData.targetDate : DEFAULT_DATE;
  const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim()) ? rawDate.trim() : DEFAULT_DATE;

  const [override, setOverride] = useState<CountdownOverride | null>(() => loadOverride(instId));
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const title = override?.title || baseTitle;
  const date = override?.date || baseDate;
  const { days, mode } = calcDayDiff(date, now);

  const startEdit = () => {
    setDraftTitle(title);
    setDraftDate(date);
    setEditing(true);
  };

  const commitEdit = () => {
    const t = draftTitle.trim() || baseTitle;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(draftDate) ? draftDate : baseDate;
    const next = { title: t, date: d };
    saveOverride(instId, next);
    setOverride(next);
    setEditing(false);
  };

  const cardBg = "linear-gradient(180deg, #98b1bc 0%, #b5c5c7 62%, #d5b884 100%)";

  if (editing) {
    return (
      <div
        className="widget-countdown editing"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          height: "100%",
          padding: "18px 20px",
          boxSizing: "border-box",
          justifyContent: "center",
          background: cardBg,
          color: "#fff",
        }}
      >
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="事件名称"
          maxLength={24}
          aria-label="事件名称"
          style={{
            fontSize: 12.5,
            padding: "6px 10px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.92)",
            color: "#1e2430",
          }}
        />
        <input
          type="date"
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
          aria-label="目标日期"
          style={{
            fontSize: 12.5,
            padding: "6px 10px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.92)",
            color: "#1e2430",
          }}
        />
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setEditing(false)}
            title="取消"
            aria-label="取消"
            style={{ background: "rgba(0,0,0,0.25)", color: "#fff", border: "none", borderRadius: 12, padding: "4px 8px", cursor: "pointer" }}
          >
            <IconX size={13} />
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={commitEdit}
            title="保存"
            aria-label="保存"
            style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "4px 8px", cursor: "pointer" }}
          >
            <IconCheck size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="widget-countdown"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        height: "100%",
        minHeight: 0,
        padding: "18px 20px",
        boxSizing: "border-box",
        background: cardBg,
        color: "#ffffff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 柔和麦田地平线装饰 */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "28%",
          background: "linear-gradient(180deg, rgba(212,175,106,0) 0%, rgba(188,142,74,0.38) 100%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minWidth: 0, flex: 1, zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            className="wcd-title"
            title={title}
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "rgba(255, 255, 255, 0.94)",
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
          <button
            type="button"
            className="iconbtn wcd-edit"
            onClick={startEdit}
            title={admin ? "编辑倒数日" : "自定义本机倒数日"}
            aria-label="编辑倒数日"
            style={{
              width: 20,
              height: 20,
              opacity: admin ? 0.95 : 0.6,
              color: "#fff",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconEdit size={11} />
          </button>
        </div>

        <div className="wcd-days" style={{ display: "flex", alignItems: "baseline", gap: 5, margin: "4px 0" }}>
          <span
            style={{
              fontSize: 38,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              color: "#ffffff",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.18)",
            }}
          >
            {mode === "today" ? "今天" : days.toLocaleString("en-US")}
          </span>
          {mode !== "today" && (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.92)", fontWeight: 500 }}>
              {mode === "future" ? "天后" : "天"}
            </span>
          )}
        </div>

        <div
          className="wcd-date"
          style={{
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.9)",
            fontVariantNumeric: "tabular-nums",
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
          }}
        >
          {formatDateZh(date)}
        </div>
      </div>

      <div style={{ zIndex: 1 }}>
        <AnalogClock now={now} />
      </div>
    </div>
  );
}
