import { useMemo, useState } from "react";
import { IconWarn, IconX } from "./icons";
import { useStore } from "../state/store";
import { fmtDur } from "../lib/format";

/** 顶部告警条：显示最严重的活动告警 */
export function AlertBar() {
  const { snapshot } = useStore();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const worst = useMemo(() => {
    if (!snapshot) return null;
    const active = snapshot.alerts.filter((a) => !a.resolved_at && !dismissed.has(a.id));
    if (active.length === 0) return null;
    return active.sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1))[0];
  }, [snapshot, dismissed]);

  if (!worst) return null;
  const crit = worst.severity === "critical";

  return (
    <div className={`alertbar${crit ? " crit" : ""}`} role="status">
      <IconWarn size={16} />
      <span className="txt">
        <b>{worst.device}</b>&nbsp;{worst.message}
      </span>
      <span className="meta">已持续 {fmtDur(Date.now() - worst.first_seen)}</span>
      <button className="dismiss" aria-label="关闭提醒" onClick={() => setDismissed((s) => new Set(s).add(worst.id))}>
        <IconX size={14} />
      </button>
    </div>
  );
}
