/* 预设壁纸：全部为内联 CSS 渐变（无外部图片依赖，离线可用） */
export interface WallpaperPreset {
  id: string;
  name: string;
  css: string; // background 值
}

export const wallpapers: WallpaperPreset[] = [
  { id: "none", name: "无（纯极光）", css: "" },
  {
    id: "meadow",
    name: "晨曦草原",
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900' preserveAspectRatio='xMidYMid slice'%3E%3Cdefs%3E%3ClinearGradient id='sky' x1='0' y1='0' x2='0.2' y2='1'%3E%3Cstop offset='0%25' stop-color='%235b7379'/%3E%3Cstop offset='32%25' stop-color='%23a68d70'/%3E%3Cstop offset='56%25' stop-color='%23e2a76f'/%3E%3Cstop offset='72%25' stop-color='%23c88c5a'/%3E%3C/linearGradient%3E%3CradialGradient id='sun' cx='26%25' cy='38%25' r='36%25'%3E%3Cstop offset='0%25' stop-color='%23ffe3a8' stop-opacity='0.85'/%3E%3Cstop offset='45%25' stop-color='%23f5b271' stop-opacity='0.45'/%3E%3Cstop offset='100%25' stop-color='%23f5b271' stop-opacity='0'/%3E%3C/radialGradient%3E%3ClinearGradient id='h1' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%236b7b43'/%3E%3Cstop offset='100%25' stop-color='%233d5329'/%3E%3C/linearGradient%3E%3ClinearGradient id='h2' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%233e5c2c'/%3E%3Cstop offset='100%25' stop-color='%231d3418'/%3E%3C/linearGradient%3E%3ClinearGradient id='h3' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%2325411c'/%3E%3Cstop offset='100%25' stop-color='%230f200e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1600' height='900' fill='url(%23sky)'/%3E%3Crect width='1600' height='900' fill='url(%23sun)'/%3E%3Cpath d='M0 490 Q280 420 560 470 T1160 455 T1600 480 L1600 900 L0 900 Z' fill='url(%23h1)'/%3E%3Cpath d='M0 570 Q340 495 720 560 T1320 535 T1600 565 L1600 900 L0 900 Z' fill='url(%23h2)'/%3E%3Cpath d='M0 675 Q420 595 860 665 T1600 635 L1600 900 L0 900 Z' fill='url(%23h3)'/%3E%3C/svg%3E")`,
  },
  {
    id: "aurora",
    name: "极光夜空",
    css: "radial-gradient(ellipse at 20% 20%, rgba(67, 224, 160, 0.34) 0%, transparent 50%), radial-gradient(ellipse at 78% 30%, rgba(74, 144, 226, 0.32) 0%, transparent 55%), linear-gradient(160deg, #09131d 0%, #0f2537 48%, #0a1824 100%)",
  },
  {
    id: "sunset",
    name: "落日山峦",
    css: "radial-gradient(circle at 70% 22%, rgba(255, 179, 107, 0.45) 0%, transparent 45%), linear-gradient(180deg, #2d254c 0%, #7b3e62 42%, #d17b68 74%, #211b2e 100%)",
  },
  {
    id: "ocean",
    name: "碧海微光",
    css: "radial-gradient(ellipse at 30% 15%, rgba(125, 227, 242, 0.35) 0%, transparent 50%), linear-gradient(170deg, #0d2b45 0%, #155263 48%, #0c2233 100%)",
  },
  {
    id: "nebula",
    name: "暮色星云",
    css: "radial-gradient(ellipse at 22% 28%, rgba(168, 85, 247, 0.32) 0%, transparent 52%), radial-gradient(ellipse at 80% 72%, rgba(56, 189, 248, 0.26) 0%, transparent 52%), linear-gradient(150deg, #0f1024 0%, #1d1638 55%, #0c1424 100%)",
  },
  {
    id: "grid",
    name: "网格",
    css: "radial-gradient(var(--border-2) 1px, transparent 1px)",
  },
  {
    id: "dune",
    name: "沙丘",
    css: "linear-gradient(160deg, rgba(230,179,87,.18) 0%, transparent 45%), linear-gradient(20deg, rgba(67,224,160,.12) 0%, transparent 55%), linear-gradient(180deg, #1b1814 0%, #101418 100%)",
  },
  {
    id: "tide",
    name: "夜潮",
    css: "linear-gradient(180deg, rgba(67,224,160,.16) 0%, transparent 42%), linear-gradient(0deg, rgba(29,84,120,.24) 0%, transparent 48%), linear-gradient(180deg, #0b131c 0%, #090e14 100%)",
  },
  {
    id: "ember",
    name: "余烬",
    css: "linear-gradient(135deg, rgba(229,100,108,.18) 0%, transparent 46%), linear-gradient(315deg, rgba(230,179,87,.14) 0%, transparent 50%), linear-gradient(180deg, #1a1114 0%, #0e1015 100%)",
  },
];

export function wallpaperStyle(idOrUrl: string | null): string {
  if (!idOrUrl || idOrUrl === "none") return "";
  const preset = wallpapers.find((w) => w.id === idOrUrl);
  if (preset) {
    if (preset.id === "grid") return "background-image: " + preset.css + "; background-size: 28px 28px;";
    return "background-image: " + preset.css + ";";
  }
  if (/^https?:\/\//.test(idOrUrl)) return `background-image: url('${idOrUrl}'); background-size: cover; background-position: center;`;
  return "";
}

/** 返回 backgroundImage 的值（供 .wallpaper 层内联使用） */
export function wallpaperImage(idOrUrl: string | null): string {
  if (!idOrUrl || idOrUrl === "none") return "";
  const preset = wallpapers.find((w) => w.id === idOrUrl);
  if (preset) return preset.css;
  if (/^https?:\/\//.test(idOrUrl)) return `url('${idOrUrl}')`;
  return "";
}

/** 按名称稳定取色（WeTab 式品牌色块的回退色；品牌命中见 lib/brands.ts） */
export function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
