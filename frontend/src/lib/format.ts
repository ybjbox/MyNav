/* 数值与时间格式化 */

export function fmtBps(bps: number): { val: string; unit: string } {
  if (!isFinite(bps) || bps < 0) return { val: "—", unit: "" };
  if (bps < 1024) return { val: bps.toFixed(0), unit: "B/s" };
  if (bps < 1024 * 1024) return { val: (bps / 1024).toFixed(1), unit: "KB/s" };
  if (bps < 1024 * 1024 * 1024) return { val: (bps / 1024 / 1024).toFixed(1), unit: "MB/s" };
  return { val: (bps / 1024 / 1024 / 1024).toFixed(2), unit: "GB/s" };
}

export function fmtGB(bytes: number): string {
  if (!isFinite(bytes)) return "—";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + " GB";
}

export function fmtUptime(s?: number): string {
  if (!s || s <= 0) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `运行 ${d} 天`;
  if (h > 0) return `运行 ${h} 小时`;
  return `运行 ${m} 分钟`;
}

export function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
    return hhmm;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`;
}

export function fmtDur(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}天 ${h}h` : `${d}天`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function greeting(h: number): string {
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 13) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
export function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`;
}

/** 数值滚动：向目标值平滑逼近（用于速率数字） */
export function easeTo(cur: number, target: number, factor = 0.35): number {
  if (!isFinite(target)) return target;
  return cur + (target - cur) * factor;
}
