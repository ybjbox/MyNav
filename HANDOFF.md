# NAV 交接文档

> 本文档面向接手 NAV / MyNav 项目后续开发的开发者或 AI 工具。读完即可无上下文继续开发。
> 最后更新：2026-11-28（对应 `main` 最新提交 `8971bd3`）

---

## 一、项目是什么

NAV（MyNav）是一个**个人导航页 + 路由器 / NAS 轻量监控 + Bento 桌面组件 + AI 日志诊断**系统，部署在 **Cloudflare Workers（免费层）**，配合编译进路由器固件的 Go 采集器插件 `nav-collector`（唯一采集端，仅出站 HTTPS），实现：

- **导航网格**：分组卡片拖拽排序（`dnd-kit`）、跨组移动、文件夹 2×2 聚合、搜索（多引擎 + 搜索历史）、右键菜单
- **设备监控与告警**：主路由（FanchmWrt / OpenWrt）+ OpenClash + 飞牛 NAS（fnOS）在线状态、异常告警、卡片高亮、实时速率与历史趋势（24h / 7d / 30d）
- **Bento 桌面小组件**：天气、待办（KV 云端 + 可选 Microsoft To Do 同步）、Tiptap 富文本便签、番茄钟、倒计时、日历、热搜、常访、AI 日志诊断入口
- **自维护 D1 图标库**：常用站点图标入库管理（76 个内置种子图标）、后台远程抓取 Favicon 与本地上传裁剪
- **Workers AI 日志诊断**：7 天按小时分桶留存路由器 / OpenClash / NAS 脱敏日志，支持 SSE 流式输出、可配思考深度与 Neurons 用量监控

- **线上入口**：`https://nav.403333.xyz`（区域 `403333.xyz` 在 Cloudflare 账户上）
- **源码仓库**：`ybjbox/MyNav`（前端 + Worker）
- **设计风格**："Aurora Glass" —— 深色底 + 白玻璃卡 + 透明贴合站点图标（`.ico-site` 无白底衬）+ 极光绿强调色（默认可配置）；动效克制（150–400ms，尊重 `prefers-reduced-motion`）

---

## 二、架构与数据流

```
┌───────────── Cloudflare Workers（免费层） ──────────────────┐
│ Worker `nav`（wrangler.toml: main = worker/entry.bundle.js）│
│   ASSETS    = frontend/dist（React 18 + Vite + Antd SPA）   │
│   fetch     = API 路由（worker/entry.ts + handlers/ai/icons）│
│   scheduled = Cron（失联检测 */5 + 每日清理 40 4）          │
│   [ai] AI   = Cloudflare Workers AI 绑定                    │
│   D1 nav-db = latest / samples / alerts / logs_hourly       │
│               users / icon_library                          │
│   KV nav-kv = site config / AI cache / MS To Do / 限速计数   │
└───────────────▲─────────────────────────────────────────────┘
                │ HTTPS 出站推送（Bearer JWT，仅出站不入站）
┌───────────────┴── 路由器插件 nav-collector（唯一采集端） ───┐
│ /proc 本机 + 本地 ubus(fwx) + localhost Clash API           │
│ SSH 回采 NAS /proc（NAS 零安装）                            │
│ 卡片 TCP 探活 │ 阈值告警（Bark/TG/Webhook）│ 脱敏日志上报   │
└─────────────────────────────────────────────────────────────┘
```

**核心架构决策**（不可轻易推翻，均有已验证的原因）：

1. **路由器插件是唯一采集端**：NAS 数据由路由器插件通过受限 SSH 回采 `/proc`（NAS 零安装），不另跑独立 NAS 容器采集器。
2. **有壁纸时禁用 `backdrop-filter`**：Chromium 下 `backdrop-filter` 与 `html`/`body` 背景图组合会导致玻璃卡片内容吞层不可见。解法：`html.has-wallpaper` 改近实色半透明底并禁用 `backdrop-filter`。
3. **不用全屏 fixed 渐变层**：壁纸承载在 `html` 背景，遮罩渐变承载在 `body.has-wallpaper-scrim`，避免合成吞层。
4. **`wrangler` 需先 esbuild 预转译 Worker**：`npm run build:worker` 将 `worker/entry.ts` 编译为 `worker/entry.bundle.js`（已纳入 `.gitignore`，`wrangler.toml` 已配 `[build] command = "npm run build"`）。切勿把 `main` 直接指回 `.ts` 未构建状态部署。
5. **家庭侧零暴露**：采集器只出不进，不开路由器公网端口（本地配置页 `:12900` 仅 LAN）。
6. **站点图标透明承载（`.ico-site`）**：移除了白色矩形衬底，直接由 D1 图标库或品牌色块展示真实站点图标。

