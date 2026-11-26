# NAV 交接文档

> 本文档面向接手 NAV 项目后续开发的开发者或 AI 工具。读完即可无上下文继续开发。
> 最后更新：2026-11-21

---

## 一、项目是什么

NAV 是一个**个人导航页 + 路由器/NAS 轻量监控**系统，部署在 Cloudflare Workers（免费层），配合一个编译进路由器固件的 Go 采集器插件（唯一采集端，仅出站 HTTPS），实现：

- 导航卡片分组管理（拖拽排序/文件夹聚合/搜索/右键菜单）
- 路由器（FanchmWrt/OpenWrt）+ NAS（飞牛 fnOS）+ OpenClash 的在线状态、系统异常告警、异常卡片高亮、当前流量、历史流量趋势（24h/7d/30d）
- 告警推送：页面高亮 + 浏览器通知 + Bark + Telegram + 通用 Webhook
- 云端 Cron 失联检测（采集器停止推送超 10 分钟主动通知）

**线上入口**：https://nav.403333.xyz（自定义域名，区域 403333.xyz 在 CF 账户上）
**源码仓库**：`ybjbox/MyNav`（**私有**）
**设计风格**："Aurora Glass"——深色底 + 白玻璃卡 + 彩色应用图标块（按名称取色渐变）+ 极光绿强调色 #43e0a0；动效克制（150–400ms，尊重 prefers-reduced-motion）

## 二、架构与数据流

```
┌───────────── Cloudflare（免费层） ─────────────────────────┐
│ Worker `nav`：                                             │
│   assets = frontend/dist（React SPA）                      │
│   fetch = API 路由（worker/handlers.ts）                    │
│   scheduled = Cron（失联检测 */5 + 清理 40 4）              │
│ D1 `nav-db`：samples / alerts / latest（按 source 分桶）    │
│ KV `nav-kv`：站点配置(config) / 登录限速 / 密码哈希          │
└───────────────▲───────────────────────────────────────────┘
                │ HTTPS 出站推送（Bearer，60s，断网缓冲 60 条）
┌───────────────┴── 路由器插件 nav-collector（唯一采集端） ──┐
│ /proc 本机 + 本地 ubus(fwx) + localhost Clash API          │
│ SSH 回采 NAS /proc（NAS 零安装）                            │
│ TCP 探活导航卡片  │ 阈值告警 → Bark/TG/Webhook              │
└──────────────────────────────────────────────────────────┘
```

**核心架构决策**（不可轻易推翻，均有已验证的原因）：

1. **路由器插件是唯一采集端**：用户否决了双采集器方案（NAS+路由器各跑一个），要求减少部署难度。NAS 数据由插件 SSH 回采（NAS 零安装）。
2. **有壁纸时禁用 backdrop-filter**：Chromium 下 backdrop-filter 与 html/body 背景图组合会使玻璃元素整体不可见（内容消失但 DOM 正常）。解法：有壁纸时玻璃改近实色（`html.has-wallpaper` 覆盖 --surface 为 0.88 alpha 深色）并 `backdrop-filter: none`。
3. **不用全屏 fixed 渐变层**：该渲染模式下会出现吞层/全黑的合成 bug。壁纸用 `html` 元素 background 承载，遮罩渐变用 `body` 背景（`body.has-wallpaper-scrim`），两层级联，不用伪元素或独立 div。
4. **wrangler 4.166 不转译 TS**：必须 esbuild 预转译（`npm run build:worker` → `worker/entry.bundle.js`），wrangler.toml `main = "worker/entry.bundle.js"`。直接 `main = "worker/entry.ts"` 会上传未转译 TS，线上全请求 1101。
5. **家庭侧零暴露**：插件不监听端口（本地配置页 :12900 仅 LAN）；不开路由器端口；NAS 零安装。

## 三、仓库与资源

