/* Meteocons 天气图标（Bas Milius，MIT）：离线子集渲染，WMO code → 图标名，昼夜区分 */
import { addCollection, Icon } from "@iconify/react";
import subset from "../lib/meteo-subset.json";

// 注册离线子集（模块级一次）；不含网络请求，CSP 安全
addCollection(subset as Parameters<typeof addCollection>[0]);

/** WMO weather code → Meteocons 图标名（isDay 区分昼夜；-fill 实底变体在组件里统一追加） */
export function weatherIconName(code: number, isDay: boolean): string {
  const day = isDay ? "-day" : "-night";
  switch (code) {
    case 0: return `clear${day}`; // 晴
    case 1: // 大部晴朗
    case 2: return `partly-cloudy${day}`; // 局部多云
    case 3: return `overcast${day}`; // 阴
    case 45:
    case 48: return isDay ? "fog" : "fog-night"; // 雾
    case 51:
    case 53:
    case 55:
    case 56: // 毛毛雨 / 冻雨（轻）
    case 57: return "drizzle";
    case 61:
    case 63:
    case 80:
    case 81: return "rain"; // 雨 / 阵雨
    case 65:
    case 82: return "rain"; // 大雨（同 rain，避免 extreme 视觉过重）
    case 66:
    case 67: return "sleet"; // 冻雨
    case 71:
    case 73:
    case 77:
    case 85:
    case 86: return "snow"; // 雪
    case 75: return "snow"; // 大雪
    case 95: // 雷暴
    case 96:
    case 99: return `thunderstorms${day}`;
    default: return "not-available";
  }
}

export function WeatherIcon(props: { code: number; isDay: boolean; size?: number; className?: string }) {
  return (
    <Icon
      icon={`meteocons:${weatherIconName(props.code, props.isDay)}-fill`}
      width={props.size ?? 56}
      height={props.size ?? 56}
      className={props.className}
      aria-hidden="true"
    />
  );
}
