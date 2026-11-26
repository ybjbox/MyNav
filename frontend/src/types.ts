/* 共享类型：前端与 Functions API 之间 */

export interface CheckTarget {
  type: "tcp";
  host: string;
  port: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  url: string;
  desc?: string;
  icon?: string; // 图标键名（见 components/icons.tsx）、http(s)/data: 图标 URL
  check?: CheckTarget; // 勾选在线检测后由 collector 执行（文件夹无此项）
  children?: ServiceItem[]; // 文件夹子卡片：存在即为文件夹（无 url/探活）
}

export interface Group {
  id: string;
  name: string;
  services: ServiceItem[];
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string; // 含 %s 占位
}

/* 组件区：widget 实例（布局进 KV 跨设备同步；类型见 widgets/registry.tsx） */
export type WidgetType =
  | "monitor"
  | "monitor-router"
  | "monitor-nas"
  | "todo"
  | "calendar"
  | "countdown"
  | "hotsearch"
  | "weather"
  | "pomodoro"
  | "notes"
  | "frequent";
export type WidgetSize = "1x1" | "2x1" | "2x2" | "4x2";
export interface WidgetInstance {
  id: string;
  type: WidgetType;
  span: 1 | 2; // 网格跨列（兼容旧配置）
  size?: WidgetSize;
  x?: number; // GridStack 自由列坐标（0..7）
  y?: number; // GridStack 自由行坐标
  w?: number; // GridStack 自由列宽（1..8）
  h?: number; // GridStack 自由行高（1..8）
  data?: Record<string, unknown>;
}

export interface NavConfig {
  version: number;
  site: {
    title: string;
    wallpaper: string | null; // 预设壁纸 id 或 http(s) URL；null = 纯极光背景
    accent: string | null; // 覆盖强调色（hex）
    theme: "dark" | "light" | "auto";
    weather: {
      enabled: boolean;
      city: string;
      provider: "open-meteo" | "qweather"; // 天气源：Open-Meteo 免密钥兜底 / 和风天气（国内更准）
      qweatherHost: string; // 和风专属 API Host（Console → 设置 中查看，形如 abc123.re.qweather.com）
      qweatherKey: string; // 和风 API Key
    };
    frequentBar: boolean; // 常访栏开关
    iconSize: "sm" | "md" | "lg"; // 卡片图标块尺寸
    iconRadius: number; // 图标块圆角 px
  };
  privacy: { publicNav: boolean }; // false = 全站需登录
  search: {
    engines: SearchEngine[];
    default: string;
    history: boolean; // 搜索历史开关
    style: "default" | "compact" | "hidden"; // 搜索框样式
  };
  groups: Group[];
  widgets?: WidgetInstance[]; // 组件区（bento 网格）；旧配置无此字段 → 默认布局
  monitor: {
    thresholds: { cpu: number; mem: number; disk: number; downMinutes: number; temp: number; conn: number };
    sparkMinutes: number; // 设备卡迷你曲线窗口
    aiModel?: string; // 默认 AI 日志诊断模型 ID
    staleAlert?: { // 云端失联告警（Workers Cron 检测采集器停止推送时主动通知）
      enabled: boolean;
      bark: { url: string; key: string };
      telegram: { token: string; chatId: string };
      webhook: { url: string; template: string };
    };
  };
}

export interface TrafficInfo {
  iface: string;
  rx_bps: number; // 当前速率 B/s
  tx_bps: number;
  rx_total?: number; // 累计字节（可选）
  tx_total?: number;
}

export interface DiskInfo {
  mount: string;
  used_pct: number;
  total_gb: number;
}

export interface DeviceSample {
  id: string;
  name: string;
  kind: "router" | "nas" | "service" | "other";
  status: "online" | "offline" | "degraded";
  cpu?: number;
  mem?: number;
  load1?: number;
  temp?: number;
  uptime_s?: number;
  version?: string; // 固件/核心版本
  connections?: number; // conntrack / Clash 连接数
  internet?: boolean | null; // 路由器 WAN 连通性
  stale?: boolean; // 数据源滞后（采集器实例超时）
  disks?: DiskInfo[];
  traffic?: TrafficInfo;
  spark?: number[]; // 最近 N 分钟下行速率（collector 计算可选）
}

export interface SourceStatus {
  id: string;
  updated_at: number;
  stale: boolean;
}

export interface ServiceStatus {
  name: string;
  status: "online" | "offline" | "slow";
  latency_ms?: number;
  fails?: number;
}

export interface AlertItem {
  id: string;
  device: string;
  rule: string;
  severity: "warn" | "critical";
  message: string;
  first_seen: number;
  last_seen: number;
  resolved_at?: number | null;
}

export interface Snapshot {
  ts: number;
  devices: DeviceSample[];
  services: ServiceStatus[];
  alerts: AlertItem[];
  sources?: SourceStatus[]; // 多采集器实例状态（路由器插件 + NAS agent）
}

export interface HistoryPoint {
  ts: number; // 桶起始毫秒
  rx_avg: number;
  rx_max: number;
  tx_avg: number;
  tx_max: number;
  conn_avg?: number; // 连接数均值（可选）
  conn_max?: number;
}

export interface HistoryResp {
  device: string;
  range: string;
  bucket_s: number;
  points: HistoryPoint[];
  daily: { day: string; rx_gb: number; tx_gb: number }[];
}

export interface SessionInfo {
  authenticated: boolean;
  collectorConfigured: boolean;
}