### Cloudflare 资源（账户 Ryan 442d71e0643878f28a8b34a027a780e1）
| 资源 | 名称/ID |
|---|---|
| Worker | `nav` |
| D1 | `nav-db`（44d13cf8-6e5a-4705-b72d-5530708adf0c） |
| KV | `nav-kv`（42e3f7f630c049f29a633f08f0d14e73） |
| 自定义域名 | `nav.403333.xyz`（区域 403333.xyz，zone_id de9d1bfb…） |
| workers.dev 子域 | `xy-drive`（已被 custom domain 自动禁用） |

### GitHub 仓库
| 仓库 | 用途 |
|---|---|
| `ybjbox/nav`（私有） | 项目源码 + Workers Builds CI |
| `ybjbox/openwrt-packages` | **采集器唯一真源**：`nav-collector/`（Go 源码 + OpenWrt 包 + LuCI + ipk.yml）；已迁出 nav 仓库 |
| `ybjbox/fanchmwrt-athena-builder` | 固件编译仓库，features.md 已加行（commit f382e0f）+ golden 基线（8c3b95c） |

### 密钥（Cloudflare → nav → Settings → Variables and Secrets）
| 名称 | 说明 | 当前值来源 |
|---|---|---|
| JWT_SECRET | HS256 签名 | `scripts/gen-secret.mjs` 生成（已注入） |
| COLLECTOR_TOKEN | 采集器推送令牌 | 原调试值已从本文档清除；**但 CF 侧旧值仍有效，须按下述步骤实际轮换后才能使其失效** |
| ADMIN_PASSWORD_HASH | PBKDF2 哈希 | 原明文密码已从本文档清除；**但 CF 侧旧哈希仍有效，须按下述步骤实际轮换后才能使其失效** |

> **凭据轮换（2026-11-22 接手评估 P0）**：以上三项凭据曾以明文写入本文档并被 git 跟踪，已就地清除。
> 由于 git 历史中仍保留旧值，必须在 Cloudflare 侧实际轮换使其失效（清理文档 ≠ 轮换）：
> ```bash
> node scripts/gen-secret.mjs '<你新设定的管理密码>'   # 生成三项新值
> npx wrangler secret put JWT_SECRET
> npx wrangler secret put COLLECTOR_TOKEN
> npx wrangler secret put ADMIN_PASSWORD_HASH
> ```
> 轮换后同步更新路由器 `uci set nav.main.push_token`，天气 Key 若从 KV 迁移则另设 `QWEATHER_KEY`/`QWEATHER_HOST` Secret。
> **切勿把新值再写回任何被 git 跟踪的文件。**

### 路由器调试
SSH 私钥：`navpage/debug-keys/router_debug_ed25519`
公钥：`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIPz52wb3AjdxdlS5Tu22wF6/Tqoa0PVTXnmV4Rqxalm auroranav-debug-20261121`

## 四、目录结构与关键文件