---

## 三、仓库与资源

### Cloudflare 资源（账户 `Ryan` / `442d71e0643878f28a8b34a027a780e1`）
| 资源 | 名称 / ID | 说明 |
|---|---|---|
| Worker | `nav` | 绑定自定义域名 `nav.403333.xyz` |
| D1 | `nav-db`（`44d13cf8-6e5a-4705-b72d-5530708adf0c`） | 已有 `latest` / `samples` / `alerts` / `logs_hourly` / `users` / `icon_library` 表；`migrations/0001_icon_library.sql` 已于 `2026-11-28` 执行到远程库 |
| KV | `nav-kv`（`42e3f7f630c049f29a633f08f0d14e73`） | 配置、缓存与限速计数 |
| Workers AI | `[ai] binding = "AI"` | 免费层每日 10,000 Neurons |

### GitHub 仓库
| 仓库 | 用途 |
|---|---|
| `ybjbox/MyNav` | 本项目源码（前端 + Worker + D1 Schema/Migrations） |
| `ybjbox/openwrt-packages` | **采集器唯一真源**：`nav-collector/`（Go 源码 + OpenWrt 包 + LuCI 页面 + `ipk.yml`） |
| `ybjbox/fanchmwrt-athena-builder` | 固件编译仓库 |

### 认证体系与 Worker Secrets
- **后台与采集器认证已全面升级为账号密码 + D1 `users` 表 + JWT**（`b99843e` 废弃旧单密码 `ADMIN_PASSWORD_HASH`，`5c25261` 移除旧 `COLLECTOR_TOKEN` 回退）：
  - 管理端：`POST /api/login` 签发 7 天 `nav_session` HttpOnly Cookie（带 `token_version`，`PUT /api/account` 修改账密时自动轮换使旧会话失效）。
  - 采集器：`POST /api/collector/login` 用账密换取 24 小时 Bearer JWT 推送 `/api/ingest`。
- **Worker Secrets（`npx wrangler secret put` 注入，切勿入库）**：
  - `JWT_SECRET`（HS256 签名密钥，可用 `scripts/gen-secret.mjs` 生成）
  - 可选：`CF_ACCOUNT_ID` / `CF_API_TOKEN`（用于在线拉取 Workers AI 模型列表与实时 Neurons 用量）
  - 可选：`QWEATHER_KEY` / `QWEATHER_HOST`（和风天气，未设时回退 KV 或 Open-Meteo）
  - 可选：`MS_CLIENT_ID` / `MS_CLIENT_SECRET`（Microsoft To Do OAuth2 多端同步）

---

## 四、目录结构与关键文件

