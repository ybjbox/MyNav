/* 待办 WeTab 风格组件：已连接微软 To Do 走微软同步；已登录走 Cloudflare KV 云端同步；未登录使用本机 localStorage */
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useStore } from "../state/store";
import { loadTodos, saveTodos, type TodoItem } from "../lib/storage";
import { newId } from "../lib/defaultConfig";
import type { WidgetProps } from "./registry";

interface CloudTodo {
  id: string;
  text: string;
  done: boolean;
  starred?: boolean;
  ts: number;
}

interface MsTaskItem {
  id: string;
  title: string;
  status: "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred";
  importance: "low" | "normal" | "high";
}

interface MsListItem {
  id: string;
  displayName: string;
}

export function WidgetTodo(_props: WidgetProps) {
  const { authed, toast } = useStore();
  const [localTodos, setLocalTodos] = useState<TodoItem[]>(() => loadTodos());
  const [cloudTodos, setCloudTodos] = useState<CloudTodo[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [text, setText] = useState("");

  // Microsoft To Do 状态（仅在已配置并授权连接时启用）
  const [msConnected, setMsConnected] = useState(false);
  const [msLists, setMsLists] = useState<MsListItem[]>([]);
  const [msListId, setMsListId] = useState<string | null>(null);
  const [msListName, setMsListName] = useState<string>("Microsoft To Do");
  const [msTasks, setMsTasks] = useState<MsTaskItem[]>([]);
  const [msLoading, setMsLoading] = useState(false);
  const [msBusy, setMsBusy] = useState(false);

  const loadMsTodo = useCallback(async (targetListId?: string) => {
    setMsLoading(true);
    try {
      const [tasksRes, listsRes] = await Promise.all([
        api.msTodoTasks(targetListId),
        api.msTodoLists().catch(() => null),
      ]);
      setMsListId(tasksRes.listId);
      setMsListName(tasksRes.listName || "任务");
      setMsTasks(tasksRes.tasks || []);
      if (listsRes?.lists) setMsLists(listsRes.lists);
    } catch (e) {
      toast(`微软待办同步失败：${(e as Error).message}`, true);
    } finally {
      setMsLoading(false);
    }
  }, [toast]);

  const loadCloudTodo = useCallback(async () => {
    setCloudLoading(true);
    try {
      const res = await api.getTodos();
      if (res.todos.length === 0) {
        // 若云端首次为空而本机有旧待办，自动迁上云端避免数据消失
        const cached = loadTodos();
        if (cached.length > 0) {
          const migrated: CloudTodo[] = cached.map((t) => ({ ...t, starred: false }));
          await api.putTodos(migrated);
          setCloudTodos(migrated);
          return;
        }
      }
      setCloudTodos(res.todos);
    } catch (e) {
      toast(`云端待办同步失败：${(e as Error).message}`, true);
    } finally {
      setCloudLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authed) {
      setMsConnected(false);
      return;
    }
    let cancelled = false;
    api.msTodoStatus()
      .then((s) => {
        if (cancelled) return;
        setMsConnected(s.connected);
        if (s.connected) {
          void loadMsTodo(s.listId || undefined);
        } else {
          void loadCloudTodo();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMsConnected(false);
          void loadCloudTodo();
        }
      });
    return () => { cancelled = true; };
  }, [authed, loadMsTodo, loadCloudTodo]);

  // 同步模式判定：mstodo > cloud (Cloudflare KV) > local (localStorage)
  const syncMode: "mstodo" | "cloud" | "local" = !authed ? "local" : msConnected ? "mstodo" : "cloud";

  const mutateLocal = (next: TodoItem[]) => {
    saveTodos(next);
    setLocalTodos(next);
  };

  const mutateCloud = async (next: CloudTodo[]) => {
    const prev = cloudTodos;
    setCloudTodos(next);
    try {
      await api.putTodos(next);
    } catch (e) {
      setCloudTodos(prev);
      toast(`云端保存失败：${(e as Error).message}`, true);
    }
  };

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    if (syncMode === "local") {
      mutateLocal([{ id: newId("t"), text: t, done: false, ts: Date.now() }, ...localTodos]);
      setText("");
      return;
    }
    if (syncMode === "cloud") {
      setText("");
      await mutateCloud([{ id: newId("t"), text: t, done: false, starred: false, ts: Date.now() }, ...cloudTodos]);
      return;
    }
    setMsBusy(true);
    try {
      const { task } = await api.msTodoCreateTask(t, msListId || undefined);
      setMsTasks((prev) => [task, ...prev]);
      setText("");
    } catch (e) {
      toast(`添加失败：${(e as Error).message}`, true);
    } finally {
      setMsBusy(false);
    }
  };

  const toggle = async (id: string) => {
    if (syncMode === "local") {
      mutateLocal(localTodos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
      return;
    }
    if (syncMode === "cloud") {
      await mutateCloud(cloudTodos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
      return;
    }
    const target = msTasks.find((t) => t.id === id);
    if (!target) return;
    const nextStatus = target.status === "completed" ? "notStarted" : "completed";
    const prev = msTasks;
    setMsTasks((list) => list.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
    try {
      await api.msTodoUpdateTask({ id, listId: msListId || undefined, status: nextStatus });
    } catch (e) {
      setMsTasks(prev);
      toast(`更新失败：${(e as Error).message}`, true);
    }
  };

  const toggleStar = async (id: string) => {
    if (syncMode === "local") return;
    if (syncMode === "cloud") {
      await mutateCloud(cloudTodos.map((t) => (t.id === id ? { ...t, starred: !t.starred } : t)));
      return;
    }
    const target = msTasks.find((t) => t.id === id);
    if (!target) return;
    const nextImp = target.importance === "high" ? "normal" : "high";
    const prev = msTasks;
    setMsTasks((list) => list.map((t) => (t.id === id ? { ...t, importance: nextImp } : t)));
    try {
      await api.msTodoUpdateTask({ id, listId: msListId || undefined, importance: nextImp });
    } catch (e) {
      setMsTasks(prev);
      toast(`标星失败：${(e as Error).message}`, true);
    }
  };

  const remove = async (id: string) => {
    if (syncMode === "local") {
      mutateLocal(localTodos.filter((t) => t.id !== id));
      return;
    }
    if (syncMode === "cloud") {
      await mutateCloud(cloudTodos.filter((t) => t.id !== id));
      return;
    }
    const prev = msTasks;
    setMsTasks((list) => list.filter((t) => t.id !== id));
    try {
      await api.msTodoDeleteTask(id, msListId || undefined);
    } catch (e) {
      setMsTasks(prev);
      toast(`删除失败：${(e as Error).message}`, true);
    }
  };

  const clearDone = () => {
    if (syncMode === "local") mutateLocal(localTodos.filter((t) => !t.done));
    else if (syncMode === "cloud") void mutateCloud(cloudTodos.filter((t) => !t.done));
  };

  const switchList = async (nextId: string) => {
    const found = msLists.find((l) => l.id === nextId);
    const name = found?.displayName || "任务";
    setMsListId(nextId);
    setMsListName(name);
    try {
      await api.msTodoSelectList(nextId, name);
      await loadMsTodo(nextId);
    } catch (e) {
      toast(`切换清单失败：${(e as Error).message}`, true);
    }
  };

  const viewItems =
    syncMode === "mstodo"
      ? msTasks.map((t) => ({
          id: t.id,
          text: t.title,
          done: t.status === "completed",
          starred: t.importance === "high",
        }))
      : syncMode === "cloud"
        ? cloudTodos.map((t) => ({ id: t.id, text: t.text, done: t.done, starred: !!t.starred }))
        : localTodos.map((t) => ({ id: t.id, text: t.text, done: t.done, starred: false }));

  const doneCount = viewItems.filter((t) => t.done).length;
  const syncing = syncMode === "mstodo" ? msLoading : syncMode === "cloud" ? cloudLoading : false;

  return (
    <div
      className="todowrap widget-todo"
      style={{
        height: "100%",
        minHeight: 0,
        padding: "16px 18px",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.94)",
        color: "#1e2430",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {syncMode !== "local" && (
        <div className="todo-syncbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, fontSize: 11.5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 6,
                background: "var(--accent-dim)",
                color: "var(--accent)",
                fontWeight: 600,
                fontSize: 10.5,
                flexShrink: 0,
              }}
            >
              {syncMode === "mstodo" ? "MS To Do" : "云端同步"}
            </span>
            {syncMode === "mstodo" ? (
              msLists.length > 0 ? (
                <select
                  aria-label="选择微软待办清单"
                  value={msListId || ""}
                  onChange={(e) => void switchList(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#334155",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    outline: "none",
                    maxWidth: 140,
                  }}
                >
                  {msLists.map((l) => (
                    <option key={l.id} value={l.id}>{l.displayName}</option>
                  ))}
                </select>
              ) : (
                <span style={{ fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {msListName}
                </span>
              )
            ) : (
              <span style={{ fontWeight: 600, color: "#334155" }}>待办清单</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => (syncMode === "mstodo" ? void loadMsTodo(msListId || undefined) : void loadCloudTodo())}
            disabled={syncing}
            title="立即同步"
            style={{
              border: "none",
              background: "transparent",
              color: "#64748b",
              cursor: syncing ? "default" : "pointer",
              fontSize: 11,
              padding: "2px 4px",
            }}
          >
            {syncing ? "同步中…" : "↻ 同步"}
          </button>
        </div>
      )}

      <div className="todo-inputrow" style={{ display: "flex", gap: 6 }}>
        <input
          className="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          placeholder={
            syncMode === "mstodo"
              ? `添加到「${msListName}」，回车同步`
              : syncMode === "cloud"
                ? "添加待办，自动云端同步"
                : "添加待办，回车确认"
          }
          aria-label="添加待办"
          maxLength={200}
          disabled={msBusy}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "7px 11px",
            borderRadius: 10,
            border: "1px solid rgba(15, 23, 42, 0.12)",
            background: "#f8fafc",
            color: "#0f172a",
            fontSize: 12.5,
          }}
        />
        <button
          className="todo-addbtn"
          onClick={() => void add()}
          disabled={!text.trim() || msBusy}
          aria-label="添加"
          style={{
            padding: "6px 12px",
            borderRadius: 10,
            border: "none",
            background: text.trim() ? "var(--accent)" : "rgba(15, 23, 42, 0.08)",
            color: text.trim() ? "var(--accent-ink, #fff)" : "#94a3b8",
            fontSize: 12,
            fontWeight: 500,
            cursor: text.trim() && !msBusy ? "pointer" : "default",
          }}
        >
          添加
        </button>
      </div>

      {viewItems.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 12.5, padding: "12px 0" }}>
          {syncing ? "正在从云端同步待办…" : "暂无待办"}
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            {syncMode === "mstodo"
              ? "已连接微软待办，多端实时同步"
              : syncMode === "cloud"
                ? "保存于 Cloudflare KV，登录后多端同步"
                : "数据保存在本机，不上传"}
          </div>
        </div>
      ) : (
        <ul
          className="todo-list"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {viewItems.map((t) => (
            <li
              key={t.id}
              className={`todo-item${t.done ? " done" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 10px",
                borderRadius: 12,
                background: "rgba(15, 23, 42, 0.03)",
                fontSize: 12.5,
                color: t.done ? "#94a3b8" : "#1e293b",
                textDecoration: t.done ? "line-through" : "none",
              }}
            >
              <input type="checkbox" checked={t.done} onChange={() => void toggle(t.id)} aria-label={`完成 ${t.text}`} />
              <span className="t" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.text}
              </span>
              {syncMode !== "local" && (
                <button
                  type="button"
                  onClick={() => void toggleStar(t.id)}
                  title={t.starred ? "取消重要" : "标为重要"}
                  aria-label={`标星 ${t.text}`}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: t.starred ? "#f59e0b" : "#cbd5e1",
                    cursor: "pointer",
                    fontSize: 13,
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                >
                  ★
                </button>
              )}
              <button
                className="del"
                onClick={() => void remove(t.id)}
                title="删除"
                aria-label={`删除 ${t.text}`}
                style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: "0 4px" }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {doneCount > 0 && (
        <div
          className="todo-foot"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "#64748b",
            paddingTop: 4,
            borderTop: "1px solid rgba(15, 23, 42, 0.06)",
          }}
        >
          <span>{viewItems.length} 项 · 完成 {doneCount}</span>
          {syncMode !== "mstodo" && (
            <button
              onClick={clearDone}
              style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 11.5, padding: 0 }}
            >
              清除已完成
            </button>
          )}
        </div>
      )}
    </div>
  );
}