```
navpage/
├── frontend/               # React 18 + Vite + TS + 纯 CSS（无 Tailwind）
│   src/
│   ├── App.tsx             # 组合根：DnD 上下文 + 管理模式 + 路由
│   ├── state/store.tsx     # 全局状态（config/session/snapshot/toasts）
│   ├── types.ts            # 前后端共享类型
│   ├── lib/
│   │   ├── defaultConfig.ts  # 默认配置 + newId/cloneConfig
│   │   ├── storage.ts        # localStorage（常访/搜索历史/天气缓存）
│   │   ├── wallpapers.ts     # 壁纸预设 + hueFor/iconGradient + wallpaperImage
│   │   └── format.ts         # 格式化
│   ├── components/           # UI 组件（每个文件一个职责）
│   │   ├── ServiceCard.tsx   # 卡片（普通/文件夹两形态 + 彩色图标块）
│   │   ├── Monitor.tsx       # 设备监控卡（Tremor KPI：进度条+大数字速率/sparkline）
│   ├── widgets/             # 组件区（P1 widget 框架）
│   │   ├── registry.tsx     # 注册表：类型 → manifest（名称/描述/默认跨列/组件）
│   │   ├── WidgetsSection.tsx # bento 网格 + dnd 排序 + 管理模式增删/跨列
│   │   └── WidgetTodo.tsx   # 待办 widget（localStorage）
│   │   ├── Hero.tsx          # 时钟 + 搜索（历史下拉/多引擎/样式可选）
│   │   ├── TopBar.tsx        # 顶栏（吸顶毛玻璃）
│   │   ├── SideRail.tsx      # 左侧分类栏（分组映射/滚动定位；移动端改顶部横条）
│   │   ├── SettingsDrawer.tsx # 设置抽屉（外观/监控/数据/账户四 tab）
│   │   ├── AlertsDrawer.tsx  # 告警抽屉
│   │   ├── TrendModal.tsx    # 趋势弹层（自绘 SVG 图表）
│   │   ├── EditServiceModal.tsx # 卡片/文件夹编辑（含图标上传裁剪）
│   │   ├── IconCropModal.tsx # 画布裁剪器
│   │   ├── ContextMenu.tsx   # 右键菜单
│   │   ├── FrequentBar.tsx   # 常访栏
│   │   ├── WeatherWidget.tsx # 天气卡片（同源 API + 骨架屏）
│   │   ├── WeatherIcon.tsx   # Meteocons 图标（WMO→图标名映射，昼夜区分）
│   │   ├── IconBlock.tsx     # WeTab 式品牌图标块（brands.ts 三通道匹配）
│   │   └── icons.tsx         # 手绘单线 SVG 图标集（无第三方库）
│   └── styles/
│       ├── tokens.css        # 设计 token（色彩/字体/形状/动效/阴影）
│       └── app.css           # 全部应用样式（约 600 行）
├── worker/                 # Cloudflare Worker（已 esbuild 预转译）
│   ├── entry.ts            # fetch + scheduled 入口
│   ├── handlers.ts         # API 处理器集合
│   ├── scheduled.ts        # Cron（失联告警 + 每日清理）
│   ├── _shared.ts          # 共享工具（JWT/PBKDF2/限速/响应）
│   └── _types.d.ts         # Workers 运行时类型最小子集
│   # 采集器代码已迁出本仓库 → ybjbox/openwrt-packages 的 nav-collector/
│   # （Go 源码 src/ + OpenWrt 包 + LuCI 配置页三文件 + ipk.yml）
│   # 采集器仅以 OpenWrt 插件形态部署；无 NAS Docker 形态（如需以后再适配）
├── docs/                   # DEPLOY / CONFIG / SECURITY / PLUGIN / SUPPORT-TICKET
├── scripts/gen-secret.mjs  # 密钥生成器
├── schema.sql              # D1 schema
├── wrangler.toml           # Workers 配置（assets/D1/KV/cron/routes）
└── HANDOFF.md              # 本文档
```

## 五、已完成功能（全部有截图/代码验证）

### 导航核心
- [x] 分组卡片网格（拖拽排序 dnd-kit、跨组拖入、文件夹拖入）
- [x] 卡片右键菜单（打开/复制链接/编辑/删除）
- [x] 文件夹聚合（拖卡片到文件夹卡即移入；文件夹卡 2×2 彩色缩略；弹层网格）
- [x] 搜索（本地过滤 + 多引擎 bang；`/` 快捷键聚焦）
- [x] 搜索历史（下拉 15 条，单条删/清空）
- [x] 搜索框样式（标准/紧凑/隐藏三档）
- [x] 常访栏（本机点击计数，≥3 张卡自动出现，按次数排序前 8）

### 监控
- [x] 设备卡（路由器/NAS）：CPU/内存/磁盘环形仪表、WAN/NIC 速率、温度、sparkline、版本标签
- [x] OpenClash 状态卡（核心版本/连接数/代理速率）
- [x] 趋势弹层（24h/7d/30d 面积图 + 日累计 + hover crosshair）
- [x] 阈值告警引擎 + 页面高亮 + Bark/Telegram/Webhook
- [x] 云端 Cron 失联检测（source 粒度，10 分钟阈值）

