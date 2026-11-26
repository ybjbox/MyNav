import { useEffect, useState } from "react";
import { Segmented } from "antd";
import { TrendChart } from "./primitives";
import { IconX } from "./icons";
import { useStore } from "../state/store";
import { fmtGB } from "../lib/format";

const RANGES = [
  { id: "24h", name: "24 小时" },
  { id: "7d", name: "7 天" },
  { id: "30d", name: "30 天" },
];

/** 趋势弹层：历史流量面积图 + 日累计统计 */
export function TrendModal(props: { deviceId: string; onClose: () => void }) {
  const { snapshot, fetchHistory, toast } = useStore();
  const [range, setRange] = useState("24h");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchHistory>> | null>(null);
  const [loading, setLoading] = useState(true);

  const device = snapshot?.devices.find((d) => d.id === props.deviceId);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchHistory(props.deviceId, range)
      .then((r) => { if (alive) { setData(r); setLoading(false); } })
      .catch((e) => { if (alive) { toast(`趋势加载失败：${(e as Error).message}`, true); setLoading(false); } });
    return () => { alive = false; };
  }, [props.deviceId, range, fetchHistory, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="overlay show" role="dialog" aria-modal="true" aria-label="流量趋势" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <span className="t">{device ? device.name : props.deviceId} · 流量趋势</span>
          <button className="iconbtn close" aria-label="关闭" onClick={props.onClose}><IconX size={15} /></button>
        </div>
        <div className="range" role="group" aria-label="时间范围">
          <Segmented
            value={range}
            onChange={(v) => setRange(String(v))}
            options={RANGES.map((r) => ({ label: r.name, value: r.id }))}
          />
        </div>
        {loading ? (
          <div className="skel" style={{ height: 220 }} />
        ) : data ? (
          <TrendChart points={data.points} />
        ) : (
          <div className="empty">暂无数据</div>
        )}
        <div className="legend"><span><i />下行</span><span><i className="alt" />上行</span></div>
        {data && data.daily.length > 0 && (
          <div className="daystats">
            {data.daily.map((d) => (
              <div className="d" key={d.day}>
                <div className="k">{d.day}</div>
                <div className="v">{d.rx_gb} GB</div>
              </div>
            ))}
          </div>
        )}
        {data && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--faint)" }}>
            7 日下行合计 {fmtGB(data.daily.reduce((a, b) => a + b.rx_gb * 1e9, 0))}
          </div>
        )}
      </div>
    </div>
  );
}
