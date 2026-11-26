/* Widget 注册表：类型 → manifest（名称/分类/描述/默认跨列/默认 Bento 尺寸/组件）。
 * 新增 widget 三步：写组件 → 在此注册 → types.ts WidgetType 加成员。 */
import type { ComponentType } from "react";
import type { WidgetInstance, WidgetSize, WidgetType } from "../types";
import { WidgetMonitor, WidgetMonitorNas, WidgetMonitorRouter } from "../components/Monitor";
import { WeatherWidget } from "../components/WeatherWidget";
import { WidgetTodo } from "./WidgetTodo";
import { WidgetCalendar } from "./WidgetCalendar";
import { WidgetCountdown } from "./WidgetCountdown";
import { WidgetHotSearch } from "./WidgetHotSearch";
import { WidgetPomodoro } from "./WidgetPomodoro";
import { WidgetNotes } from "./WidgetNotes";
import { WidgetFrequent } from "./WidgetFrequent";

export type WidgetCategory = "效率" | "资讯" | "系统";

export interface WidgetProps {
  admin: boolean;
  inst?: WidgetInstance;
  data?: Record<string, unknown>;
  onTrend?: (deviceId: string) => void; // monitor 专用：打开趋势弹层
}

export interface WidgetManifest {
  type: WidgetType;
  name: string;
  desc: string;
  category: WidgetCategory;
  defaultSpan: 1 | 2;
  defaultSize: WidgetSize;
  Component: ComponentType<WidgetProps>;
}

export const widgetRegistry: WidgetManifest[] = [
  {
    type: "countdown",
    name: "纪念日",
    desc: "纪念日 / 目标日 + 模拟时钟",
    category: "效率",
    defaultSpan: 1,
    defaultSize: "2x1",
    Component: WidgetCountdown,
  },
  {
    type: "calendar",
    name: "日历",
    desc: "公历与农历",
    category: "效率",
    defaultSpan: 1,
    defaultSize: "1x1",
    Component: WidgetCalendar,
  },
  {
    type: "pomodoro",
    name: "番茄钟",
    desc: "25 分钟专注 / 5 分钟短休",
    category: "效率",
    defaultSpan: 1,
    defaultSize: "2x1",
    Component: WidgetPomodoro,
  },
  {
    type: "notes",
    name: "便签",
    desc: "随手记 · 本机存储",
    category: "效率",
    defaultSpan: 1,
    defaultSize: "2x2",
    Component: WidgetNotes,
  },
  {
    type: "todo",
    name: "待办",
    desc: "本机存储 · 不上传",
    category: "效率",
    defaultSpan: 1,
    defaultSize: "2x2",
    Component: WidgetTodo,
  },
  {
    type: "weather",
    name: "天气",
    desc: "实时气象与高低温",
    category: "资讯",
    defaultSpan: 1,
    defaultSize: "2x1",
    Component: WeatherWidget,
  },
  {
    type: "hotsearch",
    name: "热搜",
    desc: "百度 / 微博 / 知乎 / B站",
    category: "资讯",
    defaultSpan: 1,
    defaultSize: "2x2",
    Component: WidgetHotSearch,
  },
  {
    type: "frequent",
    name: "常用图标",
    desc: "按本机点击自动统计最常用站点",
    category: "效率",
    defaultSpan: 1,
    defaultSize: "2x1",
    Component: WidgetFrequent,
  },
  {
    type: "monitor-router",
    name: "路由器监控",
    desc: "iStoreOS / 主路由实时状态",
    category: "系统",
    defaultSpan: 1,
    defaultSize: "2x2",
    Component: WidgetMonitorRouter,
  },
  {
    type: "monitor-nas",
    name: "NAS 监控",
    desc: "飞牛 NAS / 存储实时状态",
    category: "系统",
    defaultSpan: 1,
    defaultSize: "2x2",
    Component: WidgetMonitorNas,
  },
];

const LEGACY_MONITOR_MANIFEST: WidgetManifest = {
  type: "monitor",
  name: "设备监控",
  desc: "路由器 / NAS 实时状态",
  category: "系统",
  defaultSpan: 2,
  defaultSize: "4x2",
  Component: WidgetMonitor,
};

export function manifestOf(type: WidgetType): WidgetManifest | undefined {
  if (type === "monitor") return LEGACY_MONITOR_MANIFEST;
  return widgetRegistry.find((m) => m.type === type);
}
