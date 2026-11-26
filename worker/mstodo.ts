/* Microsoft Graph To Do API 代理与 OAuth2 令牌管理（个人微软账号 consumers 端点） */
import { Env, err, json, requireAdmin } from "./_shared";

const KV_AUTH_KEY = "mstodo:auth";
const KV_STATE_PREFIX = "mstodo:state:";
const MS_AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MS_GRAPH_BASE = "https://graph.microsoft.com/v1.0/me/todo";
const MS_SCOPES = "offline_access Tasks.ReadWrite User.Read";

interface StoredMsAuth {
  refresh_token: string;
  access_token?: string;
  expires_at?: number; // ms epoch
  list_id?: string;
  list_name?: string;
  updated_at: number;
}

export interface MsTodoList {
  id: string;
  displayName: string;
  wellknownListName?: string;
}

export interface MsTodoTask {
  id: string;
  title: string;
  status: "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred";
  importance: "low" | "normal" | "high";
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}

function isConfigured(env: Env): boolean {
  return !!(env.MS_CLIENT_ID?.trim() && env.MS_CLIENT_SECRET?.trim());
}

async function readAuth(env: Env): Promise<StoredMsAuth | null> {
  const raw = await env.KV.get(KV_AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredMsAuth;
    return parsed?.refresh_token ? parsed : null;
  } catch {
    return null;
  }
}

async function writeAuth(env: Env, data: StoredMsAuth): Promise<void> {
  await env.KV.put(KV_AUTH_KEY, JSON.stringify(data));
}

async function getAccessToken(env: Env): Promise<{ token: string; auth: StoredMsAuth }> {
  if (!isConfigured(env)) throw new Error("未配置 MS_CLIENT_ID / MS_CLIENT_SECRET");
  const auth = await readAuth(env);
  if (!auth) throw new Error("尚未连接 Microsoft To Do");

  if (auth.access_token && auth.expires_at && auth.expires_at - 60_000 > Date.now()) {
    return { token: auth.access_token, auth };
  }

  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID!.trim(),
    client_secret: env.MS_CLIENT_SECRET!.trim(),
    refresh_token: auth.refresh_token,
    grant_type: "refresh_token",
    scope: MS_SCOPES,
  });

  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `刷新令牌失败 (${res.status})`);
  }

  const nextAuth: StoredMsAuth = {
    ...auth,
    access_token: data.access_token,
    refresh_token: data.refresh_token || auth.refresh_token,
    expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    updated_at: Date.now(),
  };
  await writeAuth(env, nextAuth);
  return { token: data.access_token, auth: nextAuth };
}

