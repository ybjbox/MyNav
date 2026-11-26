import type { Snapshot, HistoryResp } from "../types";

/** 演示快照：采集器尚未推送时展示界面用（界面上会明确标注"示例数据"） */
export const mockSnapshot: Snapshot = {
  ts: Date.now(),
  devices: [
    {
      id: "router",
      name: "iStoreOS 主路由",
      kind: "router",
      status: "online",
      cpu: 23.5, mem: 51.2, load1: 1.35, temp: 44, uptime_s: 26 * 86400 + 7 * 3600,
      traffic: { iface: "pppoe-wan", rx_bps: 86.4 * 1024 * 1024, tx_bps: 12.6 * 1024 * 1024 },
      spark: mockSpark(48, 40e6, 90e6),
    },
    {
      id: "nas",
      name: "飞牛 NAS",
      kind: "nas",
      status: "degraded",
      cpu: 36.1, mem: 43.0, temp: 41, uptime_s: 41 * 86400 + 2 * 3600,
      disks: [{ mount: "/vol1", used_pct: 91.2, total_gb: 19000 }],
      traffic: { iface: "eth0", rx_bps: 3.2 * 1024 * 1024, tx_bps: 8.7 * 1024 * 1024 },
      spark: mockSpark(48, 6e6, 12e6),
    },
  ],
  services: [
    { name: "哔哩哔哩", status: "online", latency_ms: 36 },
    { name: "飞牛 fnOS", status: "online", latency_ms: 3 },
    { name: "iStoreOS", status: "online", latency_ms: 2 },
    { name: "Jellyfin", status: "online", latency_ms: 12 },
    { name: "qBittorrent", status: "online", latency_ms: 8 },
    { name: "Alist", status: "offline", fails: 2 },
  ],
  alerts: [
    {
      id: "nas-disk-90",
      device: "nas",
      rule: "disk_usage",
      severity: "critical",
      message: "磁盘 /vol1 用量 91%，超过阈值 90%",
      first_seen: Date.now() - 5.9 * 3600 * 1000,
      last_seen: Date.now(),
      resolved_at: null,
    },
  ],
};

function mockSpark(n: number, min: number, max: number): number[] {
  const out: number[] = [];
  let v = (min + max) / 2;
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.48) * (max - min) * 0.12;
    v = Math.min(max, Math.max(min, v));
    out.push(Math.round(v));
  }
  return out;
}

export function mockHistory(device: string, range: string): HistoryResp {
  const cfg = { "24h": { buckets: 48, bucket_s: 1800 }, "7d": { buckets: 56, bucket_s: 10800 }, "30d": { buckets: 60, bucket_s: 43200 } }[
    range
  ] || { buckets: 48, bucket_s: 1800 };
  const now = Math.floor(Date.now() / 1000);
  const points = [];
  for (let i = cfg.buckets; i >= 0; i--) {
    const ts = (now - i * cfg.bucket_s) * 1000;
    const dayF = Math.sin((ts / 3600000) * 0.35) * 0.4 + Math.sin((ts / 3600000) * 1.7) * 0.15 + 0.5;
    const base = device === "router" ? 45e6 : 6e6;
    points.push({
      ts,
      rx_avg: base * dayF,
      rx_max: base * dayF * 1.6,
      tx_avg: base * 0.2 * dayF,
      tx_max: base * 0.35 * dayF,
    });
  }
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400 * 1000);
    daily.push({
      day: `${d.getMonth() + 1}/${d.getDate()}`,
      rx_gb: +(6 + Math.sin(i * 1.3) * 3 + Math.random() * 2).toFixed(1),
      tx_gb: +(1.5 + Math.sin(i * 0.9) * 0.6).toFixed(1),
    });
  }
  return { device, range, bucket_s: cfg.bucket_s, points, daily };
}
