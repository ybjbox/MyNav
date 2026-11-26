/* 天气卡片：Meteocons 精致图标 + 大温度 + 状态/城市 + 高低温。
 * 同时支持 Hero 独立卡片与 WeTab 白色/磨砂 Bento 组件。 */
import { useEffect, useState } from "react";
import { loadWeatherCache, saveWeatherCache, weatherInfo, type WeatherData } from "../lib/storage";
import { useStore } from "../state/store";
import { WeatherIcon } from "./WeatherIcon";
import type { WidgetInstance } from "../types";

function weatherGradient(code: number, isDay: boolean): string {
  if (code === 0) {
    return isDay
      ? "linear-gradient(135deg, #1d6fe8 0%, #38bdf8 100%)"
      : "linear-gradient(135deg, #172554 0%, #312e81 100%)";
  }
  if (code <= 3) {
    return isDay
      ? "linear-gradient(135deg, #3b5998 0%, #64748b 100%)"
      : "linear-gradient(135deg, #1e293b 0%, #334155 100%)";
  }
  if (code === 45 || code === 48) return "linear-gradient(135deg, #475569 0%, #64748b 100%)";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "linear-gradient(135deg, #4b6cb7 0%, #7c9ce0 100%)";
  if (code >= 95) return "linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "linear-gradient(135deg, #1e3a5f 0%, #3b6998 100%)";
  return "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)";
}

export function WeatherWidget(props: {
  city?: string;
  enabled?: boolean;
  admin?: boolean;
  inst?: WidgetInstance;
  data?: Record<string, unknown>;
}) {
  const { config } = useStore();
  const isWidget = !!props.inst;
  const dataCity = typeof (props.data?.city ?? props.inst?.data?.city) === "string"
    ? String(props.data?.city ?? props.inst?.data?.city).trim()
    : "";
  const city = dataCity || props.city || config.site.weather?.city || "南宁";
  const enabled = props.enabled !== undefined ? props.enabled : (config.site.weather?.enabled ?? true);

  const [data, setData] = useState<WeatherData | null>(() => (enabled ? loadWeatherCache(city) : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !city.trim()) { setData(null); return; }
    const cached = loadWeatherCache(city);
    if (cached) { setData(cached); setFailed(false); return; }
    let alive = true;
    setData(null);
    (async () => {
      try {
        const r = await fetch(`/api/weather?city=${encodeURIComponent(city.trim())}`);
        if (!r.ok) throw new Error(`天气接口 ${r.status}`);
        const d = (await r.json()) as WeatherData;
        if (d?.temp === undefined) throw new Error("天气数据缺失");
        saveWeatherCache(d);
        if (alive) { setData(d); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [city, enabled]);

  const h = new Date().getHours();
  const isDay = h >= 6 && h < 18;
  const info = data ? weatherInfo(data.code) : null;
  const bgGradient = data ? weatherGradient(data.code, isDay) : "linear-gradient(135deg, #3b5998 0%, #64748b 100%)";

  const widgetShell: React.CSSProperties | undefined = isWidget
    ? {
        width: "100%",
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
        background: data ? bgGradient : "rgba(255, 255, 255, 0.94)",
        color: data ? "#ffffff" : "#1e2430",
        border: "none",
        boxShadow: "none",
      }
    : undefined;

  if (!enabled) {
    return isWidget ? (
      <div style={{ ...widgetShell, justifyContent: "center", fontSize: 12.5, color: "#64748b" }}>
        天气已关闭，可在设置中开启
      </div>
    ) : null;
  }
  if (failed) {
    return isWidget ? (
      <div style={{ ...widgetShell, justifyContent: "center", fontSize: 12.5, color: "#64748b" }}>
        天气加载失败（{city}）
      </div>
    ) : null;
  }

  if (!data) {
    return (
      <div className={`weather-card skel${isWidget ? " widget-weather" : ""}`} style={widgetShell} aria-hidden="true">
        <div className="wc-main">
          <span className="wc-temp skel-bar" style={{ width: 74 }} />
          <span className="wc-cond skel-bar" style={{ width: 96 }} />
          <span className="wc-sub skel-bar" style={{ width: 70 }} />
        </div>
        <span className="wc-ico skel-bar" />
      </div>
    );
  }

  return (
    <div
      className={`weather-card${isWidget ? " widget-weather" : ""}`}
      style={widgetShell}
      title={`${data.city} · ${info!.text}（${data.source === "qweather" ? "和风天气" : "Open-Meteo"}）`}
    >
      <div className="wc-main">
        <span className="wc-temp" style={isWidget ? { color: "#ffffff", fontVariantNumeric: "tabular-nums" } : undefined}>
          {data.temp}<i style={isWidget ? { color: "rgba(255,255,255,0.85)" } : undefined}>°</i>
        </span>
        <span className="wc-cond" style={isWidget ? { color: "rgba(255,255,255,0.92)" } : undefined}>
          {info!.text}
        </span>
        <span className="wc-sub" style={isWidget ? { color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums" } : undefined}>
          <span className="wc-city">{data.city}</span>
          <span className="wc-range" style={isWidget ? { color: "rgba(255,255,255,0.75)" } : undefined}>{data.dailyMax}° / {data.dailyMin}°</span>
        </span>
      </div>
      <span className={isWidget ? "wc-ico-wrap" : undefined}>
        <WeatherIcon code={data.code} isDay={isDay} size={56} className="wc-ico" />
      </span>
    </div>
  );
}
