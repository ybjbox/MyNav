/* 图标库管理弹窗：搜索、分类筛选、新增/编辑/删除图标、品牌色选择、上传裁剪与恢复默认 */
import { useEffect, useRef, useState } from "react";
import { Button, ColorPicker, Input, Popconfirm, Segmented, Select } from "antd";
import { IconX, IconPlus, IconEdit, IconTrash, IconRefresh, IconUpload, IconCheck, IconSearch, DynIcon, iconKeys } from "./icons";
import { IconBlock } from "./IconBlock";
import { IconCropModal } from "./IconCropModal";
import { BRAND_CATALOG } from "../lib/brandCatalog";
import { newId } from "../lib/defaultConfig";
import {
  ICON_LIB_CATEGORIES,
  ICON_LIB_EVENT,
  loadIconLibrary,
  resetIconLibrary,
  saveIconLibrary,
  type IconLibraryCategory,
  type IconLibraryEntry,
} from "../lib/iconLibrary";

const EDIT_CATEGORIES: IconLibraryCategory[] = ["常用", "AI", "开发", "影音", "自托管", "自定义"];

export function IconLibraryModal(props: {
  onClose: () => void;
  onPick?: (entry: IconLibraryEntry) => void;
  embedded?: boolean;
}) {
  const [entries, setEntries] = useState<IconLibraryEntry[]>(() => loadIconLibrary());
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"全部" | IconLibraryCategory>("全部");
  const [editing, setEditing] = useState<IconLibraryEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [srcTab, setSrcTab] = useState<"brand" | "glyph" | "custom">("brand");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setEntries(loadIconLibrary());
    window.addEventListener(ICON_LIB_EVENT, sync);
    return () => window.removeEventListener(ICON_LIB_EVENT, sync);
  }, []);

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
    setSrcTab("brand");
    setEditing({
      id: newId("ico"),
      name: "",
      category: "自定义",
      color: "#2563eb",
      defaultUrl: "https://",
      icon: "globe",
      builtin: false,
    });
  };

  const openEdit = (entry: IconLibraryEntry) => {
    setIsNew(false);
    setSrcTab(
      entry.icon.startsWith("brand:") ? "brand"
        : /^(https?:|data:)/.test(entry.icon) ? "custom"
          : "glyph",
    );
    setEditing({ ...entry });
  };

  const commitEdit = () => {
    if (!editing || !editing.name.trim()) return;
    const clean: IconLibraryEntry = {
      ...editing,
      name: editing.name.trim(),
      defaultUrl: editing.defaultUrl.trim() || "https://",
      color: /^#[0-9a-fA-F]{3,8}$/.test(editing.color.trim()) ? editing.color.trim() : "#2563eb",
    };
    const next = isNew
      ? [clean, ...entries]
      : entries.map((x) => (x.id === clean.id ? clean : x));
    saveIconLibrary(next);
    setEntries(next);
    setEditing(null);
  };

  const removeEntry = (id: string) => {
    const next = entries.filter((x) => x.id !== id);
    saveIconLibrary(next);
    setEntries(next);
  };

  const handleReset = () => {
    setEntries(resetIconLibrary());
    setEditing(null);
  };

  const filtered = entries.filter((e) => {
    if (cat !== "全部" && e.category !== cat) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q)
      || e.icon.toLowerCase().includes(q)
      || e.defaultUrl.toLowerCase().includes(q)
    );
  });

  const body = (
    <>
      {/* 顶部工具栏 */}
      <div style={{ display: "flex", gap: 8, marginTop: props.embedded ? 0 : 12, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Input
          allowClear
          size="small"
          prefix={<IconSearch size={13} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索图标名称、标识或 URL…"
          style={{ flex: 1, minWidth: 160 }}
        />
        <Button type="primary" size="small" icon={<IconPlus size={13} />} onClick={openNew}>
          新增图标
        </Button>
        <Popconfirm
          title="确定恢复默认图标库？"
          description="自定义新增与修改将被重置。"
          okText="恢复"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={handleReset}
        >
          <Button size="small" icon={<IconRefresh size={13} />} title="恢复默认图标库">
            恢复默认
          </Button>
        </Popconfirm>
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
        <div
          className="iconlib-editor"
          style={{
            borderRadius: 16,
            border: "1px solid var(--border, rgba(15,23,42,0.12))",
            background: "var(--surface, rgba(255,255,255,0.06))",
            padding: "14px 16px",
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconBlock name={editing.name || "?"} icon={editing.icon} size={22} className="ico-block" />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{isNew ? "新增图标" : `编辑 · ${editing.name}`}</span>
            </div>
            <Button size="small" type="text" icon={<IconX size={14} />} onClick={() => setEditing(null)} aria-label="取消编辑" />
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="图标名称（必填）"
              style={{ flex: 1, minWidth: 130 }}
            />
            <Input
              value={editing.defaultUrl}
              onChange={(e) => setEditing({ ...editing, defaultUrl: e.target.value })}
              placeholder="默认网址（如 https://github.com）"
              style={{ flex: 1.4, minWidth: 160 }}
            />
            <Select
              value={editing.category}
              onChange={(v) => setEditing({ ...editing, category: v as IconLibraryCategory })}
              options={EDIT_CATEGORIES.map((c) => ({ label: c, value: c }))}
              style={{ width: 108 }}
            />
            <ColorPicker
              value={editing.color}
              showText
              onChange={(_, hex) => setEditing({ ...editing, color: hex })}
            />
          </div>

          <Segmented
            size="small"
            value={srcTab}
            onChange={(v) => setSrcTab(v as "brand" | "glyph" | "custom")}
            options={[
              { label: "品牌矢量", value: "brand" },
              { label: "基础图形", value: "glyph" },
              { label: "URL / 上传裁剪", value: "custom" },
            ]}
          />

          {srcTab === "brand" && (
            <div style={{ display: "flex", flexWrap: "wrap", maxHeight: 110, overflowY: "auto", gap: 6 }}>
              {BRAND_CATALOG.map((b) => (
                <Button
                  key={b.slug}
                  size="small"
                  type={editing.icon === `brand:${b.slug}` ? "primary" : "default"}
                  onClick={() => setEditing({ ...editing, icon: `brand:${b.slug}`, color: editing.color || b.color })}
                >
                  {b.name}
                </Button>
              ))}
            </div>
          )}

          {srcTab === "glyph" && (
            <div style={{ display: "flex", flexWrap: "wrap", maxHeight: 110, overflowY: "auto", gap: 6 }}>
              {iconKeys.map((k) => (
                <Button
                  key={k}
                  size="small"
                  type={editing.icon === k ? "primary" : "default"}
                  icon={<DynIcon name={k} size={13} />}
                  onClick={() => setEditing({ ...editing, icon: k })}
                >
                  {k}
                </Button>
              ))}
            </div>
          )}

          {srcTab === "custom" && (
            <div className="row" style={{ gap: 8 }}>
              <Input
                value={/^(https?:|data:)/.test(editing.icon) ? editing.icon : ""}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value || "globe" })}
                placeholder="粘贴图片 URL（https://...）"
                style={{ flex: 1 }}
              />
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
                上传裁剪
              </Button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button size="small" onClick={() => setEditing(null)}>取消</Button>
            <Button type="primary" size="small" icon={<IconCheck size={13} />} disabled={!editing.name.trim()} onClick={commitEdit}>
              保存图标
            </Button>
          </div>
        </div>
      )}

      {/* 图标网格（紧凑高密度） */}
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
            title={`${entry.name} · ${entry.category}${entry.defaultUrl ? `\n${entry.defaultUrl}` : ""}`}
            onClick={() => {
              if (props.onPick) {
                props.onPick(entry);
                props.onClose();
              } else {
                openEdit(entry);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <IconBlock name={entry.name} icon={entry.icon} size={20} className="ico-block" />
            <div className="il-name">{entry.name}</div>
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
                onClick={() => removeEntry(entry.id)}
              />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty" style={{ gridColumn: "1 / -1", padding: "28px 0" }}>
            未找到匹配的图标
          </div>
        )}
      </div>

      {cropSrc && (
        <IconCropModal
          src={cropSrc}
          onClose={() => setCropSrc(null)}
          onDone={(dataUrl) => {
            if (editing) setEditing({ ...editing, icon: dataUrl });
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
