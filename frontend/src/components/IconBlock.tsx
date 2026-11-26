/* WeTab 式品牌图标块：优先使用官方 simple-icons 矢量品牌图标（本地离线包），
 * 其次品牌纯色底 + 白色手绘图标/品牌字。 */
import React, { useEffect, useState } from "react";
import { Icon, addCollection } from "@iconify/react";
import brandIcons from "../lib/brand-icons.json";
import { BRAND_CATALOG } from "../lib/brandCatalog";
import { ICON_LIB_EVENT, loadIconLibrary } from "../lib/iconLibrary";
import { DynIcon } from "./icons";
import { brandFor, brandBg, firstGlyph, matchBrand } from "../lib/brands";

addCollection(brandIcons as never);

const STATIC_COLOR_BY_SLUG = new Map(BRAND_CATALOG.map((b) => [b.slug, b.color]));

function buildDynamicSlugColors(): Map<string, string> {
  const m = new Map(STATIC_COLOR_BY_SLUG);
  for (const e of loadIconLibrary()) {
    if (e.icon.startsWith("brand:") && e.color) {
      m.set(e.icon.slice(6), e.color);
    }
  }
  return m;
}

let cachedSlugColors = buildDynamicSlugColors();

export const IconBlock = React.memo(function IconBlock(props: {
  url?: string;
  name: string;
  icon?: string; // brand:<slug>、手绘图标名、或 http(s)/data: URL
  size?: number; // 图形尺寸 px
  className?: string; // 容器类：ico-block / mini-ico / fq-ico
}) {
  const { url, name, icon, size = 24 } = props;
  const [imgErr, setImgErr] = useState(false);
  const [, setLibVer] = useState(0);

  useEffect(() => {
    setImgErr(false);
  }, [icon]);

  useEffect(() => {
    const onLibChange = () => {
      cachedSlugColors = buildDynamicSlugColors();
      setLibVer((v) => v + 1);
    };
    window.addEventListener(ICON_LIB_EVENT, onLibChange);
    return () => window.removeEventListener(ICON_LIB_EVENT, onLibChange);
  }, []);

  // 1. 显式指定 brand:<slug>
  if (icon?.startsWith("brand:")) {
    const slug = icon.slice(6);
    const bg = cachedSlugColors.get(slug) || brandBg(url, name);
    return (
      <span className={props.className} style={{ background: bg }}>
        <Icon icon={`simple-icons:${slug}`} width={size} height={size} color="#fff" />
      </span>
    );
  }

  // 2. 自定义图片 URL（http(s) / data:），加载失败自动降级
  if (icon && (/^https?:\/\//.test(icon) || icon.startsWith("data:")) && !imgErr) {
    return (
      <span className={props.className} style={{ background: brandBg(url, name) }}>
        <img
          src={icon}
          width={size}
          height={size}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgErr(true)}
          style={{ borderRadius: 6, objectFit: "contain" }}
        />
      </span>
    );
  }

  // 3. 自动匹配官方品牌库（URL 域名或卡片名）
  const matched = matchBrand(url, name);
  if (matched) {
    return (
      <span className={props.className} style={{ background: matched.color }}>
        <Icon icon={`simple-icons:${matched.slug}`} width={size} height={size} color="#fff" />
      </span>
    );
  }

  // 4. 回退：品牌文字块 / 手绘线性图标 / 首字符
  const brand = brandFor(url, name);
  const glyph = brand ? (brand.label ?? firstGlyph(name)) : icon ? null : firstGlyph(name);
  return (
    <span className={props.className} style={{ background: brandBg(url, name) }}>
      {glyph ? <span className="ico-glyph">{glyph}</span> : <DynIcon name={icon || "globe"} size={size} />}
    </span>
  );
});
