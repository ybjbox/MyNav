/* 分组管理弹窗：新增 / 重命名 / 删除确认（替代原生 prompt/confirm） */
import React, { useEffect, useState } from "react";
import { Button, Input } from "antd";
import { IconX } from "./icons";

export type GroupDialogState =
  | { mode: "add" }
  | { mode: "rename"; gid: string; name: string }
  | { mode: "delete"; gid: string; name: string; count: number };

export function GroupModal(props: {
  state: GroupDialogState;
  onClose: () => void;
  onConfirm: (name?: string) => void;
}) {
  const { state } = props;
  const [name, setName] = useState(
    state.mode === "rename" ? state.name : state.mode === "add" ? "新分组" : "",
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.mode === "delete") {
      props.onConfirm();
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    props.onConfirm(trimmed);
  };

  const title =
    state.mode === "add" ? "添加分组"
      : state.mode === "rename" ? "重命名分组"
        : "删除分组";

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <form className="modal narrow" onSubmit={submit}>
        <div className="modal-head">
          <span className="t">{title}</span>
          <button type="button" className="iconbtn close" aria-label="关闭" onClick={props.onClose}>
            <IconX size={15} />
          </button>
        </div>

        {state.mode === "delete" ? (
          <div style={{ margin: "16px 0 18px", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            确定删除分组「<b style={{ color: "#0f172a" }}>{state.name}</b>」及其包含的{" "}
            <b style={{ color: "#0f172a" }}>{state.count}</b> 张卡片吗？
          </div>
        ) : (
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="grp-name">分组名称</label>
            <Input
              id="grp-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入分组名称"
              maxLength={24}
            />
          </div>
        )}

        <div className="formfoot">
          <Button onClick={props.onClose}>取消</Button>
          {state.mode === "delete" ? (
            <Button type="primary" danger htmlType="submit">确认删除</Button>
          ) : (
            <Button type="primary" htmlType="submit" disabled={!name.trim()}>确定</Button>
          )}
        </div>
      </form>
    </div>
  );
}
