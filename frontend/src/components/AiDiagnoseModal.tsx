/* AI 日志诊断弹窗（Cloudflare Workers AI）：支持分析采集器上报日志或手动粘贴 OpenWrt / OpenClash 日志 */
import { useEffect, useState } from "react";
import { Button, Input, Segmented, Select } from "antd";
import { api } from "../api/client";
import { useStore } from "../state/store";
import { IconSparkles, IconX } from "./icons";

const AI_MODELS = [
  { label: "Qwen3 30B MoE（推荐·中文强）", value: "@cf/qwen/qwen3-30b-a3b-fp8" },
  { label: "Llama 3.3 70B（旗舰通用）", value: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { label: "DeepSeek R1 32B（深度推理）", value: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" },
  { label: "Qwen 2.5 7B（轻量省额度）", value: "@cf/qwen/qwen2.5-7b-instruct" },
];

export function AiDiagnoseModal(props: { open: boolean; onClose: () => void }) {
  const { config, toast } = useStore();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [models, setModels] = useState<{ label: string; value: string }[]>(AI_MODELS);
  const [model, setModel] = useState<string>(config.monitor?.aiModel || AI_MODELS[0].value);
  const [question, setQuestion] = useState("");
  const [openwrtManual, setOpenwrtManual] = useState("");
  const [openclashManual, setOpenclashManual] = useState("");
  const [meta, setMeta] = useState<{
    available: boolean;
    aiBound: boolean;
    logs: { updated_at: number; source: string; openwrt: string[]; openclash: string[] } | null;
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
    api.aiLogs().then(setMeta).catch(() => setMeta(null));
    api.aiModels()
      .then((res) => {
        if (res.models?.length) {
          setModels(res.models.map((m) => ({ label: m.name || m.id, value: m.id })));
        }
      })
      .catch(() => { /* 回退内置模型列表 */ });
  }, [props.open]);

  if (!props.open) return null;

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.aiDiagnose({
        mode,
        model,
        openwrt: mode === "manual" ? openwrtManual : undefined,
        openclash: mode === "manual" ? openclashManual : undefined,
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

  const hasAutoLogs = !!(meta?.logs && (meta.logs.openwrt.length > 0 || meta.logs.openclash.length > 0));

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="AI 日志诊断"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="modal" style={{ width: "min(740px, 95vw)", maxHeight: "86vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-head">
          <span className="brand" style={{ gap: 8 }}>
            <span className="mark"><IconSparkles size={15} /></span>
            AI 日志诊断（OpenWrt / OpenClash）
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
              {hasAutoLogs && meta?.logs ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>
                    已就绪：最近上报于 {new Date(meta.logs.updated_at).toLocaleString()}（来源：{meta.logs.source}）
                  </div>
                  <div>
                    OpenWrt 日志 {meta.logs.openwrt.length} 行 · OpenClash 日志 {meta.logs.openclash.length} 行（已自动脱敏）
                  </div>
                </div>
              ) : (
                <div>
                  暂无采集器自动上报的日志（需在路由器插件 <code>nav-collector</code> 中追加 <code>logs.openwrt</code> / <code>logs.openclash</code> 上报字段）。
                  <br />
                  直接点下方「开始诊断」仍可分析当前设备监控与告警；或切换到「手动粘贴日志」粘贴 <code>logread</code> / OpenClash 日志。
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
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
