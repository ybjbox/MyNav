# NAV 配置说明

## 配置分三处，职责不同

| 位置 | 内容 | 修改方式 |
|---|---|---|
| **站点配置**（KV `config`） | 分组/卡片/搜索引擎/主题/壁纸/阈值/隐私开关 | 页面设置抽屉与管理模式，或导入导出 JSON |
| **采集器配置**（`config.yaml`） | 推送地址与令牌、本机挂载、路由器 SSH、通知渠道 | NAS 上编辑后重启容器 |
| **环境变量**（Cloudflare secrets） | `JWT_SECRET`、`COLLECTOR_TOKEN`、`ADMIN_PASSWORD_HASH` | `wrangler pages secret put` |

单一事实来源：导航卡片上勾选的"在线检测"目标会通过 `/api/collector-config` 下发给采集器（每 10 分钟刷新），无需两处维护。

## 站点配置字段
```jsonc
{
  "version": 3,
  "site": {
    "title": "NAV",        // 站点名
    "theme": "dark",             // dark | light | auto
    "accent": null,              // 强调色 hex，null = 极光绿
    "wallpaper": null            // 预设 id（grid/dune/tide/ember）或图片 URL，null = 纯极光
  },
  "privacy": { "publicNav": true },  // false = 全站需登录
  "search": { "engines": [{ "id": "google", "name": "Google", "url": "https://www.google.com/search?q=%s" }], "default": "google" },
  "groups": [{
    "id": "g-xxx", "name": "自托管",
    "services": [{
      "id": "s-xxx", "name": "Jellyfin", "url": "http://nas.local:8096",
      "desc": "媒体库", "icon": "play",
      "check": { "type": "tcp", "host": "nas.local", "port": 8096 }  // 在线检测
    }]
  }],
  "monitor": { "thresholds": { "cpu": 85, "mem": 90, "disk": 90, "downMinutes": 3, "temp": 65 }, "sparkMinutes": 30 }
}
```
- `icon` 支持内置键名（git/cloud/router/nas/play/tv/mail/folder/key/terminal/layers/box/globe…）或 `https://` 图标 URL
- `check` 勾选后由**采集器**在局域网内 TCP 探活；未启用则状态点显示"未启用探活"

## 采集器配置
采集器以 OpenWrt 插件形态运行，配置**不直接改 config.yaml**，而是通过：
- **LuCI 后台**「服务 → NAV 采集器」（推荐），或
- UCI `/etc/config/nav`（`uci set`），或
- 本地页 `http://<路由器IP>:12900/`

procd 启动脚本 `nav.init` 会把 UCI 自动转成 `/var/run/nav/config.yaml` 再启动采集器。关键字段：
- `push.url`：`https://nav.403333.xyz/api/ingest`；`push.token` 与云端 `COLLECTOR_TOKEN` 一致
- `self`：路由器本机（`/proc` 直读；`fwx: true` 时本地 ubus 补 FanchmWrt 连接数/联网/版本）
- 告警分两类：设备阈值告警由采集器侧评估（见 openwrt-packages 的 nav-collector README）；采集器失联告警由云端 Cron 负责

### 设备探针类型
**插件形态**（推荐，见 docs/PLUGIN.md）：`self` 即路由器（/proc 直读；`self.fwx: true` 时本地 ubus 补充 FanchmWrt 连接数/联网/版本），devices 里放 `openclash`（本地 Clash API）与 `nas`（type: ssh 回采，NAS 零安装）。

**设备探针类型**（`devices[].type`，插件形态内）：
| type | 适用 | 采集内容 | 对端要求 |
|---|---|---|---|
| `ubus` | **FanchmWrt 固件** | CPU/内存/温度/时长、WAN 口速率、**conntrack 连接数、联网状态、固件与 OAF 版本** | 启用 uhttpd-mod-ubus；采集器侧存账号（ubus session 登录） |
| `ssh` | 通用 OpenWrt/iStoreOS 或 **NAS 回采** | WAN/NIC 流量、负载、温度（读 /proc） | authorized_keys 放专用密钥（可加 forced command） |
| `ping` | 任意设备 | 存活检测（ICMP，失败回退 TCP 80/443） | 无 |
| `openclash` | 跑 OpenClash 的路由器 | **核心版本、Clash 连接数、代理上下行速率（/connections 差分）** | OpenClash「外部控制」开启（默认 9090），secret 填 `api_secret` |

OpenClash 监控项映射：服务状态=API 可达性（离线触发 `openclash_down` 级别告警）；版本=`/version`；连接情况=`/connections` 数量与代理流量差分；异常告警=离线/断网/连接数超阈（云端下发的 `conn` 阈值）。

### 告警规则全集
`unreachable`（设备离线，critical）、`internet_down`（WAN 断网，critical）、`disk_usage`（critical）、`cpu_high`/`mem_high`/`temp_high`（warn）、`conntrack_high`（连接数超阈，warn）、`svc-<服务名>`（TCP 探活失败，warn）。所有规则触发与恢复都会推送通知渠道。

## 阈值生效链路
页面"设置 → 监控"保存后写入站点配置 → 采集器下次拉取（≤10 分钟）后生效；界面高亮立即按新阈值渲染。
