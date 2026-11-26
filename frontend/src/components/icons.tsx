/* 单色线性图标集：1.7px 描边、currentColor，与设计规范一致 */
import React from "react";

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function make(paths: React.ReactNode, viewBox = "0 0 24 24") {
  return function Icon({ size = 16, strokeWidth = 1.7, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const IconActivity = make(<><path d="M3 12h4l3-8 4 16 3-8h4" /></>);
export const IconSearch = make(<><circle cx="11" cy="11" r="7" /><path d="M16.6 16.6 21 21" /></>);
export const IconBell = make(<><path d="M6 8a6 6 0 0 1 12 0c0 7 2 8 2 8H4s2-1 2-8" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></>);
export const IconSliders = make(<><path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h14" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>);
export const IconSun = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const IconMoon = make(<path d="M20.4 14.2A8.5 8.5 0 1 1 9.8 3.6a7 7 0 1 0 10.6 10.6Z" />);
export const IconX = make(<path d="M6 6l12 12M18 6L6 18" />);
export const IconWarn = make(<><path d="M12 3.5 22 20H2Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r="0.4" /></>);
export const IconDown = make(<><path d="M12 4v15M6 13.5 12 19.5l6-6" /></>);
export const IconUp = make(<><path d="M12 20V5M6 10.5 12 4.5l6 6" /></>);
export const IconChevron = make(<path d="m9 5 7 7-7 7" />);
export const IconRouter = make(<><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M12 14V9" /><circle cx="12" cy="6.5" r="2" /><path d="M6.5 17h.5M9.5 17h.5" /></>);
export const IconNas = make(<><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="8.5" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="8.5" cy="13" r="1" fill="currentColor" stroke="none" /><path d="M12 8h5M12 13h5M7.5 17.5h9" /></>);
export const IconGlobe = make(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3.4 2.8 14.6 0 18-2.8-3.4-2.8-14.6 0-18Z" /></>);
export const IconMail = make(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7.5 8.5 6 8.5-6" /></>);
export const IconTv = make(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="m8 3.5 3.5 3.5L15 3.5" /></>);
export const IconPlay = make(<path d="M8.5 5.5v13l10-6.5Z" />);
export const IconGit = make(<><circle cx="6.5" cy="6" r="2.5" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="6" r="2.5" /><path d="M6.5 8.5v7M17.5 8.5c0 5-6.5 4-8.7 6.6" /></>);
export const IconCloud = make(<path d="M17.5 19H9a6.5 6.5 0 1 1 6.2-8.4h2.3a4.2 4.2 0 1 1 0 8.4Z" />);
export const IconBox = make(<><path d="M21 8.2a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4a2 2 0 0 0-1 1.7v7.6a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z" /><path d="M3.3 7.3 12 12l8.7-4.7M12 22V12" /></>);
export const IconHome = make(<><path d="m3 10.8 9-7.3 9 7.3" /><path d="M5.5 9.5V20h13V9.5" /></>);
export const IconFolder = make(<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z" />);
export const IconKey = make(<><circle cx="8" cy="15" r="4.5" /><path d="m11 12 9.5-9.5M17 6l2.5 2.5M14 9l2 2" /></>);
export const IconTerminal = make(<><path d="m5 7 5 5-5 5M12 19h7" /></>);
export const IconLayers = make(<><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>);
export const IconExternalLink = make(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 13v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10" /></>);
export const IconCopy = make(<><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M5.5 15.5h-2a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 3.5 2.5h10A1.5 1.5 0 0 1 15 4v1" /></>);
export const IconLink = make(<><path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.6 5.3" /><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.4-1.4" /></>);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconTrash = make(<><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></>);
export const IconEdit = make(<><path d="M4 20h4L20.5 7.5a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 6.5 3 3" /></>);
export const IconGrip = make(<><circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none" /></>);
export const IconDownload = make(<><path d="M12 3v12M7 11l5 5 5-5" /><path d="M4 20h16" /></>);
export const IconUpload = make(<><path d="M12 15V3M7 7l5-5 5 5" /><path d="M4 20h16" /></>);
export const IconRefresh = make(<><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 3v5h-5" /></>);
export const IconLogOut = make(<><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" /><path d="M10 8l-4 4 4 4M18 12H6" /></>);
export const IconCheck = make(<path d="m4.5 12.5 5 5 10-11" />);
export const IconShield = make(<><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>);
export const IconServer = make(<><rect x="4" y="4" width="16" height="7" rx="1.5" /><rect x="4" y="13" width="16" height="7" rx="1.5" /><path d="M7.5 7.5h.01M7.5 16.5h.01" /></>);
export const IconLeaf = make(<><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>);
export const IconCalendar = make(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>);
export const IconClock = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IconFlame = make(<><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></>);
export const IconChevronDown = make(<path d="m6 9 6 6 6-6" />);
export const IconMore = make(<><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></>);
export const IconSparkles = make(<><path d="m12 3-1.8 4.6L5.5 9.5l4.7 1.9L12 16l1.8-4.6 4.7-1.9-4.7-1.9Z" /><path d="M5 17l-.8 2L2 19.8l2.2.8L5 23l.8-2.4L8 19.8 5.8 19Z" /><path d="M19 3l-.6 1.5L17 5l1.4.5L19 7l.6-1.5L21 5l-1.4-.5Z" /></>);

const MAP: Record<string, (p: IconProps) => React.JSX.Element> = {
  activity: IconActivity,
  search: IconSearch,
  bell: IconBell,
  sliders: IconSliders,
  sun: IconSun,
  moon: IconMoon,
  x: IconX,
  warn: IconWarn,
  down: IconDown,
  up: IconUp,
  chev: IconChevron,
  chevronDown: IconChevronDown,
  router: IconRouter,
  nas: IconNas,
  globe: IconGlobe,
  mail: IconMail,
  tv: IconTv,
  play: IconPlay,
  git: IconGit,
  cloud: IconCloud,
  box: IconBox,
  home: IconHome,
  folder: IconFolder,
  key: IconKey,
  terminal: IconTerminal,
  layers: IconLayers,
  link: IconLink,
  plus: IconPlus,
  trash: IconTrash,
  edit: IconEdit,
  grip: IconGrip,
  download: IconDownload,
  upload: IconUpload,
  refresh: IconRefresh,
  logout: IconLogOut,
  check: IconCheck,
  shield: IconShield,
  server: IconServer,
  leaf: IconLeaf,
  calendar: IconCalendar,
  clock: IconClock,
  flame: IconFlame,
};

export const iconKeys = Object.keys(MAP);

export function DynIcon({ name, ...rest }: IconProps & { name: string }): React.JSX.Element {
  const C = MAP[name];
  if (C) return <C {...rest} />;
  // http(s) 图标 URL
  if (/^https?:\/\//.test(name)) {
    return (
      <img
        src={name}
        width={rest.size ?? 16}
        height={rest.size ?? 16}
        alt=""
        style={{ borderRadius: 4, objectFit: "contain" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    );
  }
  return <IconGlobe {...rest} />;
}
