/* 日历 WeTab 风格组件：纯白卡片 + 红色日期星期 + 右侧年月与纯前端农历 */
import { useEffect, useState } from "react";
import type { WidgetProps } from "./registry";

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const LUNAR_DAYS = [
  "", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

function getLunarDate(d: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "long",
      day: "numeric",
    });
    const parts = fmt.formatToParts(d);
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const dayRaw = parts.find((p) => p.type === "day")?.value ?? "";
    const num = parseInt(dayRaw, 10);
    const dayStr = !Number.isNaN(num) && num >= 1 && num <= 30 ? LUNAR_DAYS[num] : dayRaw;
    return `${month}${dayStr}`.trim() || fmt.format(d);
  } catch {
    return "";
  }
}

export function WidgetCalendar(_props: WidgetProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekday = WEEKDAYS[now.getDay()];
  const lunar = getLunarDate(now);

  return (
    <div
      className="widget-calendar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        height: "100%",
        minHeight: 0,
        padding: "18px 20px",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.94)",
        color: "#1e2430",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div
          className="wc-day"
          style={{
            fontSize: 34,
            fontWeight: 700,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            color: "#ef4444",
          }}
        >
          {day}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11.5,
            fontWeight: 600,
            color: "#ef4444",
          }}
        >
          {weekday}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div
          className="wc-ym"
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "#0f172a",
            whiteSpace: "nowrap",
          }}
        >
          {year}年{month}月
        </div>
        {lunar && (
          <div
            className="wc-lunar"
            style={{
              fontSize: 12,
              color: "#64748b",
              whiteSpace: "nowrap",
            }}
          >
            {lunar}
          </div>
        )}
      </div>
    </div>
  );
}
