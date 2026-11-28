/* NAV Worker 入口：API 路由 + 静态资产（安全头统一注入）+ Cron 定时任务 */
import { Env, err, json, rateLimited, requireAdmin } from "./_shared";
import * as h from "./handlers";
import * as msTodo from "./mstodo";
import * as ai from "./ai";
import * as icons from "./icons";
import { runScheduled, stalenessAlert, CRON_STALE, CRON_DAILY } from "./scheduled";

function withSecurityHeaders(res: Response): Response {
  const r = new Response(res.body, res);
  r.headers.set("x-frame-options", "DENY");
  r.headers.set("x-content-type-options", "nosniff");
  r.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  r.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  r.headers.set(
    "content-security-policy",
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  if (r.headers.get("content-type")?.includes("text/html")) {
    r.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  return r;
}

const ROUTES: Record<string, Partial<Record<string, (req: Request, env: Env) => Promise<Response>>>> = {
  "/api/login": { POST: h.login },
  "/api/collector/login": { POST: h.collectorLogin },
  "/api/logout": { POST: (req) => h.logout(req) },
  "/api/session": { GET: h.session },
  "/api/account": { PUT: h.updateAccount },
  "/api/config": { GET: h.getConfig, PUT: h.putConfig },
  "/api/collector-config": { GET: h.collectorConfig },
  "/api/ingest": { POST: h.ingest },
  "/api/latest": { GET: h.latest },
  "/api/history": { GET: h.history },
  "/api/alerts": { GET: h.alerts },
  "/api/todos": { GET: h.getTodos, PUT: h.putTodos },
  // 管理员手动触发失联检测（与 Cron 相同逻辑；便于验证与即时告警）
  "/api/weather": { GET: async (req, env) => {
    const url = new URL(req.url);
    const city = (url.searchParams.get("city") || "").trim();
    // 城市名白名单：中英文/数字/空格及 , . - ' （覆盖"南宁"/"New York"/"Springfield, IL"）。
    // 防止超长串或控制字符进入第三方 API URL 与 KV cacheKey（匿名可访问，必须收紧）。
    if (!city || city.length > 64 || !/^[\p{L}\p{N} ,.'\-]+$/u.test(city)) return err(400, "城市参数不合法");
    // 免费接口被匿名刷会打爆三方配额与 KV 写次数：按 IP 限速 20 次/15 分钟。
    // 前端有 localStorage 缓存，正常用户几乎不会触顶。
    if (await rateLimited(env, req, "rl:weather", 20)) return err(429, "请求过于频繁，请稍后再试");
    return h.weather(env, city);
  } },
  "/api/hotsearch": { GET: async (req, env) => {
    const url = new URL(req.url);
    const source = (url.searchParams.get("source") || "baidu").trim().toLowerCase();
    if (!h.isHotsearchSource(source)) return err(400, "不支持的热搜源");
    if (await rateLimited(env, req, "rl:hotsearch", 30)) return err(429, "请求过于频繁，请稍后再试");
    return h.hotsearch(env, source);
  } },
  "/api/stale-check": { POST: async (req, env) => {
    const { authed } = await requireAdmin(req, env);
    if (!authed) return err(401, "未登录");
    await stalenessAlert(env);
    return json({ ok: true });
  } },
  "/api/ms-todo/status": { GET: msTodo.msTodoStatus },
  "/api/ms-todo/auth-url": { GET: msTodo.msTodoAuthUrl },
  "/api/ms-todo/callback": { GET: msTodo.msTodoCallback },
  "/api/ms-todo/disconnect": { POST: msTodo.msTodoDisconnect },
  "/api/ms-todo/lists": { GET: msTodo.msTodoLists },
  "/api/ms-todo/list": { POST: msTodo.msTodoSelectList },
  "/api/ms-todo/tasks": {
    GET: msTodo.msTodoTasks,
    POST: msTodo.msTodoCreateTask,
    PATCH: msTodo.msTodoUpdateTask,
    DELETE: msTodo.msTodoDeleteTask,
  },
  "/api/ai/logs": { GET: ai.getAiLogs },
  "/api/ai/models": { GET: ai.getAiModels },
  "/api/ai/usage": { GET: ai.getAiUsage },
  "/api/ai/diagnose": { POST: ai.aiDiagnose },
  "/api/icons": {
    GET: icons.listIcons,
    POST: icons.createIcon,
    PUT: icons.updateIcon,
    DELETE: icons.deleteIcon,
  },
  "/api/icons/reset": { POST: icons.resetIcons },
  "/api/icons/migrate": { POST: icons.migrateIcons },
  "/api/favicon": { GET: h.fetchFavicon },
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      const handler = ROUTES[url.pathname]?.[req.method];
      if (!handler) return err(404, "接口不存在");
      try {
        const res = withSecurityHeaders(await handler(req, env));
        if (!res.headers.has("cache-control")) {
          res.headers.set("cache-control", "no-store");
        }
        return res;
      } catch (e) {
        console.error("api error", url.pathname, e);
        return err(500, "内部错误");
      }
    }
    // 静态资产（SPA 回退由 assets 配置处理）
    const asset = await env.ASSETS.fetch(req);
    const res = withSecurityHeaders(asset);
    if (url.pathname.startsWith("/assets/") && res.ok) {
      res.headers.set("cache-control", "public, max-age=31536000, immutable");
    } else if (url.pathname === "/" || url.pathname === "/index.html" || res.headers.get("content-type")?.includes("text/html")) {
      res.headers.set("cache-control", "no-store");
    }
    return res;
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === CRON_STALE || event.cron === CRON_DAILY) {
      ctx.waitUntil(runScheduled(event, env));
    }
  },
} satisfies ExportedHandler<Env>;
