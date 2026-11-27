/* 图标块：优先使用对应网站真实 favicon / 自定义图片，加载失败或纯内网地址时依次回退官方矢量 / 基础图形 / 首字母 */
import React, { useEffect, useState } from "react";
import { Icon, addCollection } from "@iconify/react";
import brandIcons from "../lib/brand-icons.json";
import { BRAND_CATALOG, faviconUrlForSite, findBrandBySlug, hasOfflineBrandSvg } from "../lib/brandCatalog";
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
  icon?: string; // brand:<slug>、手绘图标名、或 http(s)/data:/api/favicon URL
  size?: number; // 图形尺寸 px
  className?: string; // 容器类：ico-block / mini-ico / fq-ico
}) {
  const { url, name, icon, size = 24 } = props;
  const [imgErr, setImgErr] = useState(false);
  const [faviconErr, setFaviconErr] = useState(false);
  const [, setLibVer] = useState(0);

  const cls = props.className || "";

  // 解析对应网站的真实图标：优先匹配 brand 库中的官方站点或卡片自身公网网址
  const explicitSlug = icon?.startsWith("brand:") ? icon.slice(6) : null;
  const matched = explicitSlug ? findBrandBySlug(explicitSlug) : matchBrand(url, name);
  const siteFaviconSrc =
    (explicitSlug ? faviconUrlForSite(matched?.defaultUrl) : null) ||
    faviconUrlForSite(url) ||
    faviconUrlForSite(matched?.defaultUrl);

  useEffect(() => {
    setImgErr(false);
  }, [icon]);

  useEffect(() => {
    setFaviconErr(false);
  }, [siteFaviconSrc]);

  useEffect(() => {
    const onLibChange = () => {
      cachedSlugColors = buildDynamicSlugColors();
      setLibVer((v) => v + 1);
    };
    window.addEventListener(ICON_LIB_EVENT, onLibChange);
    return () => window.removeEventListener(ICON_LIB_EVENT, onLibChange);
  }, []);

  // 1. 自定义图片 URL（http(s) / data: / /api/favicon），加载失败自动降级
  if (icon && (/^(https?:\/\/|data:|\/api\/favicon)/.test(icon)) && !imgErr) {
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

  // 2. 对应网站的实际 favicon（覆盖全部品牌库与公网站点，替代纯白单色/首字母图标）
  if (siteFaviconSrc && !faviconErr) {
    return (
      <span className={`${cls} ico-site`.trim()}>
        <img
          src={siteFaviconSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFaviconErr(true)}
        />
      </span>
    );
  }

  // 3. 回退：显式指定或自动匹配的 offline simple-icons 矢量图形
  const fallbackSlug = explicitSlug || matched?.slug;
  if (fallbackSlug && hasOfflineBrandSvg(fallbackSlug)) {
    const bg = cachedSlugColors.get(fallbackSlug) || matched?.color || brandBg(url, name);
    return (
      <span className={cls} style={{ background: bg }}>
        <Icon icon={`simple-icons:${fallbackSlug}`} width={size} height={size} color="#fff" />
      </span>
    );
  }

  // 4. 最终回退：基础图形或品牌色 + 首字符
  const brand = brandFor(url, name);
  const glyph = brand ? (brand.label ?? firstGlyph(name)) : icon ? null : firstGlyph(name);
  return (
    <span className={cls} style={{ background: brandBg(url, name) }}>
      {glyph ? <span className="ico-glyph">{glyph}</span> : <DynIcon name={icon || "globe"} size={size} />}
    </span>
  );
});
