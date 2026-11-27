/* AI 日志诊断桌面小组件：展示上报日志状态、直接一键 Workers AI 诊断或展开完整诊断面板 */
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { IconSparkles } from "../components/icons";
import { useStore } from "../state/store";
import type { WidgetProps } from "./registry";

export function WidgetAiDiagnose(_props: WidgetProps) {
  const { authed, config, snapshot, toast } = useStore();
  const [logMeta, setLogMeta] = useState<{
    available: boolean;
    meta: { updated_at: number; source: string; counts: { openwrt: number; openclash: number; nas: number } } | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) {
      setLogMeta(null);
      return;
    }
    let cancelled = false;
    api.aiLogs(false)
      .then((res) => {
        if (!cancelled) setLogMeta({ available: res.available, meta: res.meta });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authed, snapshot?.ts]);

  const openModal = () => {
    window.dispatchEvent(new CustomEvent("nav:open-ai"));
  };

  const runQuickDiagnose = async () => {
    if (!authed) return;
    setBusy(true);
    try {
      const res = await api.aiDiagnose({
        mode: "auto",
        model: config.monitor?.aiModel,
      });
      setReport(res.report);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const owCount = logMeta?.meta?.counts.openwrt ?? 0;
  const ocCount = logMeta?.meta?.counts.openclash ?? 0;
  const nasCount = logMeta?.meta?.counts.nas ?? 0;
  const activeAlerts = snapshot?.alerts?.filter((a) => !a.resolved_at).length ?? 0;

  return (
    <div
      className="widget-ai"
      style={{
        height: "100%",
        minHeight: 0,
        padding: "16px 18px",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.94)",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div className="wai-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              background: "var(--accent-dim)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconSparkles size={13} />
          </span>
          <span className="wai-title">AI 日志诊断</span>
        </span>
        {authed && (
          <button
            type="button"
            className="wai-expand"
            onClick={openModal}
            style={{
              border: "none",
              background: "rgba(15, 23, 42, 0.05)",
              color: "#475569",
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            详情
          </button>
        )}
      </div>

      {!authed ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 12.5, color: "#64748b" }}>
          登录后可使用 Workers AI 一键分析路由器与 OpenClash 日志
        </div>
      ) : (
        <>
          <div className="wai-meta" style={{ fontSize: 11.5, color: "#64748b", display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
            <span>OpenWrt {owCount} 行</span>
            <span>OpenClash {ocCount} 行</span>
            {nasCount > 0 && <span>NAS {nasCount} 行</span>}
            {activeAlerts > 0 && <span style={{ color: "#ef4444", fontWeight: 600 }}>{activeAlerts} 条告警</span>}
          </div>

          {report ? (
            <div
              className="wai-report"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "8px 10px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid rgba(15, 23, 42, 0.07)",
                fontSize: 12,
                lineHeight: 1.55,
                color: "#1e293b",
                whiteSpace: "pre-wrap",
              }}
            >
              {report}
            </div>
          ) : (
            <div className="wai-hint" style={{ flex: 1, display: "flex", alignItems: "center", fontSize: 12, color: "#64748b" }}>
              {logMeta?.meta
                ? `最近日志上报于 ${new Date(logMeta.meta.updated_at).toLocaleTimeString()}，点击下方即可自动排错`
                : "可直接结合设备监控快照分析，或点「详情」手动粘贴日志"}
            </div>
          )}

          <div className="wai-actions" style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => void runQuickDiagnose()}
              disabled={busy}
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: 10,
                border: "none",
                background: "var(--accent)",
                color: "var(--accent-ink, #fff)",
                fontSize: 12,
                fontWeight: 600,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.72 : 1,
              }}
            >
              {busy ? "分析中…" : report ? "重新诊断" : "一键 AI 诊断"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
