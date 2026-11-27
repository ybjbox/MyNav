/* 卡片编辑弹窗：服务卡片 / 文件夹两种类型；支持图标库选择、上传裁剪、跨分组移动 */
import { useEffect, useRef, useState } from "react";
import { Button, Input, InputNumber, Segmented, Select, Switch } from "antd";
import { IconX, IconTrash, IconUpload, IconPlus, IconSliders, IconSearch, DynIcon, iconKeys } from "./icons";
import { newId } from "../lib/defaultConfig";
import { ICON_LIB_CATEGORIES, ICON_LIB_EVENT, loadIconLibrary, type IconLibraryCategory, type IconLibraryEntry } from "../lib/iconLibrary";
import { faviconUrlForSite } from "../lib/brandCatalog";
import { IconBlock } from "./IconBlock";
import { IconLibraryModal } from "./IconLibraryModal";
import { useStore } from "../state/store";
import { IconCropModal } from "./IconCropModal";
import type { ServiceItem, Group } from "../types";

export function EditServiceModal(props: {
  initial: ServiceItem | null; // null = 新建
  groups: Group[];
  groupId: string;
  onClose: () => void;
  onSave: (groupId: string, item: ServiceItem) => void;
  onDelete?: () => void;
  onManageIcons?: () => void;
}) {
  const { toast } = useStore();
  const isFolderInitial = !!props.initial && Array.isArray(props.initial.children);
  const [isFolder, setIsFolder] = useState(isFolderInitial);
  const [gid, setGid] = useState(props.groupId);
  const [item, setItem] = useState<ServiceItem>(
    props.initial
      ? JSON.parse(JSON.stringify(props.initial))
      : { id: newId("s"), name: "", url: "", desc: "", icon: "globe" },
  );
  const [withCheck, setWithCheck] = useState(!!props.initial?.check);
  const [err, setErr] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [iconTab, setIconTab] = useState<"brand" | "glyph" | "custom">(
    props.initial?.icon && /^(https?:\/\/|data:)/.test(props.initial.icon) ? "custom"
      : props.initial?.icon?.startsWith("brand:") ? "brand"
        : props.initial?.icon && props.initial.icon !== "globe" ? "glyph"
          : "brand",
  );
  const [brandQuery, setBrandQuery] = useState("");
  const [brandCat, setBrandCat] = useState<"全部" | IconLibraryCategory>("全部");
  const [libEntries, setLibEntries] = useState<IconLibraryEntry[]>(() => loadIconLibrary());
  const [showLibModal, setShowLibModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setLibEntries(loadIconLibrary());
    window.addEventListener(ICON_LIB_EVENT, sync);
    return () => window.removeEventListener(ICON_LIB_EVENT, sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  useEffect(() => {
    if (!isFolder && withCheck && !item.check) {
      try {
        const u = new URL(item.url);
        const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
        setItem((s) => ({ ...s, check: { type: "tcp", host: u.hostname, port } }));
      } catch { /* URL 未填全时跳过 */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withCheck]);

  const setIconFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCropSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const normalizeUrl = (raw: string): string | null => {
    const t = raw.trim();
    if (!t) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t) && !/^https?:\/\//i.test(t)) return null;
    return /^https?:\/\//i.test(t) ? t : "https://" + t;
  };

  const save = () => {
    if (!item.name.trim()) { setErr("名称必填"); return; }
    if (!isFolder) {
      if (!item.url.trim()) { setErr("URL 必填"); return; }
      const url = normalizeUrl(item.url);
      if (!url) { setErr("URL 必须为 http:// 或 https:// 协议"); return; }
      const next: ServiceItem = { ...item, url, check: withCheck ? item.check : undefined };
      props.onSave(gid, next);
    } else {
      const cleanKids: ServiceItem[] = [];
      for (const c of item.children || []) {
        if (!c.name.trim() && !c.url.trim()) continue;
        if (!c.name.trim() || !c.url.trim()) { setErr("文件夹子卡片名称与 URL 均不能为空"); return; }
        const url = normalizeUrl(c.url);
        if (!url) { setErr(`子卡片「${c.name}」的 URL 必须为 http:// 或 https:// 协议`); return; }
        cleanKids.push({ ...c, name: c.name.trim(), url });
      }
      const next: ServiceItem = { ...item, url: "", check: undefined, children: cleanKids };
      props.onSave(gid, next);
    }
    toast(props.initial ? "已更新（记得保存配置）" : "已添加（记得保存配置）");
    props.onClose();
  };

  return (
    <div className="overlay show" role="dialog" aria-modal="true" aria-label="编辑卡片" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="modal narrow">
        <div className="modal-head">
          <span className="t">{props.initial ? "编辑" : "添加"}</span>
          <button className="iconbtn close" aria-label="关闭" onClick={props.onClose}><IconX size={15} /></button>
        </div>
        {err && <div className="formerr" style={{ marginTop: 12 }}>{err}</div>}

        <div className="field" style={{ marginTop: 14 }}>
          <label>类型</label>
          <Segmented
            value={isFolder ? "folder" : "service"}
            onChange={(v) => setIsFolder(v === "folder")}
            options={[
              { label: "服务卡片", value: "service" },
              { label: "文件夹", value: "folder" },
            ]}
          />
        </div>

        <div className="field">
          <label>名称</label>
          <Input autoFocus value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder={isFolder ? "例如：常用工具" : "例如 Jellyfin"} />
        </div>

        {!isFolder && (
          <>
            <div className="field">
              <label>URL</label>
              <Input value={item.url} onChange={(e) => setItem({ ...item, url: e.target.value })} placeholder="http://nas.local:8096" />
            </div>
            <div className="field">
              <label>描述（可选）</label>
              <Input value={item.desc || ""} onChange={(e) => setItem({ ...item, desc: e.target.value })} placeholder="媒体库" />
            </div>
          </>
        )}

        <div className="field">
          <label>图标库{isFolder ? "（文件夹缩略用）" : ""}</label>
          <div style={{ marginBottom: 8 }}>
            <Segmented
              size="small"
              value={iconTab}
              onChange={(v) => setIconTab(v as "brand" | "glyph" | "custom")}
              options={[
                { label: "常用网站", value: "brand" },
                { label: "基础图形", value: "glyph" },
                { label: "上传 / URL", value: "custom" },
              ]}
            />
          </div>

          {iconTab === "brand" && (
            <div>
              <div className="row" style={{ marginBottom: 8, gap: 8 }}>
                <Input
                  allowClear
                  prefix={<IconSearch size={13} />}
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder="搜索网站（如 GitHub、哔哩哔哩、Docker）"
                  style={{ flex: 1 }}
                />
                <Button
                  size="small"
                  icon={<IconSliders size={12} />}
                  onClick={() => {
                    if (props.onManageIcons) props.onManageIcons();
                    else setShowLibModal(true);
                  }}
                >
                  管理图标库
                </Button>
              </div>
              <div style={{ marginBottom: 8, overflowX: "auto" }}>
                <Segmented
                  size="small"
                  value={brandCat}
                  onChange={(v) => setBrandCat(v as "全部" | IconLibraryCategory)}
                  options={ICON_LIB_CATEGORIES}
                />
              </div>
              <div
                className="iconlib-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
                  gap: 8,
                  maxHeight: 190,
                  overflowY: "auto",
                  padding: 4,
                }}
              >
                {libEntries.filter((b) => {
                  if (brandCat !== "全部" && b.category !== brandCat) return false;
                  const q = brandQuery.trim().toLowerCase();
                  if (!q) return true;
                  return b.name.toLowerCase().includes(q) || b.icon.toLowerCase().includes(q);
                }).map((b) => {
                  const selected = item.icon === b.icon;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setItem((prev) => ({
                          ...prev,
                          icon: b.icon,
                          name: prev.name.trim() ? prev.name : b.name,
                          url: !isFolder && !prev.url.trim() ? b.defaultUrl : prev.url,
                        }));
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 5,
                        padding: "8px 4px",
                        borderRadius: 12,
                        border: selected ? "1.5px solid var(--accent)" : "1px solid rgba(16, 26, 36, 0.1)",
                        background: selected ? "var(--accent-dim)" : "#f8fafc",
                        cursor: "pointer",
                        color: "#1e293b",
                      }}
                      title={`${b.name} (${b.defaultUrl})`}
                    >
                      <IconBlock url={b.defaultUrl} name={b.name} icon={b.icon} size={20} className="ico-block" />
                      <span style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                        {b.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {iconTab === "glyph" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 150, overflow: "auto" }}>
              {iconKeys.map((k) => (
                <Button
                  key={k}
                  size="small"
                  type={item.icon === k ? "primary" : "default"}
                  icon={<DynIcon name={k} size={13} />}
                  onClick={() => setItem({ ...item, icon: k })}
                >
                  {k}
                </Button>
              ))}
            </div>
          )}

          {iconTab === "custom" && (
            <div>
              <div className="row" style={{ gap: 8 }}>
                <Input
                  value={/^(https?:|\/api\/favicon)/.test(item.icon || "") ? item.icon! : ""}
                  onChange={(e) => setItem({ ...item, icon: e.target.value || "globe" })}
                  placeholder="粘贴图标 URL（可选）"
                  style={{ flex: 1 }}
                />
                {!isFolder && faviconUrlForSite(item.url) && (
                  <Button onClick={() => {
                    const fav = faviconUrlForSite(item.url);
                    if (fav) setItem({ ...item, icon: fav });
                  }}>
                    抓取网站图标
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setIconFromFile(f);
                    e.target.value = "";
                  }}
                />
                <Button icon={<IconUpload size={14} />} onClick={() => fileRef.current?.click()}>
                  上传裁剪
                </Button>
              </div>
              {/^data:/.test(item.icon || "") && (
                <div className="formhint" style={{ marginTop: 6 }}>✓ 已使用自定义裁剪图标（保存后生效）</div>
              )}
            </div>
          )}
        </div>

        <div className="field">
          <label>分组</label>
          <Select
            value={gid}
            onChange={(v) => setGid(v)}
            options={props.groups.map((g) => ({ label: g.name, value: g.id }))}
            style={{ width: "100%" }}
          />
        </div>

        {!isFolder && (
          <div className="field">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <label style={{ margin: 0 }}>启用在线检测（采集器 TCP 探活，显示状态点）</label>
              <Switch checked={withCheck} onChange={(checked) => setWithCheck(checked)} />
            </div>
            {withCheck && item.check && (
              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <Input
                  value={item.check.host}
                  onChange={(e) => setItem({ ...item, check: { type: "tcp", host: e.target.value, port: item.check!.port } })}
                  placeholder="主机/IP"
                  style={{ flex: 1 }}
                />
                <InputNumber
                  min={1}
                  max={65535}
                  value={item.check.port}
                  onChange={(v) => setItem({ ...item, check: { type: "tcp", host: item.check!.host, port: Number(v) || 0 } })}
                  placeholder="端口"
                  style={{ width: 110 }}
                />
              </div>
            )}
          </div>
        )}

        {isFolder && (
          <div className="field">
            <label>文件夹内容（{item.children?.length || 0} 项）</label>
            {(item.children || []).map((c, i) => (
              <div className="row" key={c.id} style={{ marginBottom: 6, gap: 6 }}>
                <Input value={c.name} placeholder="名称"
                  onChange={(e) => {
                    const kids = [...(item.children || [])];
                    kids[i] = { ...kids[i], name: e.target.value };
                    setItem({ ...item, children: kids });
                  }} />
                <Input value={c.url} placeholder="URL"
                  onChange={(e) => {
                    const kids = [...(item.children || [])];
                    kids[i] = { ...kids[i], url: e.target.value };
                    setItem({ ...item, children: kids });
                  }} />
                <Button danger size="small" icon={<IconTrash size={13} />} onClick={() => {
                  setItem({ ...item, children: (item.children || []).filter((_, j) => j !== i) });
                }} />
              </div>
            ))}
            <Button size="small" icon={<IconPlus size={13} />} onClick={() => {
              setItem({ ...item, children: [...(item.children || []), { id: newId("s"), name: "", url: "", icon: "globe" }] });
            }}>添加子卡片</Button>
          </div>
        )}

        <div className="formfoot">
          {props.initial && props.onDelete && (
            <Button
              danger
              icon={<IconTrash size={14} />}
              style={{ marginRight: "auto" }}
              onClick={() => { props.onDelete!(); toast("已删除（记得保存配置）"); props.onClose(); }}
            >
              删除
            </Button>
          )}
          <Button onClick={props.onClose}>取消</Button>
          <Button type="primary" onClick={save}>保存</Button>
        </div>

        {cropSrc && (
          <IconCropModal
            src={cropSrc}
            onClose={() => setCropSrc(null)}
            onDone={(dataUrl) => { setItem({ ...item, icon: dataUrl }); setCropSrc(null); toast("图标已裁剪，保存卡片后生效"); }}
          />
        )}
        {showLibModal && (
          <IconLibraryModal
            onClose={() => setShowLibModal(false)}
            onPick={(entry) => {
              setItem((prev) => ({
                ...prev,
                icon: entry.icon,
                name: prev.name.trim() ? prev.name : entry.name,
                url: !isFolder && !prev.url.trim() ? entry.defaultUrl : prev.url,
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}