### 个性化
- [x] 主题（深/浅/跟随系统）
- [x] 强调色（6 色可选 + 自定义 hex）
- [x] 壁纸（4 渐变预设 + 自定义 URL + 自动暗色遮罩）
- [x] 图标（内置 lucide 子集 + 自定义 URL + 上传裁剪器 96×96）
- [x] 图标尺寸（紧凑/标准/大）+ 圆角
- [x] 搜索框样式（标准/紧凑/隐藏）
- [x] 天气卡片（Worker 代理：和风优先 + Open-Meteo 兜底；Meteocons 精致图标；城市名配置）
- [x] 左侧分类栏（WeTab 式布局：分组映射为分类、点击滚动定位、滚动反向高亮；桌面竖排 / 移动端顶部横条不遮挡）

### 安全
- [x] JWT（HS256，HttpOnly+Secure+SameSite=Lax，7 天）
- [x] PBKDF2 密码哈希（10 万迭代 + 16 字节盐）
- [x] 登录限速（KV 计数，15 分钟 8 次）
- [x] CSP/HSTS/X-Frame-Options/nosniff（_middleware 或 fetch 统一注入）
- [x] 采集器 Bearer token（可随时轮换）
- [x] 采集器容器 read_only + no-new-privileges + cap_drop ALL
- [x] SSH 回采用受限账号 + forced command

## 六、已知坑（全部踩过并修复，不可重蹈）

| 坑 | 原因 | 解法（已内置） |
|---|---|---|
| 部署后全请求 1101 | wrangler 4.166 对带 assets 的 TS worker 不转译 | esbuild 预转译（build:worker） |
| 远端配置覆盖本地阈值为 0 | 云端旧配置缺新增字段 | 只覆盖 >0 的值 |
| 壁纸模式卡片不可见 | backdrop-filter + html 背景图（Chromium bug） | has-wallpaper 时禁用 backdrop-filter + 玻璃近实色 |
| color-mix() 遮罩层吞掉后续层级 | 渲染器合成 bug | 遮罩用普通 rgba |
| 保存后"未保存更改"永不消隐 | 保存后 draft 版本号与 config 不一致 | 保存后 setDraft(null) 由 effect 重建 |
| 前端 App.tsx 忘了传 statusOf | 重构后 prop 断链 | grep childStatuses 确认清零 |
| wrangler dev 僵尸实例抢端口 | Windows 多次重启残留 | taskkill 全清（netstat 找 PID） |
| npx 缓存丢 workerd 二进制 | npx install-scripts 被 npm 11 阻断 | 项目内 `npm install -D wrangler` |
| secret put 报"Worker 不存在" | secret put 需要 Worker 先存在 | 先 deploy 再 put |
| Go 首次 mod download 超 3 分钟 | 网络代理延迟 | 耐心等待，勿中断 |
| 采集器 --once 推送失败(500) | 本地 D1 缺列/schema 未跑 | 重放 schema.sql |
| 日流量按 60s 硬编码算错（沉默错误） | 采集器 interval 可配 60/120s，云端拿不到该值；原 `SUM(rx_bps)*60` 在 120s 下少算一半，图表照常显示 | `/api/history` 用窗口函数 `LEAD/LAG(ts)` 推算每个样本的真实间隔，末尾用前间隔、孤点回退 60，clamp 1..600s；rx/tx 一次查出。**勿改回硬编码 60** |
| `/api/weather` 匿名无限速可刷爆三方配额 | 天气接口公开可访问，无鉴权无限速；每次 miss 打 Open-Meteo/和风并写 KV，恶意刷量浪费免费额度 | `entry.ts` 路由层加 city 白名单校验（1–64 字符，中英文数字空格及 `,.'-`）+ 按 IP 限速 20 次/15 分钟（`rateLimited`）。前端有 localStorage 缓存，正常用户不触顶 |

## 七、待办事项（按优先级）

### P0（上线必需）
- [ ] **Cloudflare dash → nav → Settings → Build → Connect GitHub**：连接 `ybjbox/nav` 仓库
  - Production branch: `main`
  - Build command: `npm ci && npm run build:worker && npm ci --prefix frontend && npm --prefix frontend run build`
  - Deploy command: `npx wrangler deploy`
  - 连接后 push main 即自动部署（不需要 GH Actions）