```text
e:\MyNav\
├── frontend/
│   └── src/
│       ├── App.tsx                     # 组合根：DnD 上下文 + 右键菜单 + 模态调度
│       ├── api/client.ts               # API 客户端（含 /api/icons、/api/favicon、/api/ai/*）
│       ├── state/store.tsx             # 全局状态（config / session / snapshot / 图标库预加载）
│       ├── types.ts                    # 前后端共享类型
│       ├── components/
│       │   ├── ServiceCard.tsx         # 导航卡片 / 文件夹聚合形态
│       │   ├── Monitor.tsx             # 设备监控卡片（主路由 / OpenClash / NAS）
│       │   ├── Hero.tsx                # 时钟 + 搜索框
│       │   ├── SideRail.tsx            # 左侧分类栏（移动端改顶部横条）
│       │   ├── SettingsDrawer.tsx      # 设置抽屉（8 个标签页 + 统一底部保存栏）
│       │   ├── IconLibraryModal.tsx    # D1 图标库弹窗（常用 / 抓取 Favicon / 上传 / 基础图形）
│       │   ├── IconBlock.tsx           # 图标渲染（D1 图标库匹配 / 自定义图 / glyph / 首字兜底）
│       │   ├── EditServiceModal.tsx    # 服务与文件夹编辑弹窗
│       │   ├── IconCropModal.tsx       # 图标上传裁剪器
│       │   ├── AiDiagnoseModal.tsx     # AI 日志诊断弹窗（SSE 流式进度 + 模型选择 + 推理档位）
│       │   ├── AlertsDrawer.tsx        # 告警抽屉
│       │   ├── TrendModal.tsx          # 24h/7d/30d 流量趋势弹层
│       │   ├── ContextMenu.tsx         # 右键菜单
│       │   ├── RichNoteEditor.tsx      # Tiptap 富文本编辑器
│       │   ├── WeatherWidget.tsx       # 天气组件 + WeatherIcon.tsx（Meteocons 离线子集）
│       │   ├── GroupModal.tsx / LoginModal.tsx / AntdShell.tsx / primitives.tsx / icons.tsx
│       ├── widgets/
│       │   ├── registry.tsx            # Bento 组件注册表
│       │   ├── WidgetsSection.tsx      # Bento 网格 + 拖拽编排
│       │   ├── WidgetStoreModal.tsx    # 组件商店弹窗
│       │   └── Widget{Todo,Notes,AiDiagnose,Calendar,Countdown,Frequent,HotSearch,Pomodoro}.tsx
│       ├── lib/
│       │   ├── iconLibrary.ts          # D1 /api/icons 前端缓存与匹配（已去运行时 @iconify 与本地 JSON 膨胀）
│       │   ├── brands.ts / brandCatalog.ts / aiModels.ts / defaultConfig.ts
│       │   └── format.ts / meteo-subset.json / mock.ts / storage.ts / wallpapers.ts
│       └── styles/app.css              # 全局样式与 Aurora Glass tokens
├── worker/
│   ├── entry.ts                        # Worker fetch（全路由 + CSP 安全头）+ scheduled Cron
│   ├── handlers.ts                     # 登录 / 配置 / 采集 / 历史 / 告警 / 天气 / 热搜 / /api/favicon
│   ├── icons.ts                        # D1 icon_library 自动建表、76 种子初始化、CRUD、重置与迁移
│   ├── iconSeed.json                   # 76 个自维护站点图标离线种子数据（Base64 PNG/ICO + SVG 兜底）
│   ├── ai.ts                           # 7 天分桶日志读写、脱敏、Workers AI SSE 流式诊断与用量查询
│   ├── mstodo.ts                       # Microsoft To Do OAuth2 与任务代理
│   ├── scheduled.ts                    # 失联告警与日志/样本每日清理
│   ├── _shared.ts                      # JWT / PBKDF2 / D1 users / 限速 / 响应封装
│   └── _types.d.ts                     # Worker 运行时类型定义
├── migrations/
│   └── 0001_icon_library.sql           # 自维护图标库表迁移脚本（已执行至远程 D1）
├── scripts/
│   ├── collect-icon-seed.mjs           # 从常用站点重新抓取生成 worker/iconSeed.json
│   ├── check-ingest-contract.mjs       # ingest 数据契约校验脚本
│   └── gen-secret.mjs                  # 密钥生成脚本
├── docs/                               # DEPLOY / CONFIG / SECURITY / PLUGIN / SUPPORT-TICKET
├── schema.sql                          # 完整 D1 表结构（含 icon_library 与 logs_hourly）
├── wrangler.toml                       # Workers 配置（含 [build]、D1/KV/AI 绑定与 Cron）
└── HANDOFF.md                          # 本文档
```

---

## 五、近期已落地能力（截至 `8971bd3`）

