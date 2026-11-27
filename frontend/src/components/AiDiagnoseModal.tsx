/* AI 日志诊断弹窗（Cloudflare Workers AI）：支持分析采集器上报日志或手动粘贴 OpenWrt / OpenClash 日志 */
import { useEffect, useState } from "react";
import { Button, Input, Segmented, Select } from "antd";
import { api } from "../api/client";
import { useStore } from "../state/store";
import { IconSparkles, IconX } from "./icons";

const AI_MODELS = [
  { label: "Qwen 3.8 27B（推荐·中文强）", value: "@cf/qwen/qwen3.8-27b" },
  { label: "Llama 3.3 70B（旗舰通用·快）", value: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { label: "GLM 4.7 Flash（中文轻量）", value: "@cf/zai-org/glm-4.7-flash" },
  { label: "Gemma 4 26B（Google）", value: "@cf/google/gemma-4-26b-a4b-it" },
  { label: "Mistral Small 3.1 24B", value: "@cf/mistralai/mistral-small-3.1-24b-instruct" },
  { label: "Qwen 2.5 Coder 32B（排错）", value: "@cf/qwen/qwen2.5-coder-32b-instruct" },
];

const RETIRED_MODEL_ALIAS: Record<string, string> = {
  "@cf/qwen/qwen3-30b-a3b-fp8": "@cf/qwen/qwen3.8-27b",
  "@cf/qwen/qwen2.5-7b-instruct": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": "@cf/qwen/qwen3.8-27b",
  "@cf/google/gemma-3-12b-it": "@cf/google/gemma-4-26b-a4b-it",
};

export function AiDiagnoseModal(props: { open: boolean; onClose: () => void }) {
  const { config, toast } = useStore();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [models, setModels] = useState<{ label: string; value: string }[]>(AI_MODELS);
  const savedModel = config.monitor?.aiModel || AI_MODELS[0].value;
  const [model, setModel] = useState<string>(RETIRED_MODEL_ALIAS[savedModel] || savedModel);
  const [question, setQuestion] = useState("");
  const [openwrtManual, setOpenwrtManual] = useState("");
  const [openclashManual, setOpenclashManual] = useState("");
  const [nasManual, setNasManual] = useState("");
  const [meta, setMeta] = useState<{
    available: boolean;
    aiBound: boolean;
    meta: { updated_at: number; source: string; counts: { openwrt: number; openclash: number; nas: number } } | null;
  } | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsBusy, setLogsBusy] = useState(false);
  const [logTab, setLogTab] = useState<"openwrt" | "openclash" | "nas">("openwrt");
  const [logDetail, setLogDetail] = useState<{
    updated_at: number;
    source: string;
    openwrt: string[];
    openclash: string[];
    nas?: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ text: string; model: string; analyzedAt: number } | null>(null);

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
        if (res.models?.length) {
          setModels(res.models.map((m) => ({ label: m.name || m.id, value: m.id })));
        }
      })
      .catch(() => { /* 回退内置模型列表 */ });
  }, [props.open]);

  if (!props.open) return null;

  const fetchLogsDetail = async (force = false) => {
    if (!force && logDetail && meta?.meta && logDetail.updated_at === meta.meta.updated_at) return;
    setLogsBusy(true);
    try {
      const res = await api.aiLogs(true);
      setMeta({ available: res.available, aiBound: res.aiBound, meta: res.meta });
      setLogDetail(res.logs ?? null);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setLogsBusy(false);
    }
  };

  const toggleLogsViewer = () => {
    const next = !logsOpen;
    setLogsOpen(next);
    if (next) void fetchLogsDetail(false);
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
      setReport({ text: res.report, model: res.model, analyzedAt: res.analyzedAt });
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
  const hasAutoLogs = !!(counts && (counts.openwrt > 0 || counts.openclash > 0 || counts.nas > 0));
  const activeLogLines =
    logTab === "openwrt"
      ? (logDetail?.openwrt ?? [])
      : logTab === "openclash"
        ? (logDetail?.openclash ?? [])
        : (logDetail?.nas ?? []);

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
              options={models}
              size="small"
              style={{ minWidth: 240 }}
              showSearch
              optionFilterProp="label"
              aria-label="选择 AI 模型"
            />
          </div>

          {mode === "auto" ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.08)", fontSize: 12.5, color: "#475569" }}>
              {hasAutoLogs && meta?.meta ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        已就绪：最近上报于 {new Date(meta.meta.updated_at).toLocaleString()}（来源：{meta.meta.source}）
                      </div>
                      <div>
                        OpenWrt {meta.meta.counts.openwrt} 行 · OpenClash {meta.meta.counts.openclash} 行 · NAS {meta.meta.counts.nas} 行（已脱敏）
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
                          onChange={(v) => setLogTab(v as "openwrt" | "openclash" | "nas")}
                          options={[
                            { label: `OpenWrt (${meta.meta.counts.openwrt})`, value: "openwrt" },
                            { label: `OpenClash (${meta.meta.counts.openclash})`, value: "openclash" },
                            { label: `NAS (${meta.meta.counts.nas})`, value: "nas" },
                          ]}
                        />
                        <Button size="small" loading={logsBusy} onClick={() => void fetchLogsDetail(true)}>
                          刷新
                        </Button>
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          maxHeight: 210,
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
                        {logsBusy && !logDetail
                          ? "按需加载日志中…"
                          : activeLogLines.length > 0
                            ? activeLogLines.join("\n")
                            : logTab === "nas"
                              ? "暂无 NAS 日志（如需采集请在路由器 LuCI → NAV 采集器 → 飞牛 NAS 开启「采集 NAS 系统日志」）"
                              : "暂无该类日志"}
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, fontSize: 11.5, color: "#64748b" }}>
                <span>模型：{report.model} · {new Date(report.analyzedAt).toLocaleTimeString()}</span>
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
