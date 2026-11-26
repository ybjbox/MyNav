/* 基于 Tiptap v3 的隔离封装富文本/Markdown 笔记编辑器（支持桌面极简+划词 BubbleMenu 与完整工具栏双模式） */
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";

export type NoteEditorMode = "compact" | "full";

/** 将旧版纯文本笔记安全转换为 Tiptap HTML，保留换行 */
export function normalizeNoteContent(raw: string): string {
  const s = raw || "";
  if (!s.trim()) return "";
  if (/^\s*<[a-z][\s\S]*>/i.test(s)) return s;
  const esc = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return s
    .split(/\r?\n/)
    .map((line) => (line ? `<p>${esc(line)}</p>` : "<p></p>"))
    .join("");
}

export function RichNoteEditor(props: {
  value: string;
  onChange: (html: string) => void;
  mode?: NoteEditorMode;
  placeholder?: string;
}) {
  const mode = props.mode ?? "compact";
  const normalized = normalizeNoteContent(props.value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: props.placeholder || "随手记录，支持 # 标题、- [ ] 待办、**加粗**…",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
    ],
    content: normalized,
    onUpdate: ({ editor: ed }) => {
      props.onChange(ed.isEmpty ? "" : ed.getHTML());
    },
  });

  // 外部（如弹窗与卡片之间）同步更新内容，但跳过正在输入中的编辑器自身
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (normalized !== current) {
      editor.commands.setContent(normalized || "", { emitUpdate: false });
    }
  }, [editor, normalized]);

  if (!editor) return null;

  const btnCls = (active: boolean) => `tiptap-btn${active ? " on" : ""}`;

  return (
    <div className={`tiptap-wrap tiptap-${mode}`}>
      {mode === "full" && (
        <div className="tiptap-toolbar" role="toolbar" aria-label="笔记格式工具栏">
          <button
            type="button"
            className={btnCls(editor.isActive("heading", { level: 1 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="一级标题 (# )"
          >
            H1
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive("heading", { level: 2 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="二级标题 (## )"
          >
            H2
          </button>
          <span className="tiptap-sep" />
          <button
            type="button"
            className={btnCls(editor.isActive("bold"))}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="加粗 (Ctrl+B)"
          >
            <b>B</b>
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive("italic"))}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="斜体 (Ctrl+I)"
          >
            <i>I</i>
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive("strike"))}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="删除线"
          >
            <s>S</s>
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive("highlight"))}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            title="高亮"
          >
            高亮
          </button>
          <span className="tiptap-sep" />
          <button
            type="button"
            className={btnCls(editor.isActive("taskList"))}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title="待办清单 (- [ ] )"
          >
            ☑ 待办
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive("bulletList"))}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="无序列表 (- )"
          >
            • 列表
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive("orderedList"))}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="有序列表 (1. )"
          >
            1. 列表
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive("blockquote"))}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="引用 (> )"
          >
            引用
          </button>
          <button
            type="button"
            className={btnCls(editor.isActive("codeBlock"))}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="代码块 (```)"
          >
            代码
          </button>
          <span className="tiptap-sep" />
          <button
            type="button"
            className="tiptap-btn"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            title="撤销 (Ctrl+Z)"
          >
            撤销
          </button>
          <button
            type="button"
            className="tiptap-btn"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            title="重做 (Ctrl+Y)"
          >
            重做
          </button>
        </div>
      )}

      {mode === "compact" && (
        <BubbleMenu editor={editor} options={{ placement: "top", offset: 6 }}>
          <div className="tiptap-bubble" role="toolbar" aria-label="快捷格式">
            <button
              type="button"
              className={btnCls(editor.isActive("bold"))}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="加粗"
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={btnCls(editor.isActive("italic"))}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="斜体"
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className={btnCls(editor.isActive("strike"))}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="删除线"
            >
              <s>S</s>
            </button>
            <button
              type="button"
              className={btnCls(editor.isActive("highlight"))}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title="高亮"
            >
              高亮
            </button>
            <button
              type="button"
              className={btnCls(editor.isActive("taskList"))}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              title="待办清单"
            >
              ☑
            </button>
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="tiptap-scroll" />
    </div>
  );
}