- [x] **自维护本地图标库（D1 `icon_library`）**：告别上游图标库与本地 `brand-icons.json` 静态膨胀；内置 76 个站点图标种子，支持分类检索、站点远程抓取 Favicon（`/api/favicon`，仅管理员且带 SSRF 防护）、本地图片上传裁剪，以及旧本地图标平滑迁移（`/api/icons/migrate`）；`IconLibraryModal` 已去掉易引起误解的“路径 / DataURL”输入框。
- [x] **图标展示优化**：移除图标底部白色衬底，透明适配桌面玻璃风格。
- [x] **设置抽屉全面梳理重构**：8 个标签页（`外观与壁纸` / `搜索引擎` / `组件库` / `图标库` / `设备监控` / `AI 诊断` / `数据管理` / `账户安全`）统一布局与底部 `isDirty` 吸底保存栏。
- [x] **7 天滚动日志与 Workers AI 诊断升级**：D1 `logs_hourly` 按小时分桶存储 7 天 `openwrt` / `openclash` / `nas` 脱敏日志；支持 SSE 流式输出、思考推理档位（high/medium/low）、模型消耗倍数与今日 Neurons 用量监控；仅自动接收采集器上报日志，移除手动粘贴/侧边栏旧入口。
- [x] **账号密码登录全面切换**：D1 `users` 表 + `/api/login` + `/api/collector/login`，彻底清理旧 `COLLECTOR_TOKEN` 回退逻辑。
- [x] **远程 D1 迁移与仓库推送**：`nav-db` 远程已创建 `icon_library` 表，全部代码已提交并推送到 `origin/main`（`8971bd3`）。

---

## 六、已知坑与注意事项

| 坑 | 原因 / 现象 | 对策 / 现状 |
|---|---|---|
| Worker 必须预编译 | Wrangler 直接部署未编译 TS 易出 1101 | `wrangler.toml` 已配置 `[build] command = "npm run build"` |
| 壁纸下卡片消失 | Chromium 下 `backdrop-filter` + `html` 背景图合成 bug | `html.has-wallpaper` 下自动切换近实色并关 `backdrop-filter` |
| 日流量统计不能硬编码 60s | 采集间隔可变（60s / 120s） | `/api/history` 使用窗口函数 `LEAD/LAG(ts)` 动态推算间隔并 clamp `1..600s` |
| 图标库已全走 D1 缓存 | 移除了 `frontend/src/lib/brand-icons.json` 与 `gen-brand-icons.mjs` | 前端通过 `iconLibrary.ts` 拉取 `/api/icons`；新增/重建内置种子用 `scripts/collect-icon-seed.mjs` |
| 工作区未追踪的 Craft Anything 临时目录 | `capture/`、`craft.json`、`feed.json`、`inbox/`、`investigation.cany/`、`usage.json` 为本机 Craft Anything Desktop 项目产物 | 仅留在本地工作区，**切勿提交进 Git** |
| `/api/favicon` 安全约束 | 后台抓取任意 URL 存在 SSRF 风险 | 强制管理员登录 + 拒绝内网/回环 IP 与非 HTTP(S) 协议 |

---

## 七、当前待办与下一步（Next Steps）

### P0（上线验证与现场收尾）
- [x] **确认最新代码已部署至线上 Worker**：已通过 `wrangler deployments list` 确认 Workers Builds 在 `8971bd3` 推送后于 `2026-11-28 10:35:44 (+08:00)` 自动部署生产版本 `2eef0806-8f33-41fb-8324-ba842ed7b392`（100% 流量）；`GET https://nav.403333.xyz/` 返回 `200 OK`。
- [x] **验证远程 D1 `icon_library` 首访自动建种**：已请求 `GET https://nav.403333.xyz/api/icons` 返回 `200`（`storage: "d1", total: 76`），并通过远程 `nav-db` SQL 查询确认 `icon_library` 表已自动写入 `76` 条内置图标。
- [x] **验证采集器新版认证与线上推送**：远程 D1 `users` 表已就绪（1 个管理员账号），`latest` 表 `source = "router"` 于 `2026-11-28 16:59:58` 持续推送正常，`主路由` 与 `OpenClash` 指标在线。
- [ ] **排查 NAS SSH 回采与 6 项内网服务探活失败**（需在路由器 / NAS 现场操作）：实测 `latest` 快照中目前缺少 `nas` 设备指标，且 `飞牛 fnOS`、`iStoreOS`、`Jellyfin`、`qBittorrent`、`Alist`、`Vaultwarden` 共 6 项持续处于 `service_down`（外部 `哔哩哔哩` 探活正常 28ms）。需在路由器 LuCI / SSH 检查 `nav.nas.enabled`、`/etc/init.d/nav keygen` 公钥授权以及 NAS 本体开机/内网连通性与端口配置。

