import React, { useEffect, useState } from "react";
import { Button, Input } from "antd";
import { IconX, IconActivity } from "./icons";
import { useStore } from "../state/store";

/** 登录弹窗 */
export function LoginModal(props: { onClose: () => void }) {
  const { login, toast } = useStore();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setErr("");
    try {
      await login(pw);
      toast("已登录");
      props.onClose();
    } catch (ex) {
      setErr((ex as Error).message === "密码错误" ? "密码错误" : `登录失败：${(ex as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay show" role="dialog" aria-modal="true" aria-label="登录" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <form className="modal narrow" onSubmit={submit}>
        <div className="modal-head">
          <span className="brand"><span className="mark"><IconActivity size={15} strokeWidth={1.8} /></span>NAV</span>
          <button type="button" className="iconbtn close" aria-label="关闭" onClick={props.onClose}><IconX size={15} /></button>
        </div>
        <div className="formhint" style={{ marginTop: 14 }}>登录后可编辑导航、查看监控数据与告警</div>
        {err && <div className="formerr">{err}</div>}
        <div className="field">
          <label htmlFor="lg-pw">管理密码</label>
          <Input.Password
            id="lg-pw"
            autoFocus
            autoComplete="current-password"
            placeholder="请输入管理密码"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>
        <div className="formfoot">
          <Button onClick={props.onClose}>取消</Button>
          <Button type="primary" htmlType="submit" loading={busy} disabled={!pw}>登录</Button>
        </div>
      </form>
    </div>
  );
}
