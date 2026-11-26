/* 定时任务：失联告警（每 5 分钟）+ 每日数据清理 */
import { Env } from "./_shared";

export const CRON_STALE = "*/5 * * * *";
export const CRON_DAILY = "40 4 * * *";

const STALE_AFTER_MS = 10 * 60_000;

interface StaleAlertConfig {
  enabled?: boolean;
  bark?: { url?: string; key?: string };
  telegram?: { token?: string; chatId?: string };
  webhook?: { url?: string; template?: string };
}

export async function runScheduled(event: { cron: string }, env: Env): Promise<void> {
  if (event.cron === CRON_DAILY) {
    await dailyCleanup(env);
    return;
  }
  await stalenessAlert(env);
}

/* ---------- 失联告警：路由器/NAS 采集器停止推送时主动通知 ---------- */
export async function stalenessAlert(env: Env): Promise<void> {
  try {
    let cfg: { monitor?: { staleAlert?: StaleAlertConfig } } | null = null;
    try {
      const raw = await env.KV.get("config");
      if (raw) cfg = JSON.parse(raw);
    } catch {
      return;
    }
    const sa = cfg?.monitor?.staleAlert;
    if (!sa || !sa.enabled) return;

    let rows: { source: string; updated_at: number }[] = [];
    try {
      const r = await env.DB.prepare("SELECT source, updated_at FROM latest").all<{ source: string; updated_at: number }>();
      rows = r.results || [];
    } catch {
      return;
    }
    if (rows.length === 0) return;

    const now = Date.now();
    for (const row of rows) {
      const stale = now - row.updated_at > STALE_AFTER_MS;
      const flagged = await env.KV.get(`staleAlerted:${row.source}`);
      if (stale && !flagged) {
        const minutes = Math.floor((now - row.updated_at) / 60000);
        await notify(sa, `[NAV] ${row.source} 失联`, `采集器已有 ${minutes} 分钟未推送数据，请检查设备`, row.source);
        await env.KV.put(`staleAlerted:${row.source}`, String(now), { expirationTtl: 7 * 86400 });
      } else if (!stale && flagged) {
        await notify(sa, `[NAV] ${row.source} 已恢复`, "采集器数据推送已恢复", row.source);
        await env.KV.delete(`staleAlerted:${row.source}`);
      }
    }
  } catch (e) {
    console.error("stalenessAlert 异常:", e);
  }
}

async function notify(sa: StaleAlertConfig, title: string, body: string, source: string): Promise<void> {
  const send = async (url: string, payload: string) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
      if (!res.ok) console.error(`stale-alert: ${url} -> ${res.status}`);
    } catch (e) {
      console.error("stale-alert: 发送失败", e);
    }
  };

  if (sa.bark?.url && sa.bark?.key) {
    await send(
      `${sa.bark.url.replace(/\/$/, "")}/push`,
      JSON.stringify({ device_key: sa.bark.key, title, body, group: "nav" }),
    );
  }
  if (sa.telegram?.token && sa.telegram?.chatId) {
    await send(
      `https://api.telegram.org/bot${sa.telegram.token}/sendMessage`,
      JSON.stringify({ chat_id: sa.telegram.chatId, text: `${title}\n${body}` }),
    );
  }
  if (sa.webhook?.url) {
    const template = sa.webhook.template || '{"title":"{{title}}","message":"{{message}}","source":"{{source}}"}';
    const payload = template
      .replaceAll("{{title}}", title)
      .replaceAll("{{message}}", body)
      .replaceAll("{{source}}", source);
    await send(sa.webhook.url, payload);
  }
}

/* ---------- 每日清理：31 天前的采样与已恢复告警 ---------- */
async function dailyCleanup(env: Env): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 31 * 86400;
  try {
    await env.DB.exec(`DELETE FROM samples WHERE ts < ${cutoff}`);
    await env.DB.exec(`DELETE FROM alerts WHERE resolved_at IS NOT NULL AND resolved_at < ${cutoff}`);
  } catch (e) {
    console.error("daily-cleanup 失败", e);
  }
}
