/* 自维护图标基础类型与辅助（主数据统一存放在云端 D1 icon_library，不再内嵌上游 simple-icons 包） */
import type { IconLibraryCategory } from "./iconLibrary";

export type BrandCategory = Exclude<IconLibraryCategory, "自定义">;