- [ ] **路由器刷入新固件**（含 nav-collector 插件）+ UCI 配置 push_token
- [ ] **NAS SSH 回采验证**：keygen → authorized_keys → 确认 NAS 卡片出数

### P1（上线后第一周）
- [ ] 失联告警真实触发演练（停采集器 10 分钟 → 观察 Bark/TG）
- [ ] 注册和风天气（console.qweather.com）填专属 API Host + Key 后切换天气源（当前 Open-Meteo 兜底已可用）
- [ ] 轮换三项凭据（CF API 令牌 / COLLECTOR_TOKEN / 管理密码）
- [ ] 常访栏真实数据累积验证（点击多张卡后观察排序变化）

### P2（可选）
- [ ] ubus 探针（SSH 的备选，插件直跑路由器时可切 type: ubus）
- [ ] PWA Service Worker（当前仅 manifest）
- [ ] fnOS OAuth 探针（等飞牛官方文档开放；pyfnos Apache-2.0 可参考）
- [ ] 导航卡片 favicon 自动抓取（当前手动指定 icon）
- [ ] D1 读写优化（current --remote 延迟 ~200ms，可考虑 Smart Placement）

## 八、开发命令速查

```bash
# ---------- 前端 ----------
cd navpage
npm --prefix frontend run dev          # Vite dev server（5173，/api 代理 8788）
npm --prefix frontend run build        # 构建前端 → frontend/dist

# ---------- Worker ----------
npm run build:worker                   # esbuild 预转译 → worker/entry.bundle.js
npx wrangler dev --port 8788           # 本地全链路（D1/KV 本地模拟）
npx wrangler deploy                    # 部署（需 CLOUDFLARE_API_TOKEN）
npx wrangler d1 execute nav-db --remote --file=schema.sql

# ---------- 采集器（在 openwrt-packages 仓库，不在本仓库） ----------
git clone https://github.com/ybjbox/openwrt-packages.git ../openwrt-packages
cd ../openwrt-packages/nav-collector/src
go build ./...                         # 编译
go vet ./...                           # 静态检查
go build -o /tmp/collector.exe ./cmd/collector
/tmp/collector.exe -config <yaml> -once  # 干跑（输出快照 JSON + 推送一次）

# ---------- 密钥 ----------
node scripts/gen-secret.mjs '<管理密码>'  # 生成 JWT_SECRET/COLLECTOR_TOKEN/ADMIN_PASSWORD_HASH
```

## 九、设计决策记录（为什么这么做）

| 决策 | 原因 |
|---|---|
| 路由器插件是唯一采集端（否决双采集器） | 减少部署难度；NAS 数据 SSH 回采零安装 |
| CF 全托管（否决 NAS 部署对外服务） | 用户：安全第一，CF 自带防护比路由器/NAS 安全 |
| 前端不用 Tailwind | 设计 token 手写 CSS 更精准，防 AI 味（禁 indigo 默认色） |
| 图表自绘 SVG（不用 ECharts/Recharts） | 包体积控制（gzip 86KB）；渲染器兼容性 |
| 极光背景静态渐变（不用漂移动画） | 漂移动画在软件渲染/低端设备上拖垮合成器 |
| 图标手绘 SVG（不用 lucide-react） | 零第三方运行时依赖；1.7px 单线风格一致 |
| 卡片白玻璃（不是深色玻璃） | WeTab/Infinity 风：壁纸上白卡清晰 |
| 图标块品牌纯色（不是 hash 渐变） | WeTab 实测：品牌真实纯色底+白色品牌字（JD/淘式）；brands.ts 域名/名称双匹配 |
| 侧栏移动端改顶部横条（不照搬 WeTab 竖栏） | WeTab 390px 下竖栏悬浮遮挡卡片文字与热搜；本项目窄屏改 sticky 横条可滚动，宽屏给 `.app` 留左 padding，实测零遮挡 |
| 天气图标 Meteocons 离线子集（不用 API 加载） | api.iconify.design 国内不可达且违反 CSP connect-src 'self'；构建期抽取 16 个 -fill 图标进 bundle |
| 天气数据 Worker 代理（不浏览器直连） | Open-Meteo 国内直连不可达；和风优先 + OM 兜底，KV 缓存 30 分钟 |
| worker 预转译（不让 wrangler 处理 TS） | wrangler 4.166 bug（TS 不转译直接上传） |
| D1 latest 按 source 分桶 | 多源架构预留（路由器插件 + 未来可能的 NAS agent） |
| 秘钥不进 KV（进 Worker Secrets） | KV 有配置读取权限的代码不应看到密钥 |
| SSH 回采用 forced command | 限制 NAS 侧只能 cat /proc，最小权限 |

