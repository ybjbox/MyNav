# NAV — 个人导航页 + 家内设备轻量监控

美观现代的个人导航页，**部署在 Cloudflare Workers（免费层，含 Cron 失联告警）**，自带防护；配合以 **OpenWrt 插件形式编进路由器固件的采集器**（唯一采集端，NAS 数据经 SSH 回采、NAS 零安装），实现路由器/NAS/OpenClash 的在线状态、系统异常告警、异常卡片高亮、当前流量与历史流量趋势。

**线上入口：https://nav.403333.xyz**（源码仓库 `ybjbox/MyNav` 私有；push 到 main 自动部署）

> 设计语言 "Aurora Glass"：深色玻璃拟态 + 极光绿强调色；动效克制（150–400ms，尊重 reduced-motion）。视觉规范见 `原型/NAV.html`。

```
┌───────────── Cloudflare（免费层，全球边缘） ─────────────┐
│ Worker：静态 SPA（assets）+ API + Cron（失联检测/清理）    │
│ D1 nav-db：时序采样/告警   KV nav-kv：站点配置/限速        │
└───────────────▲─────────────────────────────────────────┘
                │ HTTPS 出站推送（Bearer，60s 一次，断网缓冲重发）
┌───────────────┴── 路由器插件（唯一采集端，ipk 随固件编译） ─┐
│ /proc 本机指标 + 本地 ubus（FanchmWrt：连接数/联网/版本）   │
│ localhost Clash API → OpenClash 状态/连接数/代理速率       │
│ SSH 回采 NAS /proc（NAS 零安装，受限只读账号）             │
│ TCP 探活导航卡片  │ 阈值告警 → 页面/Bark/TG/Webhook        │
└──────────────────────────────────────────────────────────┘
```

## 目录结构
```
frontend/   React SPA（导航/监控/告警/管理模式）
worker/     Worker 入口 + API 处理器 + Cron（esbuild 预转译 entry.bundle.js）
docs/       DEPLOY / CONFIG / SECURITY / PLUGIN
原型/       设计原型（设计 token 基准）
```
> **采集器代码不在本仓库**：Go 采集器 + OpenWrt 插件 + LuCI 配置页的统一真源在
> `ybjbox/openwrt-packages` 的 `nav-collector/`（详见 `docs/PLUGIN.md`）。本仓库只管云端（前端 + Worker）。
> 采集器仅以 OpenWrt 插件形态部署在路由器上；NAS 指标由插件 SSH 回采（NAS 零安装），不提供 NAS Docker 形态。

## 快速开始
1. **日常部署**：push 到 `main` → Workers Builds Git 连接自动构建部署；首次搭建见 `docs/DEPLOY.md`（nav-db/nav-kv → schema → `npm run build:worker` → `wrangler deploy` → secrets）
2. **采集器插件**：见 `ybjbox/openwrt-packages` 的 `nav-collector/README.md`——包随固件编译；刷机后在 LuCI 后台「服务 → NAV 采集器」或本地页 `:12900` 配置 push 地址与令牌
3. **本地开发**：`npx wrangler dev`（API + 资产 + D1/KV 本地模拟）+ `npm --prefix frontend run dev`（/api 代理）
4. **手动失联检测**：登录后 `POST /api/stale-check`（与 Cron 相同逻辑）

## 安全要点
家庭侧零暴露：不开端口、不做转发；采集器容器只读挂载 + 降权 + 仅出站；监控数据一律登录可见。详见 `docs/SECURITY.md`。

## 已知边界
- HTTPS 静态页无法直连局域网（混合内容拦截），因此监控数据必须由采集器上云推送——这是架构选择的直接原因
- 免费层配额充裕（详见 DEPLOY.md 用量参考）；采集器断网最多缓冲 60 个快照
