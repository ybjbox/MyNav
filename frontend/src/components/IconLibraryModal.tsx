/* 自维护图标库管理面板：直接连接云端 D1 数据库，支持查看名称/分类/来源、增删改、上传裁剪与迁移旧版自定义图标 */
import { useEffect, useRef, useState } from "react";
import { Button, ColorPicker, Input, Popconfirm, Segmented, Select, Spin } from "antd";
import { IconX, IconPlus, IconEdit, IconTrash, IconRefresh, IconUpload, IconCheck, IconSearch, DynIcon, iconKeys } from "./icons";
import { IconBlock } from "./IconBlock";
import { IconCropModal } from "./IconCropModal";
import { api } from "../api/client";
import { useStore } from "../state/store";
import { newId } from "../lib/defaultConfig";
import {
  ICON_LIB_CATEGORIES,
  ICON_LIB_EVENT,
  clearLegacyLocalIcons,
  loadIconLibrary,
  peekLegacyLocalCustomIcons,
  refreshIconLibraryFromDb,
  type IconLibraryCategory,
  type IconLibraryEntry,
} from "../lib/iconLibrary";

const EDIT_CATEGORIES: IconLibraryCategory[] = ["常用", "AI", "开发", "影音", "自托管", "自定义"];

interface EditDraft {
  id?: string;
  name: string;
  category: IconLibraryCategory;
  source: string;
  site_url: string;
  color: string;
  icon_content: string;
}

