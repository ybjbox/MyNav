# NAV 路由器插件（OpenWrt / FanchmWrt）

把采集器以插件（ipk）形式编译进路由器固件，作为**唯一的采集端**（单采集器架构）。插件采集：路由器自身（/proc + FanchmWrt ubus）、OpenClash 状态（本地 Clash API）、**NAS 指标（SSH 回采，NAS 零安装）**。

## 职责边界

| 在插件内 | 明确不做 |
|---|---|
| 路由器本机指标（/proc 直接读取） | 在 NAS 上安装任何组件（NAS 只开自带 SSH） |
| FanchmWrt 状态（本地 `ubus call fwx`：conntrack/联网/固件与 OAF 版本） | 调用任何 `set_*`/`delete_*` 写接口（纯只读） |
| OpenClash 状态（localhost Clash API：版本/连接数/代理速率） | 数据持久化（重启即丢，靠推送频率与云端留存兜底） |
| NAS 指标回采（SSH 只读 /proc，受限账号） | 任何监听端口（仅出站 HTTPS） |
| 阈值告警 + Bark/TG/Webhook + 导航卡片 TCP 探活 | |

## NAS 数据获取方式（评估结论）

| 方式 | 结论 |
|---|---|
| **SSH 回采（已实现，推荐）** | NAS 开自带 SSH + 建受限只读账号 + authorized_keys 加 forced command；插件 SSH 读 `/proc`。零 NAS 安装、协议稳定 |
| fnOS 官方 Skill/CLI（OAuth） | ✅ 认证形态理想（OAuth+PKCE 一次性授权码，免 NAS 密码、可撤销、`monitor cpu/memory/net/disk` 直接命中），但 CLI 是闭源平台二进制，授权 URL/token 兑换端点未公开文档化，Go 侧无法合规复刻；CLI 也不适合捆绑进路由器 ipk。**作为官方协议开放后的第一优先升级项**（见下） |
| pyfnos WebSocket 协议 | 非官方逆向（Apache-2.0，活跃维护），加密登录 + 2FA + longToken，数据最全；协议随 fnOS 升级有失效风险，不做主路径 |
| 社区监控应用（fnmonitor / FNOS-API） | 需在 NAS 装应用，违背"NAS 零安装"目标 |
| 官方开放 API | fnOS 官方已宣布向三方开放 API 能力（面向 NAS 内应用），远程监控 REST 文档尚未发布；持续关注 `fnnas-labs` 组织 |

**后续升级路径**：官方一旦把 `/ogh/ac/h/*` 网关与 OAuth 兑换端点文档化，插件增加 `type: fnos` 探针（OAuth code → token → `appcgi.resmon.*`），届时替换 SSH 回采，NAS 侧连受限账号都可省去。

## 采集器代码在哪（唯一真源）

采集器代码**不在 nav 仓库**，统一在 **`ybjbox/openwrt-packages` 的 `nav-collector/`**（本仓库只管云端：前端 + Worker）。目录结构：

```
ybjbox/openwrt-packages/nav-collector/    # 唯一真源（OpenWrt 包 + Go 源码全在此）
├── Makefile            # OpenWrt Go 包（packages feed 的 golang-package.mk，依赖 +luci-base）
├── README.md           # 该目录的自述（形态/构建/契约）
├── src/                # Go module（cmd/ internal/ go.mod go.sum）
│   ├── go.mod
│   ├── cmd/collector/
│   └── internal/       # 含 ui/page.html（go:embed 用，构建时必须整包拷贝）
└── files/
    ├── config          # UCI 默认配置 → /etc/config/nav
    ├── nav.init        # procd 脚本：UCI → /var/run/nav/config.yaml → 启动；含 keygen 动作
    ├── nav-menu.json   # LuCI 菜单入口 → /usr/share/luci/menu.d/（服务 → NAV 采集器）
    ├── nav.acl         # rpcd 授权：nav 配置读写 + luci.setInitAction 重启
    └── luci-nav.js     # LuCI 配置页 JS 视图 → /www/luci-static/resources/view/nav/config.js
```

