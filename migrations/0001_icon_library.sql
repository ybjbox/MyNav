-- 迁移：创建自维护图标库表 icon_library（初始化数据会在 /api/icons 首次访问时自动导入，也可手动维护）
CREATE TABLE IF NOT EXISTS icon_library (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  site_url TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#3261e3',
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  icon_content TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_icon_library_cat ON icon_library (category, slug);
