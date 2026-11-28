-- NAV D1 schema
-- latest：每个采集器实例（source）一行，读取端合并（路由器插件 + NAS agent 多源架构）
CREATE TABLE IF NOT EXISTS latest (
  source TEXT PRIMARY KEY,
  updated_at INTEGER NOT NULL,
  snapshot TEXT NOT NULL
);
-- 旧库升级（单源 → 多源）：见 docs/DEPLOY.md「多源升级」

CREATE TABLE IF NOT EXISTS samples (
  ts INTEGER NOT NULL,          -- unix 秒
  device TEXT NOT NULL,
  cpu REAL,
  mem REAL,
  disk REAL,                    -- 最重磁盘用量 %
  load1 REAL,
  temp REAL,
  rx_bps REAL,
  tx_bps REAL,
  conn REAL,                    -- 连接数（conntrack / Clash）
  status TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_samples_device_ts ON samples (device, ts);
-- 旧库升级：ALTER TABLE samples ADD COLUMN conn REAL;

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  device TEXT NOT NULL,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_alerts_last_seen ON alerts (last_seen);

-- 7 天滚动日志按小时分桶（避免每分钟写 KV 耗尽免费额度，同时防止 OpenClash 轮转覆盖丢日志）
CREATE TABLE IF NOT EXISTS logs_hourly (
  bucket_ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  line_count INTEGER NOT NULL,
  lines_json TEXT NOT NULL,
  PRIMARY KEY (bucket_ts, kind)
);
CREATE INDEX IF NOT EXISTS idx_logs_hourly_updated ON logs_hourly (updated_at);

-- 管理员账号（单管理员起步，可扩展多账号；废弃旧单密码认证）
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 自维护本地图标库（整理常用网站图标入库，保存名称、分类、来源、关联站点与本地图标内容）
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
