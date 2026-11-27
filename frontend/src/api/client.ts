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
  session: () => req<{ authenticated: boolean; collectorConfigured: boolean }>("/api/session"),
  getConfig: () => req<{ config: import("../types").NavConfig; authenticated: boolean }>("/api/config"),
  putConfig: (config: import("../types").NavConfig) =>
    req<{ ok: true; version: number }>("/api/config", { method: "PUT", body: JSON.stringify({ config }) }),
  login: (password: string) =>
    req<{ ok: true }>("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: true }>("/api/logout", { method: "POST" }),
  changePassword: (oldPassword: string, newPassword: string) =>
    req<{ ok: true }>("/api/password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword }) }),
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
  aiLogs: (detail = false) =>
    req<{
      available: boolean;
      aiBound: boolean;
      meta: {
        updated_at: number;
        source: string;
        counts: { openwrt: number; openclash: number; nas: number };
      } | null;
      logs?: { updated_at: number; source: string; openwrt: string[]; openclash: string[]; nas?: string[] } | null;
    }>(`/api/ai/logs${detail ? "?detail=1" : ""}`),
  aiModels: (refresh = false) =>
    req<{
      models: { id: string; name: string; description?: string }[];
      source: "online" | "builtin";
      updatedAt: number;
    }>(`/api/ai/models${refresh ? "?refresh=1" : ""}`),
  aiDiagnose: (payload: { mode: "auto" | "manual"; model?: string; openwrt?: string; openclash?: string; nas?: string; question?: string }) =>
    req<{ ok: true; model: string; mode: string; analyzedAt: number; report: string }>("/api/ai/diagnose", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export function isUnauthorized(e: unknown): boolean {
  return (e as { status?: number }).status === 401;
}
