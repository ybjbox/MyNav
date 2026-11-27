/* 左侧分类导航（HyperOS 悬浮暗色磨砂胶囊竖排；移动端 <=768px 改为顶部横向可滚动胶囊条）。
 * 点击分类直接切换当前视图（主页 / 分组），底部为告警与设置。 */
import {
  IconBell, IconBox, IconFolder, IconGlobe, IconHome, IconLayers,
  IconPlus, IconServer, IconSliders,
} from "./icons";
import type { Group } from "../types";

function groupIcon(name: string) {
  const n = name.toLowerCase();
  if (/工具|软件|开发|tools?|dev/i.test(n)) return IconBox;
  if (/ai|办公|效率|office/i.test(n)) return IconLayers;
  if (/监控|设备|路由|nas|server|monitor|自托管/i.test(n)) return IconServer;
  if (/常用|首页|主页|home|fav/i.test(n)) return IconHome;
  if (/影音|视频|音乐|video|media/i.test(n)) return IconGlobe;
  if (/文件|folder|文档/i.test(n)) return IconFolder;
  return IconLayers;
}

export function SideRail(props: {
  groups: Group[];
  activeTab: string;
  onSelectTab: (tab: string) => void;
  authed: boolean;
  admin: boolean;
  activeAlerts?: number;
  onAlerts?: () => void;
  onSettings: () => void;
  onAdd: () => void;
}) {
  return (
    <nav className="siderail" aria-label="分类导航">
      <div className="siderail-inner">
        <button
          className={`railitem${props.activeTab === "home" ? " on" : ""}`}
          title="主页"
          aria-label="主页"
          onClick={() => props.onSelectTab("home")}
        >
          <IconHome size={18} />
          <span className="rail-label">主页</span>
        </button>

        {props.groups.map((g) => {
          const Icon = groupIcon(g.name);
          return (
            <button
              key={g.id}
              className={`railitem${props.activeTab === g.id ? " on" : ""}`}
              title={g.name}
              aria-label={`分类 ${g.name}`}
              onClick={() => props.onSelectTab(g.id)}
            >
              <Icon size={18} />
              <span className="rail-label">{g.name}</span>
            </button>
          );
        })}

        {props.admin && (
          <button className="railitem" title="添加分组" aria-label="添加分组" onClick={props.onAdd}>
            <IconPlus size={18} />
            <span className="rail-label">添加</span>
          </button>
        )}

        {props.authed && props.onAlerts && (
          <button
            className="railitem rail-bell"
            title="告警通知"
            aria-label={`告警，${props.activeAlerts || 0} 条活动`}
            onClick={props.onAlerts}
          >
            <IconBell size={17} />
            {(props.activeAlerts || 0) > 0 && <span className="rail-badge">{props.activeAlerts}</span>}
          </button>
        )}

        <button className="railitem" title="设置" aria-label="设置" onClick={props.onSettings}>
          <IconSliders size={17} />
        </button>
      </div>
    </nav>
  );
}