async function graphFetch<T>(env: Env, path: string, init?: RequestInit): Promise<{ data: T; auth: StoredMsAuth }> {
  const { token, auth } = await getAccessToken(env);
  const res = await fetch(`${MS_GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (res.status === 204) return { data: undefined as T, auth };
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message || `Graph API ${res.status}`;
    throw new Error(msg);
  }
  return { data: body as T, auth };
}

async function resolveList(env: Env, auth: StoredMsAuth, requestedListId?: string): Promise<{ listId: string; listName: string }> {
  if (requestedListId) return { listId: requestedListId, listName: auth.list_name || "待办" };
  if (auth.list_id) return { listId: auth.list_id, listName: auth.list_name || "任务" };

  const { data } = await graphFetch<{ value?: MsTodoList[] }>(env, "/lists");
  const lists = data.value || [];
  const chosen = lists.find((l) => l.wellknownListName === "defaultList") || lists[0];
  if (!chosen) throw new Error("未找到可用的 Microsoft To Do 清单");

  await writeAuth(env, { ...auth, list_id: chosen.id, list_name: chosen.displayName, updated_at: Date.now() });
  return { listId: chosen.id, listName: chosen.displayName };
}

/* ---------- 导出路由处理器 ---------- */

export async function msTodoStatus(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const auth = await readAuth(env);
  return json({
    configured: isConfigured(env),
    connected: !!auth,
    listId: auth?.list_id || null,
    listName: auth?.list_name || null,
  });
}

export async function msTodoAuthUrl(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  if (!isConfigured(env)) return err(400, "尚未配置 MS_CLIENT_ID 或 MS_CLIENT_SECRET");

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/ms-todo/callback`;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await env.KV.put(`${KV_STATE_PREFIX}${state}`, "1", { expirationTtl: 600 });

  const params = new URLSearchParams({
    client_id: env.MS_CLIENT_ID!.trim(),
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: MS_SCOPES,
    state,
    prompt: "select_account",
  });
  return json({ url: `${MS_AUTH_URL}?${params.toString()}`, redirectUri });
}

export async function msTodoCallback(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return new Response("请先在 NAV 登录管理员账户后再绑定 Microsoft To Do。", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!isConfigured(env)) return new Response("未配置 MS_CLIENT_ID / MS_CLIENT_SECRET", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });

  const url = new URL(req.url);
  const oauthErr = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthErr) {
    return new Response(`授权失败：${oauthErr}`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state) {
    return new Response("缺少授权码或 state 参数", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const stateKey = `${KV_STATE_PREFIX}${state}`;
  const validState = await env.KV.get(stateKey);
  await env.KV.delete(stateKey);
  if (!validState) {
    return new Response("授权状态已过期或无效，请返回重试", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const redirectUri = `${url.origin}/api/ms-todo/callback`;
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID!.trim(),
    client_secret: env.MS_CLIENT_SECRET!.trim(),
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: MS_SCOPES,
  });

  const tokenRes = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenData.refresh_token || !tokenData.access_token) {
    return new Response(`换取令牌失败：${tokenData.error_description || tokenData.error || tokenRes.status}`, {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const prev = await readAuth(env);
  await writeAuth(env, {
    refresh_token: tokenData.refresh_token,
    access_token: tokenData.access_token,
    expires_at: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000,
    list_id: prev?.list_id,
    list_name: prev?.list_name,
    updated_at: Date.now(),
  });

  return Response.redirect(`${url.origin}/?mstodo=connected`, 302);
}

export async function msTodoDisconnect(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  await env.KV.delete(KV_AUTH_KEY);
  return json({ ok: true });
}

export async function msTodoLists(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  try {
    const { data, auth } = await graphFetch<{ value?: MsTodoList[] }>(env, "/lists");
    const lists = (data.value || []).map((l) => ({
      id: l.id,
      displayName: l.displayName,
      wellknownListName: l.wellknownListName,
    }));
    return json({ lists, selectedListId: auth.list_id || null });
  } catch (e) {
    return err(502, (e as Error).message);
  }
}

export async function msTodoSelectList(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const auth = await readAuth(env);
  if (!auth) return err(400, "尚未连接 Microsoft To Do");
  const body = (await req.json().catch(() => ({}))) as { listId?: string; listName?: string };
  const listId = String(body.listId || "").trim();
  const listName = String(body.listName || "任务").trim();
  if (!listId) return err(400, "缺少 listId");
  await writeAuth(env, { ...auth, list_id: listId, list_name: listName, updated_at: Date.now() });
  return json({ ok: true, listId, listName });
}

export async function msTodoTasks(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const auth = await readAuth(env);
  if (!auth) return err(400, "尚未连接 Microsoft To Do");
  const url = new URL(req.url);
  const reqListId = (url.searchParams.get("listId") || "").trim() || undefined;
  try {
    const { listId, listName } = await resolveList(env, auth, reqListId);
    const { data } = await graphFetch<{ value?: MsTodoTask[] }>(
      env,
      `/lists/${encodeURIComponent(listId)}/tasks?$top=50`,
    );
    const tasks = (data.value || []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      importance: t.importance,
      createdDateTime: t.createdDateTime,
      lastModifiedDateTime: t.lastModifiedDateTime,
    }));
    return json({ listId, listName, tasks });
  } catch (e) {
    return err(502, (e as Error).message);
  }
}

export async function msTodoCreateTask(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const auth = await readAuth(env);
  if (!auth) return err(400, "尚未连接 Microsoft To Do");
  const body = (await req.json().catch(() => ({}))) as { title?: string; listId?: string };
  const title = String(body.title || "").trim();
  if (!title || title.length > 255) return err(400, "任务标题不合法");
  try {
    const { listId } = await resolveList(env, auth, body.listId?.trim() || undefined);
    const { data } = await graphFetch<MsTodoTask>(env, `/lists/${encodeURIComponent(listId)}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return json({ task: data });
  } catch (e) {
    return err(502, (e as Error).message);
  }
}

export async function msTodoUpdateTask(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const auth = await readAuth(env);
  if (!auth) return err(400, "尚未连接 Microsoft To Do");
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    listId?: string;
    status?: "completed" | "notStarted";
    importance?: "high" | "normal";
    title?: string;
  };
  const id = String(body.id || "").trim();
  if (!id) return err(400, "缺少任务 id");
  const patch: Record<string, unknown> = {};
  if (body.status === "completed" || body.status === "notStarted") patch.status = body.status;
  if (body.importance === "high" || body.importance === "normal") patch.importance = body.importance;
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (Object.keys(patch).length === 0) return err(400, "无有效更新字段");
  try {
    const { listId } = await resolveList(env, auth, body.listId?.trim() || undefined);
    const { data } = await graphFetch<MsTodoTask>(
      env,
      `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    return json({ task: data });
  } catch (e) {
    return err(502, (e as Error).message);
  }
}

export async function msTodoDeleteTask(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  const auth = await readAuth(env);
  if (!auth) return err(400, "尚未连接 Microsoft To Do");
  const body = (await req.json().catch(() => ({}))) as { id?: string; listId?: string };
  const id = String(body.id || "").trim();
  if (!id) return err(400, "缺少任务 id");
  try {
    const { listId } = await resolveList(env, auth, body.listId?.trim() || undefined);
    await graphFetch(env, `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return json({ ok: true });
  } catch (e) {
    return err(502, (e as Error).message);
  }
}