## 十、设计 token 速查（改 UI 前必读）

```css
:root {
  --bg: #0b0f14;            /* 近黑深蓝底（非纯黑） */
  --surface: rgba(255,255,255,.045);  /* 玻璃面 */
  --card-glass: rgba(255,255,255,.1); /* 卡片白玻璃（WeTab 风） */
  --fg: #e9eef3; --muted: #93a1af; --faint: #5f6d7a;
  --border: rgba(255,255,255,.08); --border-2: rgba(255,255,255,.16);
  --accent: #43e0a0;        /* 极光绿（唯一强调色，每屏 ≤2 处可见） */
  --success/--warn/--danger: 语义色
  --font-ui: system-ui + 中文栈; --font-num: ui-monospace;
  --speed-1: 150ms; --speed-2: 240ms; --speed-3: 400ms;
  --ease: cubic-bezier(.2,0,0,1);   /* Material 3 标准 */
}
```

**禁用清单**（防 AI 味）：
- ❌ Tailwind 默认 indigo（#6366f1 等）作强调色
- ❌ 紫→蓝双色渐变
- ❌ Emoji 作图标
- ❌ 圆角卡 + 彩色左边框（AI dashboard tile 形）
- ❌ 虚假数据不标注（演示数据须标"示例"）
- ✅ 动效只用 transform + opacity
- ✅ prefers-reduced-motion 全量剥离

## 十一、数据流契约（改 API 前必读）

> **跨仓库同步警告**：ingest JSON 的字段在**两个仓库各写一份**——本仓库 `worker/handlers.ts` 的 `let snap` 类型，
> 以及 `ybjbox/openwrt-packages` 的 `nav-collector/src/internal/metrics/metrics.go`。
> **改任一处字段，必须同步改另一处**，否则会出现"采集器发了数据但云端读不到（或读到空值）且不报错"的沉默错误。
> openwrt-packages 的 CI 已内置字段校验（`tests/test_ingest_contract.mjs`，配 `NAV_READ_TOKEN` 后做跨仓比对）。

### ingest 请求体（collector → POST /api/ingest）
```json
{
  "ts": 1795240903776,
  "source": "router",
  "devices": [{
    "id": "router", "name": "…", "kind": "router|nas|service|other",
    "status": "online|offline|degraded",
    "cpu": 23.5, "mem": 51.2, "load1": 1.35, "temp": 44, "uptime_s": 86400,
    "version": "FanchmWrt 26.05 · OAF 1.0.5",
    "connections": 412, "internet": true,
    "disks": [{ "mount": "/vol1", "used_pct": 91, "total_gb": 19000 }],
    "traffic": { "iface": "pppoe-wan", "rx_bps": 90596366, "tx_bps": 13212106 },
    "spark": [/* 最近 48 点下行速率 */]
  }],
  "services": [{ "name": "Jellyfin", "status": "online", "latency_ms": 42, "fails": 0 }],
  "alerts": [{ "id": "nas-disk-90", "device": "nas", "rule": "disk_usage", "severity": "critical", "message": "…", "first_seen": 1795240800000, "last_seen": 1795240800000 }],
  "resolved_alert_ids": ["cpu-router"],
  "logs": {
    "openwrt": ["最近脱敏 logread 行..."],
    "openclash": ["最近脱敏 OpenClash 运行日志行..."]
  }
}
```

