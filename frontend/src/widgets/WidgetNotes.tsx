/* 快捷便签 WeTab 风格组件（Tiptap v3 双态混合模式）：localStorage (nav:notes) 自动保存 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RichNoteEditor } from "../components/RichNoteEditor";
import { IconX } from "../components/icons";
import type { WidgetProps } from "./registry";

const NOTES_KEY = "nav:notes";

function loadNotes(): string {
  try {
    return localStorage.getItem(NOTES_KEY) || "";
  } catch {
    return "";
  }
}

export function WidgetNotes(_props: WidgetProps) {
  const [content, setContent] = useState(() => loadNotes());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, content);
      setSavedAt("已保存");
    } catch {
      /* 忽略 */
    }
  }, [content]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      <div
        className="widget-notes"
        style={{
          height: "100%",
          minHeight: 0,
          padding: "16px 18px",
          boxSizing: "border-box",
          background: "rgba(255, 255, 255, 0.94)",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div className="notes-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, gap: 6 }}>
          <span style={{ fontWeight: 600, color: "#334155" }}>随手便签</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="notes-saved" style={{ fontSize: 11, color: "#94a3b8" }}>{savedAt || "本机存储"}</span>
            <button
              type="button"
              className="notes-expand-btn"
              title="放大编辑（完整工具栏）"
              aria-label="放大编辑"
              onClick={() => setExpanded(true)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <RichNoteEditor value={content} onChange={setContent} mode="compact" />
        </div>
      </div>

      {expanded &&
        createPortal(
          <div
            className="overlay show"
            role="dialog"
            aria-modal="true"
            aria-label="便签专注编辑"
            onClick={(e) => {
              if (e.target === e.currentTarget) setExpanded(false);
            }}
          >
            <div className="modal notes-modal">
              <div className="modal-head">
                <span className="t" style={{ fontSize: 15, fontWeight: 600 }}>
                  随手便签
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: "#64748b" }}>
                    {savedAt || "自动保存"}
                  </span>
                </span>
                <button
                  type="button"
                  className="iconbtn close"
                  aria-label="关闭"
                  onClick={() => setExpanded(false)}
                >
                  <IconX size={15} />
                </button>
              </div>
              <div className="notes-modal-body">
                <RichNoteEditor value={content} onChange={setContent} mode="full" />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
