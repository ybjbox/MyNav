/* 图标块：优先使用自维护 D1 图标库中的本地图标内容，其次自定义上传/引用、内置基础图形，最后回退首字母 */
import React, { useEffect, useState } from "react";
import { ICON_LIB_EVENT, getIconBySlug, matchIconEntry } from "../lib/iconLibrary";
import { DynIcon } from "./icons";
import { brandBg, firstGlyph } from "../lib/brands";

export const IconBlock = React.memo(function IconBlock(props: {
  url?: string;
  name: string;
  icon?: string; // brand:<slug>、内置图形键名、或 data:image/ / 本地引用路径
  size?: number; // 图形尺寸 px
  className?: string; // 容器类：ico-block / mini-ico / fq-ico
}) {
  const { url, name, icon, size = 24 } = props;
  const [imgErr, setImgErr] = useState(false);
  const [, setLibVer] = useState(0);

  const cls = props.className || "";

  useEffect(() => {
    setImgErr(false);
  }, [icon, url, name]);

  useEffect(() => {
    const onLibChange = () => setLibVer((v) => v + 1);
    window.addEventListener(ICON_LIB_EVENT, onLibChange);
    return () => window.removeEventListener(ICON_LIB_EVENT, onLibChange);
  }, []);

  // 1. 显式自定义图片内容 / 本地路径（data:image/、/assets/... 或历史 http URL）
  if (icon && (/^(data:|https?:\/\/|\/)/.test(icon)) && !imgErr) {
    return (
      <span className={`${cls} ico-site`.trim()}>
        <img
          src={icon}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgErr(true)}
        />
      </span>
    );
  }

  // 2. 自维护 D1 图标库匹配：显式 brand:<slug> 优先，否则按站点 URL / 卡片名平滑匹配
  const explicitSlug = icon?.startsWith("brand:") ? icon.slice(6) : null;
  const dbEntry = explicitSlug ? getIconBySlug(explicitSlug) : matchIconEntry(url, name);
  if (dbEntry) {
    const content = dbEntry.icon_content;
    if (content.startsWith("glyph:")) {
      return (
        <span className={cls} style={{ background: dbEntry.color || brandBg(url, name) }}>
          <DynIcon name={content.slice(6) || "globe"} size={size} />
        </span>
      );
    }
    if (!imgErr) {
      return (
        <span className={`${cls} ico-site`.trim()}>
          <img
            src={content}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgErr(true)}
          />
        </span>
      );
    }
  }

  // 3. 回退：显式内置基础线性图形（排除旧占位 "globe" 且无匹配的场景）或品牌色 + 首字母
  if (icon && !icon.startsWith("brand:") && !/^(data:|https?:\/\/|\/)/.test(icon)) {
    const glyphKey = icon.startsWith("glyph:") ? icon.slice(6) : icon;
    if (glyphKey !== "globe" || !name.trim()) {
      return (
        <span className={cls} style={{ background: brandBg(url, name) }}>
          <DynIcon name={glyphKey || "globe"} size={size} />
        </span>
      );
    }
  }

  return (
    <span className={cls} style={{ background: brandBg(url, name) }}>
      <span className="ico-glyph">{firstGlyph(name)}</span>
    </span>
  );
});
