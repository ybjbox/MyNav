# Cloudflare Support Ticket / Community Post — Draft

> 用途：复制到 https://dash.cloudflare.com/?account=support （Free 计划工单入口）
> 或发到 Cloudflare Community：https://community.cloudflare.com/c/developers/workers/48
> 建议先发社区帖（Free 计划工单通常只受理账务问题），附上本帖内容 + Ray ID。

---

**Subject:** Every Worker on my account returns Error 1101 on workers.dev — even a minimal Hello World; cron (scheduled) invocations execute fine, zero fetch invocations logged

**Account ID:** `442d71e0643878f28a8b34a027a780e1`
**Workers.dev subdomain:** `xy-drive.workers.dev`
**Date/time:** 2026-11-21, 08:54–09:12 UTC (ongoing)
**Plan:** Free
**Affected workers:** `nav` (main worker) and a disposable `nav-hello-test` (created only for reproduction, since deleted)

## Symptoms

- **Every fetch request to any worker on this account returns HTTP 500 with `error code: 1101`** (Worker threw exception), regardless of code content.
- **Scheduled (cron trigger) invocations execute successfully** — tail shows `outcome: "ok"` on the same version that fails fetches.
- **Zero fetch invocations** appear in `wrangler tail` or Workers Logs (only cron events arrive); Workers Logs (observability, head_sampling_rate 1, invocation_logs true) record nothing for fetches.
- Non-existent script name on the same subdomain correctly returns **error 1042**, so subdomain routing itself works.

## Evidence / what I ruled out

1. **Minimal reproduction:** deployed a hello-world worker (`export default { async fetch() { return new Response("hello") } }`) → 1101 on every request. Same result with `compatibility_date = "2024-01-01"` and `"2026-11-01"`.
2. **Same code works via preview infra:** `wrangler dev --remote` (same bundle, real bindings, edge execution) → HTTP 200 for the same paths that 1101 in production.
3. **Code verified clean:** deployed script content downloaded via API and compared — identical, standard module worker with try/catch-wrapped handlers; a pure 404 route (`/api/xyz`, no bindings touched) also 1101s.
4. **Config verified correct:** script settings via API show correct `compatibility_date`, all bindings (D1, KV, ASSETS, 3 secrets), observability enabled, deployments list shows latest version at 100%.
5. **Assets orchestration ruled out:** reproduced identically with and without the `[assets]` configuration, and with `run_worker_first = true` vs `["/api/*"]`.
6. **Network ruled out:** verified from two different network paths (local + external fetch); `Server: cloudflare` with valid `CF-RAY`; cloudflare.com returns 200.

## Sample Ray IDs (all ending `-ADL`, HTTP 500, body `error code: 1101`)

- `a5de919a0d2aec82-ADL` — 2026-11-21 09:11:44 GMT — GET https://nav.xy-drive.workers.dev/api/session
- `a5de91fb9fc7ec82-ADL` — 2026-11-21 09:12:00 GMT — GET https://nav.xy-drive.workers.dev/api/session
- `a5de9215ae56ec82-ADL` — 2026-11-21 09:12:04 GMT — GET https://nav.xy-drive.workers.dev/api/session

## Deployment timeline (2026-11-21 UTC)

- 08:47 — `dash` deployment, version `5eb351c1` (manual, dashboard)
- 08:54 — wrangler deploy, version `853d6e0e` (compat 2026-11-01, observability enabled)
- 09:01 / 09:03 / 09:06 — wrangler deploys `3fcc6b3a` / `aeeda40b` / `7b8b2853` (diagnostic iterations; final config restored)

All fetches failed with 1101 across every version, including the dashboard one at 08:47.

## Request

Please check for an account-level execution issue on the `xy-drive.workers.dev` subdomain ingress. This matches the pattern reported by several other accounts this month (e.g. "Workers.dev returns Error 1101 for every Worker in my account — zero invocations in logs", Nov 10, 2026; "All Workers on my account throw Error 1101 (even simple Hello World)", Nov 19, 2026).

Happy to provide any additional identifiers or re-run specific tests.