### P1（待推进需求）
- [ ] **复刻 WeTab 右键「编辑图标」功能**：在导航卡片与文件夹子项右键菜单增加「编辑图标」入口，完整复刻 WeTab 图标编辑器交互与视觉。
  - *历史阻塞记录*：此前尝试通过 `craft-anything` MCP 的 `web_site_open` 实时抓拍 `https://web.wetab.link/` 遭遇 `consent_required`（MCP 会话 `project: null` 且客户端无交互授权弹窗）。后续可直接对公开前端资源拆解或由用户提供 WeTab「编辑图标」弹窗截图后直接 1:1 实现。
- [ ] **将「本地只读现场探测」接入采集器，消除 AI 诊断的猜测性结论**：
  - 现状痛点：目前 `worker/ai.ts` 仅凭聚合指标与截断的 3000 行日志做诊断，缺少路由器现场证据（如 `127.0.0.1:7874` 监听进程、Clash API `/proxies` 各节点延迟表、本机 DNS 解析与 TCP 443 直连耗时、`free -m`/Top 进程、NAS 局域网 ARP/ICMP/22 端口连通性），导致 AI 只能给出“可能/疑似”。
  - 建议方案：采用**“端侧按需采现场快照 + 云端 AI 诊断”**——在 `/api/collector-config` 与 `/api/ingest` 协议中增加结构化只读字段 `diagnostics`（平时 1 分钟轻量采样不带，触发告警或用户手动请求深度诊断时附带），保持“采集器只出不进 + 密钥不下放路由器 + 继续白嫖 Cloudflare Workers AI”。

### P2（可选优化）
- [ ] **开启 GitHub Dependabot**：新增 `.github/dependabot.yml`（将 `@tiptap/*` 分组合并更新）。
- [ ] **Microsoft To Do 多端同步**：配置 `MS_CLIENT_ID` / `MS_CLIENT_SECRET` 后在「设置 → 账户安全」完成授权切换。
- [ ] **fnOS 官方 API 跟进**：如飞牛开放 OAuth / 监控 REST 文档，评估替代 SSH `/proc` 回采。

---

## 八、常用开发命令

```bash
# 1. 本地全栈构建与启动
npm run build                          # 编译 Worker (worker/entry.bundle.js) + 前端 (frontend/dist)
npx wrangler dev --port 8788           # 本地 Worker + 静态资产 + 本地 D1/KV 模拟

# 2. 本地 / 远程 D1 操作
npx wrangler d1 execute nav-db --local --file=schema.sql
npx wrangler d1 execute nav-db --remote --file=migrations/0001_icon_library.sql

# 3. 发布与密钥
npx wrangler deploy                    # 编译并发布 Worker 与前端资源至 Cloudflare
node scripts/gen-secret.mjs '<密码>'    # 辅助生成密钥

# 4. 图标种子重新采集
node scripts/collect-icon-seed.mjs     # 更新 worker/iconSeed.json
```

---

## 九、数据流契约备忘（跨仓同步警告）

> **`/api/ingest` 字段契约由本仓库与 `ybjbox/openwrt-packages` 共同维护，修改任意字段务必两边同步**（可用 `node scripts/check-ingest-contract.mjs` 检查）。

- `POST /api/ingest`：采集器上报 `{ ts, source, devices[], services[], alerts[], resolved_alert_ids[], logs?: { openwrt[], openclash[], nas[] } }`
- `GET /api/latest`：最新设备快照、探活服务与当前告警
- `GET /api/history?device=<id>&range=24h|7d|30d`：历史采样曲线与日流量累计
- `GET /api/icons` / `POST|PUT|DELETE /api/icons` / `POST /api/icons/reset|migrate`：D1 自维护图标库
- `GET /api/favicon?url=<httpUrl>`：管理员站点 Favicon 抓取代理（返回 Base64 DataURL）
- `GET /api/ai/logs` / `GET /api/ai/models` / `GET /api/ai/usage` / `POST /api/ai/diagnose`：日志查看、模型/用量与流式诊断
