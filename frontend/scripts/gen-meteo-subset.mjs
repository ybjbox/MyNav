/* 从 @iconify-json/meteocons 抽取天气卡片所需图标子集 → src/lib/meteo-subset.json
 * 运行：npm run icons:meteo（新增映射图标后重跑一次即可） */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { getIcons } from "@iconify/utils";

const require = createRequire(import.meta.url);
const meteo = require("@iconify-json/meteocons/icons.json");

const NAMES = [
  // 昼夜基础（-fill 实底变体：白卡上更饱和醒目，WeTab 式）
  "clear-day-fill", "clear-night-fill",
  "partly-cloudy-day-fill", "partly-cloudy-night-fill",
  "overcast-day-fill", "overcast-night-fill",
  "cloudy-fill",
  // 雾
  "fog-fill", "fog-night-fill",
  // 降水（时间无关；阵雨/小雨统一用 rain/drizzle）
  "drizzle-fill", "rain-fill", "snow-fill", "sleet-fill",
  // 雷暴
  "thunderstorms-day-fill", "thunderstorms-night-fill",
  // 兜底
  "not-available-fill",
];

const subset = getIcons(meteo, NAMES);
const missing = NAMES.filter((n) => !subset.icons[n]);
if (missing.length) {
  console.error("图标缺失（需调整映射）:", missing.join(", "));
  process.exit(1);
}
const out = new URL("../src/lib/meteo-subset.json", import.meta.url);
writeFileSync(out, JSON.stringify(subset));
console.log(`已写入 ${Object.keys(subset.icons).length} 个图标 → src/lib/meteo-subset.json`);
