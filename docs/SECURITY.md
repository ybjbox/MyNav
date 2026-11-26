# NAV 安全边界

## 设计目标
一切对外服务在 Cloudflare 边缘；家庭网络**零暴露**（不开端口、不做 DDNS/端口转发）。本地唯一组件是采集器，**仅出站 HTTPS**，不监听任何端口。

## 各层措施

### Cloudflare 边缘
- 全站 HTTPS + HSTS；DDoS 防护由 CF 兜底；无源站可回源探测
- `_middleware.ts` 统一注入 CSP（`default-src 'self'`，脚本仅 self，无第三方）、X-Frame-Options DENY、nosniff、Referrer-Policy
- 建议在 CF 控制台加 WAF 速率限制：`/api/login`、`/api/ingest` 各 30 次/分钟

### 鉴权与数据
- 三方主体：**匿名**（`privacy.publicNav` 决定可见导航或全站登录墙）、**admin**（密码 → PBKDF2 校验 → HS256 JWT，HttpOnly+Secure+SameSite=Lax，7 天）、**collector**（独立 Bearer token）
- 数据面全部鉴权：`/api/latest` `/api/history` `/api/alerts` `/api/config PUT` 需登录；`/api/ingest` `/api/collector-config` 需令牌；**监控数据（含内网探活目标 `check.host/port`）与全部密钥绝不匿名可读**
- `GET /api/config` 在 `publicNav=true` 时返回白名单投影：仅含展示导航所必需的 site 字段、卡片 `url/name/icon/desc`、搜索与组件布局；`check` 探活目标（内网拓扑）、`monitor` 整段（告警密钥）、天气 Key 均已剔除。注意：导航卡片自身的 `url` 属公开导航内容，对匿名访客可见（这是公开导航的产品语义）；如需连卡片 URL 都不外露，请设 `privacy.publicNav=false` 启用全站登录墙。
- 登录与改密码接口有 KV 计数限速（15 分钟 8 次）
- 密码：PBKDF2-SHA256（10 万次迭代 + 16 字节盐），存环境变量或 KV；改密码后立即生效
- 采集器令牌可在 CF 侧随时轮换，NAS 侧仅持有该出站令牌——即使 NAS 被攻破，泄露面也只是一个可吊销的凭据

### 采集器（NAS 上）
- 容器 `read_only` + `no-new-privileges` + `cap_drop ALL`；宿主 `/proc`、`/sys`、数据卷全部**只读**挂载
- 不监听端口、无 ports 映射；出站仅访问你的 Pages 域名
- **FanchmWrt ubus RPC 通道**：NAS 侧 config 保存路由器账号密码（仅内网可读文件）；路由器上不落地任何密钥。RPC 仅用于只读业务接口（get_dashboard_common / get_oaf_status），不调用任何 set_*/delete_* 写接口
- 路由器 SSH 通道加固（OpenWrt/iStoreOS，使用 type: ssh 时）：
  1. 生成专用密钥对，公钥写入路由器 `authorized_keys`
  2. 用 forced command 限制命令前缀（只读 /proc 与 /sys）：
     ```
     command="sh -c 'cat /proc/net/dev; cat /proc/loadavg; cat /proc/uptime; head -1 /proc/stat; cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null'",no-port-forwarding,no-x11-forwarding,no-agent-forwarding ssh-ed25519 AAAA...
     ```
  3. 或创建只读用户替代 root
- OpenClash Clash API：secret 存 NAS 侧 config；建议 OpenClash「外部控制」仅监听 LAN（默认行为），不要暴露到 WAN
- 内网固定设备的 SSH 通道默认跳过主机指纹校验（`InsecureIgnoreHostKey`）；如需严格校验可自行加 known_hosts

### 监控数据保留
- D1：原始采样 31 天（每天机会式清理，替代独立 cron）；告警历史已恢复项同样保留 31 天
- 所有数据表均为个人设备指标，无第三方上报、无埋点

## 威胁模型速查
| 场景 | 后果 |
|---|---|
| 站点被扫描 | 只有登录墙/导航卡片；监控接口一律 401 |
| COLLECTOR_TOKEN 泄露 | 只能伪造"你自己设备的"监控数据；轮换令牌即失效 |
| NAS 被攻破 | 攻击者拿到出站令牌与只读挂载；家庭入口无暴露 |
| 管理密码泄露 | JWT 7 天有效；改密码 + （可选）轮换 JWT_SECRET 使全部会话失效 |
