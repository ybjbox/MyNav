/* Workers AI 模型显示与旧模型兼容映射（与 worker/ai.ts 对齐） */
import type { api } from "../api/client";

export type AiModelInfo = Awaited<ReturnType<typeof api.aiModels>>["models"][number];
export type AiUsageInfo = Awaited<ReturnType<typeof api.aiUsage>>;

export const AI_FALLBACK_MODELS: AiModelInfo[] = [
  { id: "@cf/qwen/qwen3.8-27b", name: "Qwen 3.8 27B（推荐·中文强）", contextWindow: 262144, inputUsdPerM: 0.45, outputUsdPerM: 3.2, costMultiplier: 8, reasoning: true },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B（旗舰通用·快）", contextWindow: 24000, inputUsdPerM: 0.293, outputUsdPerM: 2.253, costMultiplier: 5.63 },
  { id: "@cf/zai-org/glm-4.7-flash", name: "GLM 4.7 Flash（中文省额度）", contextWindow: 131072, inputUsdPerM: 0.0605, outputUsdPerM: 0.4, costMultiplier: 1, reasoning: true },
  { id: "@cf/google/gemma-4-26b-a4b-it", name: "Gemma 4 26B（Google·超值）", contextWindow: 256000, inputUsdPerM: 0.1, outputUsdPerM: 0.3, costMultiplier: 0.75, reasoning: true },
  { id: "@cf/mistralai/mistral-small-3.1-24b-instruct", name: "Mistral Small 3.1 24B", contextWindow: 128000, inputUsdPerM: 0.351, outputUsdPerM: 0.555, costMultiplier: 1.39 },
  { id: "@cf/qwen/qwen2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B（排错）", contextWindow: 32768, inputUsdPerM: 0.66, outputUsdPerM: 1.0, costMultiplier: 2.5 },
];

export const RETIRED_AI_MODEL_MAP: Record<string, string> = {
  "@cf/qwen/qwen3-30b-a3b-fp8": "@cf/qwen/qwen3.8-27b",
  "@cf/qwen/qwen2.5-7b-instruct": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": "@cf/qwen/qwen3.8-27b",
  "@cf/google/gemma-3-12b-it": "@cf/google/gemma-4-26b-a4b-it",
};

export function resolveActiveModelId(id?: string): string {
  const raw = id || "@cf/qwen/qwen3.8-27b";
  return RETIRED_AI_MODEL_MAP[raw] || raw;
}

export function formatAiModelOption(m: AiModelInfo): { label: string; value: string; disabled?: boolean } {
  const parts: string[] = [m.name || m.id];
  if (m.contextWindow) {
    parts.push(m.contextWindow >= 1_000_000 ? `${Math.round(m.contextWindow / 1024 / 1024)}M` : `${Math.round(m.contextWindow / 1024)}K`);
  }
  if (typeof m.costMultiplier === "number") {
    parts.push(`${m.costMultiplier}x`);
  }
  if (typeof m.outputUsdPerM === "number") {
    parts.push(`出$${m.outputUsdPerM}/M`);
  }
  if (m.paidOnly) {
    parts.push("需付费");
  }
  return {
    label: parts.join(" · "),
    value: m.id,
    disabled: !!m.paidOnly,
  };
}