### 前端读取
- `GET /api/latest` → `{ ts, source, devices[], services[], alerts[], sources[{id,updated_at,stale}] }`
- `GET /api/history?device=router&range=24h|7d|30d` → `{ points[{ts,rx_avg,rx_max,tx_avg,tx_max,conn_avg}], daily[{day,rx_gb,tx_gb}] }`
- `GET /api/alerts` → `{ alerts[] }`（近 100 条）
- `GET /api/collector-config`（token）→ `{ config_version, checks[{name,host,port}], thresholds }`
- `PUT /api/config`（admin）→ 保存站点配置到 KV
- `GET /api/config`（公开时返回**白名单投影**：仅 site 展示字段 + 剔除 check 的 groups + 清洗后的 weather；monitor 整段与所有密钥字段不下发。天气 Key 优先走 Worker Secret `QWEATHER_KEY`/`QWEATHER_HOST`，未设置才回退 KV）

## 十二、原始需求上下文（用户逐轮反馈）

1. 调研导航页项目 → 用户选择了自研方向
2. 前端要求"现代且高级"→ 设计走 Aurora Glass + 防 AI 味规则
3. 部署要求 Cloudflare（用户："比部署在路由器或本机 NAS 上更加安全"）
4. 插件方案确认（用户："减少 NAS 与路由器之间的网络交换；路由器 24h 开机"）
5. fnOS 数据获取（用户："去官方找一下有没有别的更好的方式"）→ 官方 Skill OAuth 不可复刻 → SSH 回采
6. 改 Workers（用户："改用 Worker 部署"）
7. 域名绑定 403333.xyz（用户删除了冲突的路由器 A 记录）
8. 项目定名 NAV（用户确认，三字母以内）
9. WeTab/Infinity 学习（用户："交互、动效和 UI 都要现代且高级，这是一定的"）→ 8 项功能 + 彩色图标块
10. 不再需要 GitHub Actions 自动部署（用户："改用 Workers Builds Git 连接"）
11. 二次 WeTab 研究（用户："分析 web.wetab.link，筛可借鉴功能与设计"）→ 分析报告（定位/IA/功能/交互/视觉/移动端/优缺点/三类借鉴建议）；证据截图在 `E:/Nav/_wetab_*.png`
12. 采集器代码迁出本仓库（用户："nav 只该存前端/采集器放 openwrt-packages"）→ 唯一真源在 `ybjbox/openwrt-packages/nav-collector/`；NAS Docker 形态不保留
13. ingest 契约跨仓校验（用户选 CI 自动校验）→ openwrt-packages 的 `tests/test_ingest_contract.mjs` + `NAV_READ_TOKEN` secret（已验证跨仓 job PASS）
14. 日流量公式硬编码 60s 修复 + 天气接口加参数校验与限速（均为沉默错误/安全风险）
15. WeTab UI 布局落地（用户："只搬 UI 布局与交互，图标先不换，改现有前端"）→ 新增 SideRail；移动端改顶部横条避开 WeTab 遮挡坑；彩色 App 图标与商业壁纸一概未搬（版权+外链风险）

## 十三、后续待开发选项（Backlog）

- [ ] **开启 GitHub Dependabot 自动发更新 PR**：新增 `.github/dependabot.yml` 监听 `frontend` 与根目录 `npm` 依赖更新（尤其是将 `@tiptap/*` 配置为同组 `groups` 一起提 PR，保持版本号一致），合并前配合构建检查即可实现无痛升级。
- [ ] **启用 Microsoft To Do 多端同步**：前后端 OAuth2 与代理接口（`worker/mstodo.ts`）已就绪；后续在获得 Entra 应用注册凭据后，配置 `MS_CLIENT_ID` / `MS_CLIENT_SECRET` 并在「设置 → 账户安全」完成授权即可由当前 Cloudflare KV 云端待办无缝切换为微软 To Do 同步。
- [ ] **采集器 `nav-collector`（`ybjbox/openwrt-packages`）上报脱敏日志**：在 `POST /api/ingest` 请求体中追加可选字段 `logs: { openwrt: string[], openclash: string[] }`（建议每次取最后 60~100 行报错/警告日志），即可配合 MyNav「AI 日志诊断」实现全自动一键分析。
