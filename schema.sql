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
