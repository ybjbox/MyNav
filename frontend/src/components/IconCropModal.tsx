/* 图标裁剪器：上传图片 → 缩放/拖动定位 → 输出 96×96 PNG dataURL */
import React, { useEffect, useRef, useState } from "react";
import { Button, Slider } from "antd";
import { IconX } from "./icons";

const OUT = 96; // 输出尺寸

export function IconCropModal(props: { src: string; onClose: () => void; onDone: (dataUrl: string) => void }) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1); // 相对"cover"基准的倍率
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setReady(true); };
    img.onerror = () => setError("图片加载失败");
    img.src = props.src;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); img.onload = null; img.onerror = null; };
  }, [props]);

  // cover 基准：铺满输出框的最小缩放
  const baseScale = imgRef.current ? Math.max(OUT / imgRef.current.width, OUT / imgRef.current.height) : 1;
  const drawScale = baseScale * scale;

  const paint = React.useCallback(() => {
    const canvas = cropCanvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, OUT, OUT);
    const w = img.width * drawScale;
    const h = img.height * drawScale;
    // 中心 + 偏移，clamp 保证不露底
    const maxDx = Math.max(0, (w - OUT) / 2);
    const maxDy = Math.max(0, (h - OUT) / 2);
    const dx = Math.min(maxDx, Math.max(-maxDx, offset.x));
    const dy = Math.min(maxDy, Math.max(-maxDy, offset.y));
    ctx.drawImage(img, (OUT - w) / 2 + dx, (OUT - h) / 2 + dy, w, h);
  }, [drawScale, offset]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropCanvasRef = canvasRef;

  useEffect(() => { if (ready) paint(); }, [ready, paint]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
    paint();
  };
  const onPointerUp = () => { dragRef.current = null; };

  const done = () => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    paint();
    props.onDone(canvas.toDataURL("image/png"));
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="modal narrow crop-modal">
        <div className="modal-head">
          <span className="t">裁剪图标</span>
          <button className="iconbtn close" aria-label="关闭" onClick={props.onClose}><IconX size={15} /></button>
        </div>
        {error ? <div className="formerr" style={{ marginTop: 12 }}>{error}</div> : (
          <>
            <div className="crop-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
              <canvas ref={canvasRef} width={OUT} height={OUT} style={{ touchAction: "none", cursor: dragRef.current ? "grabbing" : "grab", borderRadius: 8 }} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>缩放 {scale.toFixed(2)}×</label>
              <Slider
                min={1}
                max={4}
                step={0.05}
                value={scale}
                onChange={(v) => { setScale(v); setTimeout(paint, 0); }}
              />
            </div>
            <div className="formhint">拖动画面调整位置；输出 96×96</div>
            <div className="formfoot">
              <Button onClick={props.onClose}>取消</Button>
              <Button type="primary" disabled={!ready} onClick={done}>使用此图标</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
