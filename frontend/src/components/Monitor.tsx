/* 设备监控 WeTab 风格卡片：浅色磨砂白底 + 清晰 KPI 进度条 + 速率 + 迷你曲线 + 趋势弹层 */
import { IconDown, IconUp, IconRouter, IconNas, IconChevron, IconLink } from "./icons";
import { Sparkline } from "./primitives";
import { fmtBps, fmtUptime } from "../lib/format";
import { useStore } from "../state/store";
import type { DeviceSample, NavConfig } from "../types";

function barColor(pct: number, threshold: number, dangerAt?: number): string {
  const crit = dangerAt ?? threshold;
  if (pct >= crit) return "#ef4444";
  if (pct >= threshold - 15) return "#f59e0b";
  return "#10b981";
}

function DeviceCard({
  dev,
  thresholds,
  activeAlerts: _activeAlerts,
  onTrend,
}: {
  dev: DeviceSample;
  thresholds: NavConfig["monitor"]["thresholds"];
  activeAlerts: { device: string; severity: string }[];
  onTrend: () => void;
}) {
  const offline = dev.status === "offline";
  const isService = dev.kind === "service";
  const disks = dev.disks || [];
  const worstDisk = disks.length ? Math.max(...disks.map((d) => d.used_pct)) : undefined;

  const kpis: { k: string; v: string; unit?: string; pct?: number; color?: string }[] = [];
  if (!isService && dev.cpu !== undefined) kpis.push({ k: "CPU", v: String(Math.round(dev.cpu)), unit: "%", pct: dev.cpu, color: barColor(dev.cpu, thresholds.cpu) });
  if (!isService && dev.mem !== undefined) kpis.push({ k: "内存", v: String(Math.round(dev.mem)), unit: "%", pct: dev.mem, color: barColor(dev.mem, thresholds.mem) });
  if (!isService && dev.load1 !== undefined && dev.load1 < 100) kpis.push({ k: "负载", v: dev.load1.toFixed(2), pct: Math.min(100, dev.load1 * 50), color: barColor(Math.min(100, dev.load1 * 50), thresholds.cpu) });
  if (worstDisk !== undefined) {
    const d = disks.find((x) => x.used_pct === worstDisk)!;
    kpis.push({ k: `磁盘 ${d.mount}`, v: String(Math.round(worstDisk)), unit: "%", pct: worstDisk, color: barColor(worstDisk, thresholds.disk, thresholds.disk + 1) });
  }

  const rx = dev.traffic ? fmtBps(dev.traffic.rx_bps) : null;
  const tx = dev.traffic ? fmtBps(dev.traffic.tx_bps) : null;
  const kindLabel = isService ? "服务" : dev.kind === "router" ? "路由器" : dev.kind === "nas" ? "NAS" : "设备";

  return (
    <div
      className={`dev enter${offline ? " offline" : ""}`}
      style={{
        background: "rgba(248, 250, 252, 0.92)",
        border: "1px solid rgba(15, 23, 42, 0.06)",
        borderRadius: 14,
        padding: "12px 14px",
        color: "#0f172a",
        opacity: offline ? 0.72 : 1,
      }}
    >
      <div className="dev-head" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <span
          className="devico"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(37, 99, 235, 0.1)",
            color: "#2563eb",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isService ? <IconLink size={15} /> : dev.kind === "router" ? <IconRouter size={15} /> : <IconNas size={15} />}
        </span>
        <span className="dname" style={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{dev.name}</span>
        {dev.internet === false && (
          <span className="tag" style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 999, color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}>断网</span>
        )}
        {dev.stale && (
          <span className="tag" style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 999, color: "#d97706", border: "1px solid rgba(245,158,11,0.4)" }}>数据滞后</span>
        )}
        <span className="tag" style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 999, background: "rgba(15,23,42,0.06)", color: "#475569", border: "none" }}>
          {kindLabel}
        </span>
        {dev.version && (
          <span className="tag" title={dev.version} style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 999, background: "rgba(15,23,42,0.05)", color: "#64748b", border: "none" }}>
            {dev.version}
          </span>
        )}
        <span className="up" style={{ marginLeft: "auto", fontSize: 11.5, color: offline ? "#ef4444" : "#10b981", fontWeight: 500 }}>
          {offline ? "离线" : isService ? "运行中" : fmtUptime(dev.uptime_s)}
        </span>
      </div>

      {dev.traffic && rx && tx && (
        <div className="rates" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div className="rate" style={{ background: "#fff", borderRadius: 12, padding: "6px 8px", border: "1px solid rgba(15,23,42,0.06)" }}>
            <span className="rlbl" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
              <IconDown size={12} />{dev.traffic.iface} 下行
            </span>
            <span className="rv" style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
              {rx.val}<small style={{ fontSize: 10.5, fontWeight: 500, color: "#64748b", marginLeft: 2 }}>{rx.unit}</small>
            </span>
          </div>
          <div className="rate" style={{ background: "#fff", borderRadius: 12, padding: "6px 8px", border: "1px solid rgba(15,23,42,0.06)" }}>
            <span className="rlbl" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
              <IconUp size={12} />{dev.traffic.iface} 上行
            </span>
            <span className="rv" style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
              {tx.val}<small style={{ fontSize: 10.5, fontWeight: 500, color: "#64748b", marginLeft: 2 }}>{tx.unit}</small>
            </span>
          </div>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="kpis" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(kpis.length, 3)}, minmax(0, 1fr))`, gap: 8, marginBottom: 8 }}>
          {kpis.map((r) => (
            <div className="kpi" key={r.k} style={{ background: "#fff", borderRadius: 12, padding: "6px 8px", border: "1px solid rgba(15,23,42,0.06)" }}>
              <span className="k" style={{ display: "block", fontSize: 10.5, color: "#64748b" }}>{r.k}</span>
              <span className="v" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "2px 0 4px", fontVariantNumeric: "tabular-nums" }}>
                {r.v}{r.unit && <small style={{ fontSize: 10.5, color: "#64748b" }}>{r.unit}</small>}
              </span>
              <span className="bar" style={{ display: "block", height: 4, borderRadius: 999, background: "rgba(15,23,42,0.08)", overflow: "hidden" }}>
                <i style={{ display: "block", height: "100%", borderRadius: 999, width: `${Math.max(2, Math.min(100, r.pct ?? 0))}%`, background: r.color }} />
              </span>
            </div>
          ))}
        </div>
      )}

      {dev.spark && dev.spark.length > 1 && (
        <div className="spark" aria-hidden="true" style={{ marginBottom: 6 }}>
          <Sparkline data={dev.spark} color={dev.status === "degraded" ? "#f59e0b" : "#2563eb"} />
        </div>
      )}

      <div className="dev-foot" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "#64748b", paddingTop: 4 }}>
        <span className="temp">
          {dev.connections !== undefined && dev.connections > 0 && `连接 ${dev.connections} · `}
          {dev.temp !== undefined && !isService && `${Math.round(dev.temp)}°C · `}
          {offline ? "等待恢复" : dev.traffic ? (isService ? "代理速率" : dev.kind === "router" ? "WAN 口速率" : "主网卡速率") : isService ? "等待流量数据" : "指标监控中"}
        </span>
        <button
          className="trend"
          onClick={onTrend}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            border: "none",
            background: "transparent",
            color: "#2563eb",
            fontWeight: 500,
            fontSize: 11.5,
            cursor: "pointer",
            padding: 0,
          }}
        >
          查看趋势 <IconChevron size={13} />
        </button>
      </div>
    </div>
  );
}

/** 设备监控 widget 内容（支持按 kind 过滤为独立路由器 / NAS 监控卡片） */
export function WidgetMonitor(props: { admin: boolean; onTrend?: (deviceId: string) => void; kind?: "router" | "nas" }) {
  const { snapshot, config, authed } = useStore();
  const kindTitle = props.kind === "router" ? "路由器" : props.kind === "nas" ? "NAS" : "设备";

  const wrapStyle: React.CSSProperties = {
    height: "100%",
    padding: "16px 18px",
    boxSizing: "border-box",
    background: "rgba(255, 255, 255, 0.92)",
    color: "#0f172a",
    overflowY: "auto",
  };

  if (!authed) {
    return (
      <div style={{ ...wrapStyle, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#64748b", fontSize: 13 }}>
        登录后可见{kindTitle}监控与历史趋势
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className="devgrid" style={wrapStyle}>
        <div className="skel" style={{ height: 140, borderRadius: 12, background: "rgba(15,23,42,0.06)" }} />
      </div>
    );
  }

  const devices = props.kind ? snapshot.devices.filter((d) => d.kind === props.kind) : snapshot.devices;

  if (devices.length === 0) {
    return (
      <div style={{ ...wrapStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#475569", fontSize: 13 }}>
        尚未发现{kindTitle}设备
        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>在设备上部署采集器并配置推送后，{kindTitle}状态会出现在这里</div>
      </div>
    );
  }
  return (
    <div
      className="devgrid"
      style={{
        ...wrapStyle,
        display: "grid",
        gridTemplateColumns: devices.length === 1 ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 10,
      }}
    >
      {devices.map((d) => (
        <DeviceCard
          key={d.id}
          dev={d}
          thresholds={config.monitor.thresholds}
          activeAlerts={snapshot.alerts.filter((a) => !a.resolved_at).map((a) => ({ device: a.device, severity: a.severity }))}
          onTrend={() => props.onTrend?.(d.id)}
        />
      ))}
    </div>
  );
}

export function WidgetMonitorRouter(props: { admin: boolean; onTrend?: (deviceId: string) => void }) {
  return <WidgetMonitor {...props} kind="router" />;
}

export function WidgetMonitorNas(props: { admin: boolean; onTrend?: (deviceId: string) => void }) {
  return <WidgetMonitor {...props} kind="nas" />;
}