export function IconLibraryModal(props: {
  onClose: () => void;
  onPick?: (entry: IconLibraryEntry) => void;
  embedded?: boolean;
}) {
  const { authed, toast } = useStore();
  const [entries, setEntries] = useState<IconLibraryEntry[]>(() => loadIconLibrary());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"全部" | IconLibraryCategory>("全部");
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [srcTab, setSrcTab] = useState<"fetch" | "upload" | "glyph">("fetch");
  const [fetchingFav, setFetchingFav] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [legacyCount, setLegacyCount] = useState<number>(() => peekLegacyLocalCustomIcons().length);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setEntries(loadIconLibrary());
    window.addEventListener(ICON_LIB_EVENT, sync);
    setLoading(true);
    refreshIconLibraryFromDb()
      .catch((e) => toast((e as Error).message, true))
      .finally(() => setLoading(false));
    return () => window.removeEventListener(ICON_LIB_EVENT, sync);
  }, [toast]);

  useEffect(() => {
    if (props.embedded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (cropSrc) setCropSrc(null);
        else if (editing) setEditing(null);
        else props.onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props, editing, cropSrc]);

  const openNew = () => {
    setIsNew(true);
    setSrcTab("fetch");
    setEditing({
      id: newId("ico"),
      name: "",
      category: "自定义",
      source: "",
      site_url: "https://",
      color: "#3261e3",
      icon_content: "glyph:globe",
    });
  };

  const fetchRemoteFavicon = async () => {
    if (!editing) return;
    const target = editing.site_url.trim();
    if (!target || target === "https://" || target === "http://") {
      toast("请先填写关联网站 URL 或域名", true);
      return;
    }
    setFetchingFav(true);
    try {
      const r = await api.fetchFavicon(target);
      setEditing((prev) => (prev ? {
        ...prev,
        icon_content: r.dataUrl,
        source: prev.source.trim() ? prev.source : r.host,
        site_url: /^https?:\/\//i.test(target) ? target : `https://${r.host}`,
      } : null));
      toast(`已抓取 ${r.host} 图标，保存后写入数据库`);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setFetchingFav(false);
    }
  };

  const openEdit = (entry: IconLibraryEntry) => {
    setIsNew(false);
    setSrcTab(
      entry.icon_content.startsWith("glyph:") ? "glyph"
        : entry.source === "本地上传" ? "upload"
          : "fetch",
    );
    setEditing({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      source: entry.source || "",
      site_url: entry.site_url || "",
      color: entry.color || "#3261e3",
      icon_content: entry.icon_content,
    });
  };

  const commitEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: editing.name.trim(),
        category: editing.category,
        source: editing.source.trim() || "自定义整理",
        site_url: editing.site_url.trim(),
        color: /^#[0-9a-fA-F]{3,8}$/.test(editing.color.trim()) ? editing.color.trim() : "#3261e3",
        icon_content: editing.icon_content.trim() || "glyph:globe",
      };
      if (isNew) {
        await api.createIcon(payload);
        toast("已写入数据库图标库");
      } else if (editing.id) {
        await api.updateIcon({ id: editing.id, ...payload });
        toast("图标已更新");
      }
      await refreshIconLibraryFromDb();
      setEditing(null);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await api.deleteIcon(id);
      await refreshIconLibraryFromDb();
      toast("图标已删除");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await api.resetIcons();
      await refreshIconLibraryFromDb();
      setEditing(null);
      toast("已恢复数据库内置默认图标库");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateLegacy = async () => {
    const items = peekLegacyLocalCustomIcons();
    if (!items.length) return;
    setLoading(true);
    try {
      const r = await api.migrateIcons(items);
      clearLegacyLocalIcons();
      setLegacyCount(0);
      await refreshIconLibraryFromDb();
      toast(`已迁移 ${r.imported} 个本地自定义图标到数据库`);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setLoading(false);
    }
  };

  const filtered = entries.filter((e) => {
    if (cat !== "全部" && e.category !== cat) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q)
      || e.slug.toLowerCase().includes(q)
      || e.source.toLowerCase().includes(q)
      || e.site_url.toLowerCase().includes(q)
    );
  });

  const body = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: props.embedded ? 0 : 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="formhint" style={{ margin: 0 }}>
          已连接云端 D1 图标库（共 {entries.length} 个本地图标 · 无外部依赖）
        </span>
        {authed && legacyCount > 0 && (
          <Button size="small" onClick={() => void handleMigrateLegacy()}>
            迁入旧版自定义图标（{legacyCount}）
          </Button>
        )}
      </div>

      {/* 顶部工具栏 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Input
          allowClear
          size="small"
          prefix={<IconSearch size={13} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索图标名称、来源、分类或网站…"
          style={{ flex: 1, minWidth: 160 }}
        />
        <Button size="small" icon={<IconRefresh size={13} />} loading={loading} onClick={() => void refreshIconLibraryFromDb()} title="刷新数据库图标">
          刷新
        </Button>
        {authed && (
          <>
            <Button type="primary" size="small" icon={<IconPlus size={13} />} onClick={openNew}>
              新增图标
            </Button>
            <Popconfirm
              title="确定恢复默认图标库？"
              description="数据库中的自定义新增与修改将被内置默认集覆盖。"
              okText="恢复"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleReset()}
            >
              <Button size="small" title="恢复默认图标库">
                恢复默认
              </Button>
            </Popconfirm>
          </>
        )}
      </div>

      <div style={{ marginBottom: 10, overflowX: "auto" }}>
        <Segmented
          size="small"
          value={cat}
          onChange={(v) => setCat(v as "全部" | IconLibraryCategory)}
          options={ICON_LIB_CATEGORIES}
        />
      </div>

      {/* 内联编辑面板 */}
      {editing && (
        <div className="iconlib-editor">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconBlock
                url={editing.site_url}
                name={editing.name || "?"}
                icon={editing.icon_content.startsWith("glyph:") ? editing.icon_content.slice(6) : editing.icon_content}
                size={22}
                className="ico-block"
              />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{isNew ? "新增图标（存入数据库）" : `编辑 · ${editing.name}`}</span>
            </div>
            <Button size="small" type="text" icon={<IconX size={14} />} onClick={() => setEditing(null)} aria-label="取消编辑" />
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="图标名称（必填）"
              style={{ flex: 1, minWidth: 120 }}
            />
            <Input
              value={editing.source}
              onChange={(e) => setEditing({ ...editing, source: e.target.value })}
              placeholder="来源（如 github.com / 本地上传）"
              style={{ flex: 1, minWidth: 130 }}
            />
            <Select
              value={editing.category}
              onChange={(v) => setEditing({ ...editing, category: v as IconLibraryCategory })}
              options={EDIT_CATEGORIES.map((c) => ({ label: c, value: c }))}
              style={{ width: 102 }}
            />
            <ColorPicker
              value={editing.color}
              showText
              onChange={(_, hex) => setEditing({ ...editing, color: hex })}
            />
          </div>

          <Input
            value={editing.site_url}
            onChange={(e) => setEditing({ ...editing, site_url: e.target.value })}
            placeholder="关联网站 URL（用于自动匹配卡片网址，如 https://github.com）"
          />

          <Segmented
            size="small"
            value={srcTab}
            onChange={(v) => setSrcTab(v as "fetch" | "upload" | "glyph")}
            options={[
              { label: "远程抓取", value: "fetch" },
              { label: "本地上传", value: "upload" },
              { label: "内置基础图形", value: "glyph" },
            ]}
          />

          {srcTab === "fetch" && (
            <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Button
                size="small"
                type="primary"
                ghost
                loading={fetchingFav}
                onClick={() => void fetchRemoteFavicon()}
              >
                抓取网站 Favicon 并入库
              </Button>
              <span className="formhint" style={{ margin: 0 }}>
                {editing.icon_content.startsWith("data:")
                  ? `✓ 已抓取为本地数据（${Math.round(editing.icon_content.length / 1024)} KB），保存后不再依赖外链`
                  : "填写上方网站 URL 后点击抓取，仅在新建/更新时抓取一次并转存数据库"}
              </span>
            </div>
          )}

          {srcTab === "upload" && (
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = () => setCropSrc(String(reader.result));
                    reader.readAsDataURL(f);
                  }
                  e.target.value = "";
                }}
              />
              <Button size="small" icon={<IconUpload size={13} />} onClick={() => fileRef.current?.click()}>
                选择图片并裁剪存入数据库
              </Button>
              {editing.icon_content.startsWith("data:") && (
                <span className="formhint" style={{ margin: 0 }}>✓ 已生成本地图片数据（{Math.round(editing.icon_content.length / 1024)} KB）</span>
              )}
            </div>
          )}

          {srcTab === "glyph" && (
            <div style={{ display: "flex", flexWrap: "wrap", maxHeight: 110, overflowY: "auto", gap: 6 }}>
              {iconKeys.map((k) => (
                <Button
                  key={k}
                  size="small"
                  type={editing.icon_content === `glyph:${k}` ? "primary" : "default"}
                  icon={<DynIcon name={k} size={13} />}
                  onClick={() => setEditing({ ...editing, icon_content: `glyph:${k}`, source: editing.source || "内置线性图形" })}
                >
                  {k}
                </Button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button size="small" onClick={() => setEditing(null)}>取消</Button>
            <Button type="primary" size="small" loading={saving} icon={<IconCheck size={13} />} disabled={!editing.name.trim()} onClick={() => void commitEdit()}>
              保存到数据库
            </Button>
          </div>
        </div>
      )}

      {/* 图标网格 */}
      <Spin spinning={loading && entries.length === 0}>
        <div
          className="iconlib-manage-grid"
          style={{
            overflowY: props.embedded ? undefined : "auto",
            flex: props.embedded ? undefined : 1,
            paddingRight: 2,
          }}
        >
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="iconlib-card"
              title={`${entry.name} · ${entry.category}${entry.source ? `\n来源：${entry.source}` : ""}${entry.site_url ? `\n站点：${entry.site_url}` : ""}`}
              onClick={() => {
                if (props.onPick) {
                  props.onPick(entry);
                  props.onClose();
                } else if (authed) {
                  openEdit(entry);
                }
              }}
              style={{ cursor: props.onPick || authed ? "pointer" : "default" }}
            >
              <IconBlock url={entry.site_url} name={entry.name} icon={`brand:${entry.slug}`} size={20} className="ico-block" />
              <div className="il-name">{entry.name}</div>
              {entry.source && <div className="il-src">{entry.source}</div>}
              {authed && (
                <div className="il-actions" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="small"
                    type="text"
                    title="编辑"
                    aria-label={`编辑 ${entry.name}`}
                    icon={<IconEdit size={11} />}
                    style={{ width: 22, height: 22, padding: 0 }}
                    onClick={() => openEdit(entry)}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    title="删除"
                    aria-label={`删除 ${entry.name}`}
                    icon={<IconTrash size={11} />}
                    style={{ width: 22, height: 22, padding: 0 }}
                    onClick={() => void removeEntry(entry.id)}
                  />
                </div>
              )}
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="empty" style={{ gridColumn: "1 / -1", padding: "28px 0" }}>
              未找到匹配的图标
            </div>
          )}
        </div>
      </Spin>

      {cropSrc && (
        <IconCropModal
          src={cropSrc}
          onClose={() => setCropSrc(null)}
          onDone={(dataUrl) => {
            if (editing) setEditing({ ...editing, icon_content: dataUrl, source: editing.source || "本地上传" });
            setCropSrc(null);
          }}
        />
      )}
    </>
  );

  if (props.embedded) return body;

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="图标库管理"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 760, width: "94vw", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-head">
          <span className="t">图标库管理（{entries.length}）</span>
          <button className="iconbtn close" aria-label="关闭" onClick={props.onClose}>
            <IconX size={15} />
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
