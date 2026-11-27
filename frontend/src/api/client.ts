/* API 客户端：所有请求同源（CF Pages + Functions） */

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error || `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export const api = {
  session: () => req<{ authenticated: boolean; username?: string | null; role?: string | null; collectorConfigured: boolean }>("/api/session"),
  getConfig: () => req<{ config: import("../types").NavConfig; authenticated: boolean }>("/api/config"),
  putConfig: (config: import("../types").NavConfig) =>
    req<{ ok: true; version: number }>("/api/config", { method: "PUT", body: JSON.stringify({ config }) }),
  login: (username: string, password: string) =>
    req<{ ok: true; username: string; role: string }>("/api/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => req<{ ok: true }>("/api/logout", { method: "POST" }),
  updateAccount: (payload: { currentPassword: string; newUsername?: string; newPassword?: string }) =>
    req<{ ok: true; username: string }>("/api/account", { method: "PUT", body: JSON.stringify(payload) }),
  latest: () => req<import("../types").Snapshot & { stale?: boolean }>("/api/latest"),
  history: (device: string, range: string) =>
    req<import("../types").HistoryResp>(`/api/history?device=${encodeURIComponent(device)}&range=${encodeURIComponent(range)}`),
  alerts: () => req<{ alerts: import("../types").AlertItem[] }>("/api/alerts"),
  getTodos: () =>
    req<{ todos: { id: string; text: string; done: boolean; starred?: boolean; ts: number }[]; updatedAt: number | null }>("/api/todos"),
  putTodos: (todos: { id: string; text: string; done: boolean; starred?: boolean; ts: number }[]) =>
    req<{ ok: true; todos: { id: string; text: string; done: boolean; starred?: boolean; ts: number }[]; updatedAt: number }>("/api/todos", {
      method: "PUT",
      body: JSON.stringify({ todos }),
    }),
  msTodoStatus: () =>
    req<{ configured: boolean; connected: boolean; listId: string | null; listName: string | null }>("/api/ms-todo/status"),
  msTodoAuthUrl: () => req<{ url: string; redirectUri: string }>("/api/ms-todo/auth-url"),
  msTodoDisconnect: () => req<{ ok: true }>("/api/ms-todo/disconnect", { method: "POST" }),
  msTodoLists: () =>
    req<{ lists: { id: string; displayName: string; wellknownListName?: string }[]; selectedListId: string | null }>("/api/ms-todo/lists"),
  msTodoSelectList: (listId: string, listName: string) =>
    req<{ ok: true; listId: string; listName: string }>("/api/ms-todo/list", {
      method: "POST",
      body: JSON.stringify({ listId, listName }),
    }),
  msTodoTasks: (listId?: string) =>
    req<{
      listId: string;
      listName: string;
      tasks: {
        id: string;
        title: string;
        status: "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred";
        importance: "low" | "normal" | "high";
      }[];
    }>(`/api/ms-todo/tasks${listId ? `?listId=${encodeURIComponent(listId)}` : ""}`),
  msTodoCreateTask: (title: string, listId?: string) =>
    req<{ task: { id: string; title: string; status: "notStarted" | "completed"; importance: "normal" | "high" } }>("/api/ms-todo/tasks", {
      method: "POST",
      body: JSON.stringify({ title, listId }),
    }),
  msTodoUpdateTask: (patch: { id: string; listId?: string; status?: "completed" | "notStarted"; importance?: "high" | "normal"; title?: string }) =>
    req<{ task: { id: string; title: string; status: "notStarted" | "completed"; importance: "normal" | "high" } }>("/api/ms-todo/tasks", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  msTodoDeleteTask: (id: string, listId?: string) =>
    req<{ ok: true }>("/api/ms-todo/tasks", {
      method: "DELETE",
      body: JSON.stringify({ id, listId }),
    }),
  aiLogs: (opts?: boolean | { detail?: boolean; kind?: "openwrt" | "openclash" | "nas"; days?: 1 | 3 | 7; limit?: number; onlyWarn?: boolean }) => {
    const o = typeof opts === "boolean" ? { detail: opts } : opts || {};
    const qs = new URLSearchParams();
    if (o.detail) qs.set("detail", "1");
    if (o.kind) qs.set("kind", o.kind);
    if (o.days) qs.set("days", String(o.days));
    if (o.limit) qs.set("limit", String(o.limit));
    if (o.onlyWarn) qs.set("onlyWarn", "1");
    const q = qs.toString();
    return req<{
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
      logs?: { updated_at: number; oldest_at?: number; retentionHours?: number; retentionDays?: number; days?: number; source: string; openwrt: string[]; openclash: string[]; nas?: string[] } | null;
    }>(`/api/ai/logs${q ? `?${q}` : ""}`);
  },
  aiModels: (refresh = false) =>
    req<{
      models: {
        id: string;
        name: string;
        description?: string;
        contextWindow?: number;
        inputUsdPerM?: number;
        outputUsdPerM?: number;
        cachedUsdPerM?: number;
        inputNeuronsPer1K?: number;
        outputNeuronsPer1K?: number;
        costMultiplier?: number;
        paidOnly?: boolean;
        reasoning?: boolean;
      }[];
      source: "online" | "builtin";
      updatedAt: number;
    }>(`/api/ai/models${refresh ? "?refresh=1" : ""}`),
  aiUsage: (refresh = false) =>
    req<{
      available: boolean;
      reason?: string;
      dateUtc?: string;
      dailyFreeLimit?: number;
      todayNeurons?: number;
      remainingNeurons?: number;
      requests?: number;
      inputTokens?: number;
      outputTokens?: number;
      byModel?: { modelId: string; requests: number; neurons: number; inputTokens: number; outputTokens: number; inferenceMs: number }[];
      updatedAt?: number;
    }>(`/api/ai/usage${refresh ? "?refresh=1" : ""}`),
  aiDiagnose: (payload: { model?: string; reasoningEffort?: "low" | "medium" | "high"; question?: string }) =>
    req<{
      ok: true;
      model: string;
      mode: string;
      analyzedAt: number;
      report: string;
      usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; estimatedNeurons?: number };
    }>("/api/ai/diagnose", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  aiDiagnoseStream: async (
    payload: { model?: string; reasoningEffort?: "low" | "medium" | "high"; question?: string },
    handlers: {
      onStage?: (stage: string, message: string, model?: string) => void;
      onReasoning?: (delta: string) => void;
      onDelta?: (text: string) => void;
      onDone?: (info: {
        model: string;
        analyzedAt: number;
        usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; estimatedNeurons?: number };
      }) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> => {
    const res = await fetch("/api/ai/diagnose", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, stream: true }),
      signal,
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }
    if (!ct.includes("text/event-stream") || !res.body) {
      const body = (await res.json()) as {
        model: string;
        analyzedAt: number;
        report: string;
        usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; estimatedNeurons?: number };
      };
      handlers.onDelta?.(body.report);
      handlers.onDone?.({ model: body.model, analyzedAt: body.analyzedAt, usage: body.usage });
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const frames = buf.split(/\r?\n\r?\n/);
      buf = frames.pop() || "";
      for (const frame of frames) {
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          const ev = JSON.parse(raw) as {
            type?: string;
            stage?: string;
            message?: string;
            model?: string;
            delta?: string;
            text?: string;
            analyzedAt?: number;
            usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; estimatedNeurons?: number };
            error?: string;
          };
          if (ev.type === "stage") handlers.onStage?.(ev.stage || "", ev.message || "", ev.model);
          else if (ev.type === "reasoning" && ev.delta) handlers.onReasoning?.(ev.delta);
          else if (ev.type === "delta" && ev.text) handlers.onDelta?.(ev.text);
          else if (ev.type === "done") handlers.onDone?.({ model: ev.model || "", analyzedAt: ev.analyzedAt || Date.now(), usage: ev.usage });
          else if (ev.type === "error") throw new Error(ev.error || "Workers AI 调用失败");
        }
      }
    }
  },
};

export function isUnauthorized(e: unknown): boolean {
  return (e as { status?: number }).status === 401;
}
