import { useEffect, useState } from "react";
import { IconX } from "./icons";
import { api } from "../api/client";
import { useStore } from "../state/store";
import { fmtDur, fmtTime } from "../lib/format";
import type { AlertItem } from "../types";

/** 告警抽屉：活动告警 + 近期历史 */
export function AlertsDrawer(props: { open: boolean; onClose: () => void }) {
  const { snapshot } = useStore();
  const [hist, setHist] = useState<AlertItem[] | null>(null);

  useEffect(() => {
    if (!props.open) return;
    api.alerts()
      .then((r) => setHist(r.alerts))
      .catch(() => setHist([]));
  }, [props.open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  const active = snapshot?.alerts.filter((a) => !a.resolved_at) ?? [];

  return (
    <div className={`drawer${props.open ? " open" : ""}`} role="dialog" aria-label="告警面板" aria-hidden={!props.open}>
      <div className="dhead">
        <span className="t">告警</span>
        {active.length > 0 && <span className="tag">{active.length} 条活动</span>}
        <button className="iconbtn close" aria-label="关闭" onClick={props.onClose}><IconX size={15} /></button>
      </div>
      <div className="dbody">
        {active.length === 0 && <div className="empty">当前没有活动告警</div>}
        {active.map((a) => <Row key={a.id} a={a} />)}
        <div className="group-head" style={{ marginTop: 20 }}>
          <span className="title" style={{ fontSize: 14 }}>近期历史</span>
        </div>
        {!hist ? (
          <div className="skel" style={{ height: 80 }} />
        ) : hist.length === 0 ? (
          <div className="empty">暂无历史记录</div>
        ) : (
          hist.slice(0, 50).map((a) => <Row key={a.id + a.resolved_at} a={a} resolved />)
        )}
      </div>
    </div>
  );
}

function Row({ a, resolved }: { a: AlertItem; resolved?: boolean }) {
  return (
    <div className={`alert-item ${a.severity}${resolved ? " resolved" : ""}`}>
      <span className="sev" />
      <div style={{ minWidth: 0 }}>
        <div className="msg">{a.message}</div>
        <div className="meta">
          <span className="dev">{a.device}</span> · {fmtTime(a.first_seen)} 起 · 已持续 {fmtDur((a.resolved_at ?? a.last_seen) - a.first_seen)}
          {resolved && " · 已恢复"}
        </div>
      </div>
    </div>
  );
}
