/* AI 日志诊断弹窗（Cloudflare Workers AI）：支持分析采集器上报日志或手动粘贴 OpenWrt / OpenClash 日志 */
import { useEffect, useState } from "react";
import { Button, Input, Segmented, Select } from "antd";
import { api } from "../api/client";
import { AI_FALLBACK_MODELS, formatAiModelOption, resolveActiveModelId, type AiModelInfo, type AiUsageInfo } from "../lib/aiModels";
import { useStore } from "../state/store";
import { IconSparkles, IconX } from "./icons";

export function AiDiagnoseModal(props: { open: boolean; onClose: () => void }) {
  const { config, toast } = useStore();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [models, setModels] = useState<AiModelInfo[]>(AI_FALLBACK_MODELS);
  const [model, setModel] = useState<string>(() => resolveActiveModelId(config.monitor?.aiModel));
  const [usage, setUsage] = useState<AiUsageInfo | null>(null);
  const [usageBusy, setUsageBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [openwrtManual, setOpenwrtManual] = useState("");
  const [openclashManual, setOpenclashManual] = useState("");
  const [nasManual, setNasManual] = useState("");
  const [meta, setMeta] = useState<{
    available: boolean;
    aiBound: boolean;
    meta: {
      updated_at: number;
      oldest_at?: number;
      retentionHours?: number;
      retentionDays?: number;
      source: string;
      counts: { openwrt: number; openclash: number; nas: number };
      counts7d?: { openwrt: number; openclash: number; nas: number };
    } | null;
  } | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsBusy, setLogsBusy] = useState(false);
  const [onlyWarnLogs, setOnlyWarnLogs] = useState(false);
  const [logDays, setLogDays] = useState<1 | 3 | 7>(1);
  const [logTab, setLogTab] = useState<"openwrt" | "openclash" | "nas">("openwrt");
  const [logCache, setLogCache] = useState<{
    updatedAt: number;
    byKey: Record<string, string[]>;
  }>({ updatedAt: 0, byKey: {} });
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{
    text: string;
    model: string;
    analyzedAt: number;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; estimatedNeurons?: number };
  } | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  useEffect(() => {
    if (!props.open) return;
    // 打开弹窗只拉轻量统计元信息；原始日志文本仅在点击「查看上报日志」时按需加载
    api.aiLogs(false)
      .then((res) => setMeta({ available: res.available, aiBound: res.aiBound, meta: res.meta }))
      .catch(() => setMeta(null));
    api.aiModels()
      .then((res) => {
        if (res.models?.length) setModels(res.models);
      })
      .catch(() => { /* 回退内置模型列表 */ });
    api.aiUsage(false)
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [props.open]);

  if (!props.open) return null;

  const refreshUsage = async () => {
    setUsageBusy(true);
    try {
      setUsage(await api.aiUsage(true));
    } catch {
      /* 忽略 */
    } finally {
      setUsageBusy(false);
    }
  };

  const logCacheKey = (kind: "openwrt" | "openclash" | "nas", days: 1 | 3 | 7, onlyWarn: boolean) =>
    `${kind}:${days}:${onlyWarn ? "w" : "a"}`;

  const fetchLogsDetail = async (
    kind: "openwrt" | "openclash" | "nas",
    days: 1 | 3 | 7,
    onlyWarn: boolean,
    force = false,
  ) => {
    const key = logCacheKey(kind, days, onlyWarn);
    if (!force && meta?.meta && logCache.updatedAt === meta.meta.updated_at && logCache.byKey[key]) return;
    setLogsBusy(true);
    try {
      const res = await api.aiLogs({ detail: true, kind, days, onlyWarn, limit: 600 });
      setMeta({ available: res.available, aiBound: res.aiBound, meta: res.meta });
      const lines =
        kind === "openwrt"
          ? (res.logs?.openwrt ?? [])
          : kind === "openclash"
            ? (res.logs?.openclash ?? [])
            : (res.logs?.nas ?? []);
      setLogCache((prev) => {
        const nextUpdated = res.meta?.updated_at ?? prev.updatedAt;
        const base = prev.updatedAt === nextUpdated ? prev.byKey : {};
        return { updatedAt: nextUpdated, byKey: { ...base, [key]: lines } };
      });
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setLogsBusy(false);
    }
  };

  const toggleLogsViewer = () => {
    const next = !logsOpen;
    setLogsOpen(next);
    if (next) void fetchLogsDetail(logTab, logDays, onlyWarnLogs, false);
  };

  const switchLogTab = (nextTab: "openwrt" | "openclash" | "nas") => {
    setLogTab(nextTab);
    if (logsOpen) void fetchLogsDetail(nextTab, logDays, onlyWarnLogs, false);
  };

  const switchLogDays = (nextDays: 1 | 3 | 7) => {
    setLogDays(nextDays);
    if (logsOpen) void fetchLogsDetail(logTab, nextDays, onlyWarnLogs, false);
  };

  const toggleWarnFilter = () => {
    const nextWarn = !onlyWarnLogs;
    setOnlyWarnLogs(nextWarn);
    if (logsOpen) void fetchLogsDetail(logTab, logDays, nextWarn, false);
  };

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.aiDiagnose({
        mode,
        model,
        openwrt: mode === "manual" ? openwrtManual : undefined,
        openclash: mode === "manual" ? openclashManual : undefined,
        nas: mode === "manual" ? nasManual : undefined,
        question: question.trim() || undefined,
      });
      setReport({ text: res.report, model: res.model, analyzedAt: res.analyzedAt, usage: res.usage });
      void refreshUsage();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.text);
      toast("诊断报告已复制");
    } catch {
      toast("复制失败", true);
    }
  };

  const counts = meta?.meta?.counts;
  const counts7d = meta?.meta?.counts7d;
  const hasAutoLogs = !!(
    (counts && (counts.openwrt > 0 || counts.openclash > 0 || counts.nas > 0)) ||
    (counts7d && (counts7d.openwrt > 0 || counts7d.openclash > 0 || counts7d.nas > 0))
  );
  const activeKey = logCacheKey(logTab, logDays, onlyWarnLogs);
  const activeLogLines = logCache.byKey[activeKey];

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="AI 日志诊断"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="modal" style={{ width: "min(760px, 95vw)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-head">
          <span className="brand" style={{ gap: 8 }}>
            <span className="mark"><IconSparkles size={15} /></span>
            AI 日志诊断（OpenWrt / OpenClash / NAS）
          </span>
          <button type="button" className="iconbtn close" aria-label="关闭" onClick={props.onClose}>
            <IconX size={15} />
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingRight: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as "auto" | "manual")}
              options={[
                { label: "自动读取上报日志", value: "auto" },
                { label: "手动粘贴日志", value: "manual" },
              ]}
            />
            <Select
              value={model}
              onChange={setModel}
              options={models.map(formatAiModelOption)}
              size="small"
              style={{ minWidth: 280, maxWidth: 380 }}
              showSearch
              optionFilterProp="label"
              aria-label="选择 AI 模型"
            />
          </div>

          {usage?.available && typeof usage.todayNeurons === "number" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(15, 23, 42, 0.03)",
                border: "1px solid rgba(15, 23, 42, 0.06)",
                fontSize: 12,
                color: "#475569",
                flexWrap: "wrap",
              }}
            >
              <span>
                今日已用 <strong style={{ color: "#0f172a" }}>{usage.todayNeurons}</strong> / {usage.dailyFreeLimit || 10000} Neurons
                （{Math.min(100, Math.round((usage.todayNeurons / (usage.dailyFreeLimit || 10000)) * 1000) / 10)}% · {usage.requests || 0} 次请求 · UTC {usage.dateUtc}）
              </span>
              <Button size="small" loading={usageBusy} onClick={() => void refreshUsage()}>
                刷新额度
              </Button>
            </div>
          )}

          {mode === "auto" ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.08)", fontSize: 12.5, color: "#475569" }}>
              {hasAutoLogs && meta?.meta ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        已就绪（云端留存 {meta.meta.retentionDays || 7} 天 · AI 默认分析近 24h）：
                        {meta.meta.oldest_at ? `${new Date(meta.meta.oldest_at).toLocaleString()} → ` : ""}
                        {new Date(meta.meta.updated_at).toLocaleString()}（来源：{meta.meta.source}）
                      </div>
                      <div>
                        近 24h：OpenWrt {meta.meta.counts.openwrt} 行 · OpenClash {meta.meta.counts.openclash} 行 · NAS {meta.meta.counts.nas} 行
                        {meta.meta.counts7d
                          ? `（7 天累计：${meta.meta.counts7d.openwrt} / ${meta.meta.counts7d.openclash} / ${meta.meta.counts7d.nas}）`
                          : ""}
                      </div>
                    </div>
                    <Button size="small" onClick={toggleLogsViewer}>
                      {logsOpen ? "收起上报日志" : "查看上报日志"}
                    </Button>
                  </div>
                  {logsOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 6, borderTop: "1px dashed rgba(15, 23, 42, 0.1)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <Segmented
                          size="small"
                          value={logTab}
                          onChange={(v) => switchLogTab(v as "openwrt" | "openclash" | "nas")}
                          options={[
                            { label: `OpenWrt (${meta.meta.counts.openwrt})`, value: "openwrt" },
                            { label: `OpenClash (${meta.meta.counts.openclash})`, value: "openclash" },
                            { label: `NAS (${meta.meta.counts.nas})`, value: "nas" },
                          ]}
                        />
                        <Segmented
                          size="small"
                          value={logDays}
                          onChange={(v) => switchLogDays(v as 1 | 3 | 7)}
                          options={[
                            { label: "近 1 天", value: 1 },
                            { label: "近 3 天", value: 3 },
                            { label: "近 7 天", value: 7 },
                          ]}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button
                            size="small"
                            type={onlyWarnLogs ? "primary" : "default"}
                            onClick={toggleWarnFilter}
                          >
                            {onlyWarnLogs ? "只看异常中" : "过滤异常"}
                          </Button>
                          <Button size="small" loading={logsBusy} onClick={() => void fetchLogsDetail(logTab, logDays, onlyWarnLogs, true)}>
                            刷新
                          </Button>
                        </div>
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          maxHeight: 220,
                          overflow: "auto",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "#0f172a",
                          color: "#e2e8f0",
                          fontSize: 11.5,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                        }}
                      >
                        {logsBusy && !activeLogLines
                          ? "按需加载该时段日志中…"
                          : activeLogLines && activeLogLines.length > 0
                            ? activeLogLines.join("\n")
                            : onlyWarnLogs
                              ? `近 ${logDays} 天内未匹配到 warn/err/timeout 等异常日志`
                              : logTab === "nas"
                                ? "暂无 NAS 日志（如需采集请在路由器 LuCI → NAV 采集器 → 飞牛 NAS 开启「采集 NAS 系统日志」）"
                                : `近 ${logDays} 天暂无该类日志`}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  暂无采集器自动上报的日志（需在路由器插件 <code>nav-collector</code> 开启并等待推送）。
                  <br />
                  直接点下方「开始诊断」仍可分析当前设备监控与告警；或切换到「手动粘贴日志」。
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>OpenWrt 系统日志（可选）</div>
                <Input.TextArea
                  rows={5}
                  value={openwrtManual}
                  onChange={(e) => setOpenwrtManual(e.target.value)}
                  placeholder="粘贴 logread 或内核日志片段（自动取最后 120 行并脱敏）"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>OpenClash 日志（可选）</div>
                <Input.TextArea
                  rows={5}
                  value={openclashManual}
                  onChange={(e) => setOpenclashManual(e.target.value)}
                  placeholder="粘贴 OpenClash 运行日志 / Mihomo 报错（自动取最后 120 行并脱敏）"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>飞牛 NAS 系统日志（可选）</div>
                <Input.TextArea
                  rows={5}
                  value={nasManual}
                  onChange={(e) => setNasManual(e.target.value)}
                  placeholder="粘贴 journalctl / syslog 片段（自动取最后 120 行并脱敏）"
                />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) void run(); }}
              placeholder="补充问题（可选），例如：为什么最近 DNS 解析变慢或节点频繁切换？"
            />
            <Button type="primary" loading={busy} onClick={() => void run()}>
              {busy ? "分析中…" : "开始诊断"}
            </Button>
          </div>

          {report && (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, fontSize: 11.5, color: "#64748b", flexWrap: "wrap", gap: 6 }}>
                <span>
                  模型：{report.model} · {new Date(report.analyzedAt).toLocaleTimeString()}
                  {report.usage?.totalTokens ? ` · ${report.usage.promptTokens ?? 0}入/${report.usage.completionTokens ?? 0}出 tokens` : ""}
                  {typeof report.usage?.estimatedNeurons === "number" ? ` · 约 ${report.usage.estimatedNeurons} Neurons` : ""}
                </span>
                <Button size="small" onClick={() => void copyReport()}>复制报告</Button>
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.68, color: "#1e293b" }}>
                {report.text}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
