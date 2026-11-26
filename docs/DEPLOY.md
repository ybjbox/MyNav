# NAV 部署指南

整体分两部分：**Cloudflare Worker（导航页 + API + Cron）** 与 **路由器插件（唯一采集端）**。
当前线上实例：`https://nav.403333.xyz`（资源：D1 `nav-db`、KV `nav-kv`，Worker 名 `nav`）。

## 〇、CI/CD（日常部署方式）：Workers Builds Git 连接

源码仓库：`ybjbox/nav`（**私有**）。Cloudflare **Workers Builds** 连接该仓库后，push 到 `main` 自动：构建（esbuild Worker + 前端）→ `wrangler deploy`（约 1-2 分钟）。连接步骤与注意事项见下文「Git 连接部署」。改站点配置（卡片/主题/告警渠道）不需要部署——网页设置直接写 KV。

### Git 连接部署（Workers Builds）
1. Dash → **Workers & Pages** → Create → **Workers** → **Connect to Git** → 授权 GitHub App（选择 `ybjbox/nav` 私有仓库）
2. 构建设置：
   - Production branch：`main`
   - **Build command**：`npm ci && npm run build:worker && npm ci --prefix frontend && npm --prefix frontend run build`
   - **Deploy command**：`npx wrangler deploy`（默认）
3. 首次部署完成 → Worker `nav` 重建，`wrangler.toml` 里的自定义域名 `nav.403333.xyz` 与两个 Cron 自动恢复
4. ⚠️ 删除 Worker 会连带删除 **Secrets 与自定义域名**（D1/KV 数据保留）：重建后需补回三个 Secret（JWT_SECRET / COLLECTOR_TOKEN / ADMIN_PASSWORD_HASH），否则 API 全部 500

### 手动部署（本地）
```bash
cd navpage
npm ci && npm run build:worker          # Worker 预转译
npm ci --prefix frontend && npm --prefix frontend run build   # 前端
CLOUDFLARE_API_TOKEN=<令牌> npx wrangler deploy
```
回滚：Dash → nav → Deployments → 选择历史版本 → Rollback。

### 密钥补回（重建 Worker 后）
```bash
node scripts/gen-secret.mjs '<管理密码>'        # 生成三件套
printf %s '<JWT_SECRET>'      | npx wrangler secret put JWT_SECRET
printf %s '<COLLECTOR_TOKEN>' | npx wrangler secret put COLLECTOR_TOKEN
printf %s '<ADMIN_PASSWORD_HASH>' | npx wrangler secret put ADMIN_PASSWORD_HASH
```

## 一、Cloudflare Worker（免费层）

### 1. 创建资源
```bash
cd navpage
export CLOUDFLARE_API_TOKEN=<你的令牌>   # 需 Workers Scripts/KV/D1 编辑权限
npx wrangler d1 create nav-db
npx wrangler kv namespace create nav-kv
# 把输出的 database_id / id 填入 wrangler.toml
```

### 2. 初始化数据库
```bash
npx wrangler d1 execute nav-db --remote --file=schema.sql
```

### 3. 构建与部署
```bash
npm --prefix frontend run build
npm run build:worker        # esbuild 预转译 worker/entry.ts → worker/entry.bundle.js
npx wrangler deploy         # 输出 https://nav.<子域>.workers.dev 与两个 cron
```

### 4. 密钥（部署成功后注入）
```bash
node scripts/gen-secret.mjs '<管理密码>'   # 输出 JWT_SECRET / COLLECTOR_TOKEN / ADMIN_PASSWORD_HASH
printf %s '<JWT_SECRET>'        | npx wrangler secret put JWT_SECRET
printf %s '<COLLECTOR_TOKEN>'   | npx wrangler secret put COLLECTOR_TOKEN
printf %s '<ADMIN_PASSWORD_HASH>' | npx wrangler secret put ADMIN_PASSWORD_HASH
```
> 注意顺序：先 deploy（Worker 存在）再 secret put。本地开发变量放 `.dev.vars`（不入库）。

### 5. Cron 任务（Workers 特有）
- `*/5 * * * *`：失联检测——任一采集器 source 停止推送超 10 分钟 → 按"设置→监控→失联告警"里配置的 Bark/TG/Webhook 直接推送（路由器整机断电也能告到），恢复时推"已恢复"
- `40 4 * * *`：清理 31 天前的采样与已恢复告警
- 手动触发一次检测：登录后 `POST /api/stale-check`

### 6. 运维
| 操作 | 命令 |
|---|---|
| 看实时日志 | `npx wrangler tail` |
| 重放 schema | `npx wrangler d1 execute nav-db --remote --file=schema.sql` |
| 轮换采集器令牌 | `wrangler secret put COLLECTOR_TOKEN` + 更新插件 UCI |
| 旧库迁移 | `latest` 表重建见 schema.sql 注释；`samples` 补列 `ALTER TABLE samples ADD COLUMN conn REAL;` |

## 二、路由器插件（唯一采集端）
见 `docs/PLUGIN.md`：插件随固件 GitHub 编译（方式 A）或独立 ipk（方式 B）；NAS 指标由插件 SSH 回采（NAS 零安装，受限只读账号）。builder 集成说明见 `delivery/INTEGRATION.md`。
采集器仅以 OpenWrt 插件形态部署，无 NAS Docker 形态（如需以后再适配）。

## 三、上线检查清单
- [ ] `schema.sql` 已在远端 D1 执行
- [ ] `JWT_SECRET` / `COLLECTOR_TOKEN` / `ADMIN_PASSWORD_HASH` 三个 secret 已设置且与 wrangler.toml 的开发值不同
- [ ] Cloudflare WAF 速率限制规则：对 `/api/login` 与 `/api/ingest` 各限 30 次/分钟（可选但推荐）
- [ ] 采集器 `docker logs` 无持续报错，页面监控区有数据
- [ ] 页面设置里确认"未登录访客可看导航卡片"开关符合预期

## 四、常用运维
| 操作 | 命令 |
|---|---|
| 看实时日志 | `npx wrangler pages deployment tail` |
| 重放 schema | `npx wrangler d1 execute nav --remote --file=schema.sql` |
| 轮换采集器令牌 | 改 secret 后重启采集器容器 |
| 数据清理 | 自动（每天一次，保留 31 天采样） |

## 免费层用量参考
- Functions：采集器 1440 次/天 + 页面轮询/浏览 ≈ 数千次/天（上限 10 万/天）
- D1 写：约 3,000 行/天（上限 10 万/天）；存储 31 天 ≈ 数 MB（上限 5GB）
- KV 写：仅配置保存与登录限速（上限 1,000/天，余量充足）