没有副本、没有同步脚本——固件构建直接消费 openwrt-packages，改完 push 即生效。

## 配置入口（两处互通，改哪都生效）
1. **LuCI 后台**（推荐）：菜单「服务 → NAV 采集器」，表单直接读写 `/etc/config/nav`，
   保存并应用后自动重启采集器。敏感字段（push_token / api_secret / 密码）不回显，留空不修改。
2. **插件自带本地页**：`http://<路由器IP>:12900/`，仅局域网，需 `nav.ui.password`（见下）。
两处都依赖 `luci-base`（固件带 LuCI 即已满足，无新增体积负担）。

## 集成方式 A：随固件在线编译（推荐）
1. openwrt-packages 已作为 feed 在固件 builder 登记（`feed:ybjbox`），builder 的 `features.md` 加包行即可；
   若未登记 feed，需先把 openwrt-packages 加入固件仓库的 feeds
2. 固件 `.config` 加一行：`CONFIG_PACKAGE_nav-collector=y`
3. 前提：固件构建已启用 packages feed 且含 `golang`（若未含，见方式 B）
4. 编译出的固件自带插件；首次启动后配置：

```sh
uci set nav.main.push_url='https://nav.403333.xyz/api/ingest'   # 正式地址唯一来源；勿用旧的 *.pages.dev / workers.dev
uci set nav.main.push_token='<COLLECTOR_TOKEN>'
uci set nav.nas.enabled='1'         # NAS 回采
uci set nav.nas.host='192.168.100.10:22'
/etc/init.d/nav keygen              # 生成 NAS 回采密钥并打印公钥
# 把输出的公钥加入 NAS 的 authorized_keys（受限账号 + forced command，见 docs/SECURITY.md）
uci commit nav
/etc/init.d/nav restart
```

## 集成方式 B：独立 ipk
`ybjbox/openwrt-packages` 仓库根目录的 `ipk.yml` workflow 按架构矩阵出 ipk 发布到 Releases；路由器上 `opkg install`。
> FanchmWrt 若提供自己的 SDK，把 workflow 里 SDK 地址换成对应版本以保证 ABI 一致。

> 采集器仅以 OpenWrt 插件形态部署在路由器上。NAS 指标由插件 SSH 回采（NAS 零安装），
> 不提供 NAS Docker 形态；如以后需要再单独适配。

## 运行约束与调优
- **体积**：Go 静态编译 `-s -w` 约 12–15MB；x86_64 无压力，小闪存设备可加 `upx`（换启动稍慢）
- **内存**：稳态 < 30MB；吃紧时 `interval` 提到 120s
- **防抖**：OpenClash 重启窗口靠 `fail_threshold`(3)×interval 判离线，不误报
- **时钟**：路由器 NTP 未同步时 ts 漂移 >5min 由云端 clamp 为服务端时间
- **Respawn**：procd `respawn 3600 5 0`

## 可靠性风险与对策
| 风险 | 对策 |
|---|---|
| 路由器整机故障 → 监控与采集同时消失 | 云端按 source 检测数据滞后（设备卡"数据滞后"徽标 + 页脚提示）；这是本架构的固有取舍，接受 |
| NAS SSH 凭据放在路由器 | 受限只读账号 + forced command 只允许 cat /proc；token/凭据泄露面可控（见 SECURITY.md） |
| fnOS 大版本升级改变 SSH 行为 | SSH 是 NAS 系统自带能力，稳定性远高于逆向协议；回采脚本只读 /proc，兼容性好 |
| OpenClash API 重启窗口 | fail_threshold×interval 防抖 |
| 云端旧配置缺新增阈值字段 | 采集器只覆盖 >0 的值，本地默认兜底 |
