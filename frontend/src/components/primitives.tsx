/* SVG 图元：迷你曲线与趋势图（自绘，无图表库） */
import React from "react";

/** 迷你面积曲线：data 为采样数组，纵向自适应 */
export function Sparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  const gradId = React.useId().replace(/[:]/g, "");
  const pts = React.useMemo(() => {
    const src = data.length > 1 ? data : [0, 0];
    const min = Math.min(...src);
    const max = Math.max(...src);
    const span = Math.max(max - min, 1e-9);
    const W = 300;
    const H = 56;
    return src.map((v, i) => {
      const x = (i / (src.length - 1)) * W;
      const y = H - 6 - ((v - min) / span) * (H - 12);
      return [x, y] as const;
    });
  }, [data]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L300 56 L0 56 Z`;
  return (
    <svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export interface TrendProps {
  points: { ts: number; rx_avg: number; tx_avg: number; conn_avg?: number }[];
  height?: number;
}

/** 趋势图（带 hover crosshair）：rx 为主面积线，tx 为副虚线 */
export function TrendChart({ points, height = 220 }: TrendProps) {
  const hasConn = points.some((p) => p.conn_avg !== undefined);
  const [hover, setHover] = React.useState<{ x: number; i: number } | null>(null);
  const ref = React.useRef<SVGSVGElement>(null);
  const gradId = React.useId().replace(/[:]/g, "");
  const W = 700;
  const H = height;

  const geo = React.useMemo(() => {
    if (points.length < 2) return null;
    const max = Math.max(...points.map((p) => Math.max(p.rx_avg, p.tx_avg)), 1e-9);
    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (v: number) => H - 10 - (v / max) * (H - 26);
    const line = (pick: (p: (typeof points)[number]) => number) =>
      points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(pick(p)).toFixed(1)}`).join(" ");
    const rxLine = line((p) => p.rx_avg);
    const txLine = line((p) => p.tx_avg);
    const area = `${rxLine} L${W} ${H} L0 ${H} Z`;
    return { x, y, max, rxLine, txLine, area };
  }, [points, H]);

  if (!geo) return <div className="empty">暂无趋势数据，采集器需要先运行一段时间</div>;

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(points.length - 1, Math.round((rel / W) * (points.length - 1))));
    setHover({ x: geo.x(i), i });
  };

  const hp = hover ? points[hover.i] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".25" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#${gradId})`} />
        <path d={geo.rxLine} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
        <path d={geo.txLine} fill="none" stroke="var(--faint)" strokeWidth="1.4" strokeDasharray="3 4" />
        <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke="var(--border)" />
        {hover && (
          <line x1={hover.x} y1="0" x2={hover.x} y2={H} stroke="var(--border-2)" strokeWidth="1" />
        )}
      </svg>
      {hp && (
        <div
          style={{
            position: "absolute",
            left: `min(calc(${(hover!.x / W) * 100}% ), calc(100% - 150px))`,
            top: 8,
            background: "var(--bg-raise)",
            border: "1px solid var(--border-2)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            pointerEvents: "none",
            fontFamily: "var(--font-num)",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ color: "var(--muted)" }}>{new Date(hp.ts).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          <div>↓ {(hp.rx_avg / 1024 / 1024).toFixed(1)} MB/s</div>
          <div>↑ {(hp.tx_avg / 1024 / 1024).toFixed(1)} MB/s</div>
          {hasConn && hp.conn_avg !== undefined && <div>连接 {Math.round(hp.conn_avg)}</div>}
        </div>
      )}
    </div>
  );
}
