/* 自维护图标库（D1 icon_library）：自动建表与种子初始化、CRUD、重置与旧本地数据迁移 */
import iconSeed from "./iconSeed.json";
import { Env, err, json, rateLimited, requireAdmin } from "./_shared";

export interface IconLibraryRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  source: string;
  site_url: string;
  color: string;
  mime_type: string;
  icon_content: string;
  builtin: number;
  created_at: number;
  updated_at: number;
}

interface IconSeedItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  source: string;
  site_url: string;
  color: string;
  mime_type: string;
  icon_content: string;
  builtin: number;
}

const VALID_CATEGORIES = new Set(["常用", "AI", "开发", "影音", "自托管", "自定义"]);
const KV_SEEDED_KEY = "icons:seeded:v1";
const MAX_CONTENT_LEN = 160 * 1024;
let ensuredInIsolate = false;

function normalizeSlug(raw: string, fallbackName: string): string {
  const base = (raw || fallbackName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || `ico-${Date.now().toString(36)}`).slice(0, 64);
}

function inferMimeType(content: string): string {
  if (content.startsWith("data:")) {
    const m = content.match(/^data:([^;,]+)/i);
    if (m) return m[1].toLowerCase();
  }
  if (content.startsWith("glyph:")) return "text/x-glyph";
  if (content.endsWith(".svg")) return "image/svg+xml";
  if (content.endsWith(".ico")) return "image/x-icon";
  if (content.endsWith(".webp")) return "image/webp";
  return "image/png";
}

function validateIconContent(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.length > MAX_CONTENT_LEN) return null;
  if (/^data:image\/(png|jpeg|jpg|webp|gif|x-icon|vnd\.microsoft\.icon|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(s)) {
    return s;
  }
  if (/^glyph:[a-z0-9_-]{1,32}$/i.test(s)) {
    return s.toLowerCase();
  }
  if (/^\/[a-zA-Z0-9._\-/]+$/.test(s)) {
    return s;
  }
  if (/^https?:\/\//i.test(s) && !/[\s"'<>]/.test(s)) {
    return s;
  }
  return null;
}

function toDto(row: IconLibraryRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    source: row.source,
    site_url: row.site_url,
    color: row.color,
    mime_type: row.mime_type,
    icon_content: row.icon_content,
    builtin: Boolean(row.builtin),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function seedBuiltinIcons(env: Env): Promise<void> {
  const seeds = iconSeed as IconSeedItem[];
  const now = Date.now();
  const stmt = env.DB.prepare(
    "INSERT OR IGNORE INTO icon_library (id, slug, name, category, source, site_url, color, mime_type, icon_content, builtin, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  // 分批写入，每批最多 25 条，控制 D1 单批延迟与资源占用
  for (let i = 0; i < seeds.length; i += 25) {
    const chunk = seeds.slice(i, i + 25);
    await env.DB.batch(
      chunk.map((item) =>
        stmt.bind(
          item.id,
          item.slug,
          item.name,
          item.category,
          item.source,
          item.site_url || "",
          item.color || "#3261e3",
          item.mime_type || "image/png",
          item.icon_content,
          1,
          now,
          now,
        ),
      ),
    );
  }
  await env.KV.put(KV_SEEDED_KEY, String(now));
}

export async function ensureIconLibraryReady(env: Env): Promise<void> {
  if (!ensuredInIsolate) {
    await env.DB.batch([
      env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS icon_library (" +
          "id TEXT PRIMARY KEY, " +
          "slug TEXT NOT NULL UNIQUE, " +
          "name TEXT NOT NULL, " +
          "category TEXT NOT NULL, " +
          "source TEXT NOT NULL, " +
          "site_url TEXT NOT NULL DEFAULT '', " +
          "color TEXT NOT NULL DEFAULT '#3261e3', " +
          "mime_type TEXT NOT NULL DEFAULT 'image/png', " +
          "icon_content TEXT NOT NULL, " +
          "builtin INTEGER NOT NULL DEFAULT 1, " +
          "created_at INTEGER NOT NULL, " +
          "updated_at INTEGER NOT NULL)",
      ),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_icon_library_cat ON icon_library (category, slug)"),
    ]);
    ensuredInIsolate = true;
  }

  const row = await env.DB.prepare("SELECT COUNT(*) AS cnt FROM icon_library").first<{ cnt: number }>();
  if ((row?.cnt ?? 0) === 0) {
    await seedBuiltinIcons(env);
    return;
  }
  const seeded = await env.KV.get(KV_SEEDED_KEY);
  if (!seeded) {
    await seedBuiltinIcons(env);
  }
}

/* ---------- GET /api/icons ---------- */
export async function listIcons(req: Request, env: Env): Promise<Response> {
  await ensureIconLibraryReady(env);
  const url = new URL(req.url);
  const category = (url.searchParams.get("category") || "").trim();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  const res = await env.DB.prepare(
    "SELECT id, slug, name, category, source, site_url, color, mime_type, icon_content, builtin, created_at, updated_at " +
      "FROM icon_library ORDER BY builtin ASC, category ASC, created_at ASC, name ASC",
  ).all<IconLibraryRow>();

  const rows = (res.results || []).filter((r) => {
    if (category && category !== "全部" && r.category !== category) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      r.source.toLowerCase().includes(q) ||
      r.site_url.toLowerCase().includes(q)
    );
  });

  return json({
    icons: rows.map(toDto),
    total: rows.length,
    storage: "d1",
  });
}

/* ---------- POST /api/icons ---------- */
export async function createIcon(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  if (await rateLimited(env, req, "rl:icons", 60)) return err(429, "操作过于频繁");
  await ensureIconLibraryReady(env);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err(400, "JSON 格式错误");
  }

  const name = String(body.name || "").trim().slice(0, 48);
  const category = VALID_CATEGORIES.has(String(body.category || "")) ? String(body.category) : "自定义";
  const source = String(body.source || "自定义整理").trim().slice(0, 80) || "自定义整理";
  const siteUrl = String(body.site_url || "").trim().slice(0, 240);
  const rawColor = String(body.color || "").trim();
  const color = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : "#3261e3";
  const content = validateIconContent(String(body.icon_content || ""));
  if (!name) return err(400, "请填写图标名称");
  if (!content) return err(400, "图标内容无效或超过 160KB（请上传裁剪图标、内置图形或有效路径）");

  const now = Date.now();
  const baseSlug = normalizeSlug(String(body.slug || ""), name);
  const slugExists = await env.DB.prepare("SELECT id FROM icon_library WHERE slug = ?").bind(baseSlug).first();
  const slug = slugExists ? `${baseSlug}-${now.toString(36).slice(-4)}` : baseSlug;
  const id = String(body.id || "").trim().slice(0, 64) || `ico-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const mimeType = inferMimeType(content);

  await env.DB.prepare(
    "INSERT INTO icon_library (id, slug, name, category, source, site_url, color, mime_type, icon_content, builtin, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
  )
    .bind(id, slug, name, category, source, siteUrl, color, mimeType, content, now, now)
    .run();

  const created = await env.DB.prepare("SELECT * FROM icon_library WHERE id = ?").bind(id).first<IconLibraryRow>();
  return json({ ok: true, icon: created ? toDto(created) : null }, 201);
}

/* ---------- PUT /api/icons ---------- */
export async function updateIcon(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  if (await rateLimited(env, req, "rl:icons", 60)) return err(429, "操作过于频繁");
  await ensureIconLibraryReady(env);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err(400, "JSON 格式错误");
  }

  const id = String(body.id || "").trim();
  if (!id) return err(400, "缺少图标 ID");
  const existing = await env.DB.prepare("SELECT * FROM icon_library WHERE id = ?").bind(id).first<IconLibraryRow>();
  if (!existing) return err(404, "图标不存在");

  const name = String(body.name || existing.name).trim().slice(0, 48);
  const category = VALID_CATEGORIES.has(String(body.category || "")) ? String(body.category) : existing.category;
  const source = String(body.source ?? existing.source).trim().slice(0, 80) || existing.source;
  const siteUrl = String(body.site_url ?? existing.site_url).trim().slice(0, 240);
  const rawColor = String(body.color ?? existing.color).trim();
  const color = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : existing.color;
  const content = body.icon_content !== undefined ? validateIconContent(String(body.icon_content)) : existing.icon_content;
  if (!name) return err(400, "请填写图标名称");
  if (!content) return err(400, "图标内容无效或超过 160KB");

  const now = Date.now();
  const mimeType = inferMimeType(content);
  await env.DB.prepare(
    "UPDATE icon_library SET name = ?, category = ?, source = ?, site_url = ?, color = ?, mime_type = ?, icon_content = ?, updated_at = ? WHERE id = ?",
  )
    .bind(name, category, source, siteUrl, color, mimeType, content, now, id)
    .run();

  const updated = await env.DB.prepare("SELECT * FROM icon_library WHERE id = ?").bind(id).first<IconLibraryRow>();
  return json({ ok: true, icon: updated ? toDto(updated) : null });
}

/* ---------- DELETE /api/icons ---------- */
export async function deleteIcon(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  await ensureIconLibraryReady(env);

  const url = new URL(req.url);
  let id = (url.searchParams.get("id") || "").trim();
  if (!id) {
    try {
      const body = (await req.json()) as { id?: string };
      id = String(body.id || "").trim();
    } catch {
      /* 忽略空请求体 */
    }
  }
  if (!id) return err(400, "缺少图标 ID");

  const r = await env.DB.prepare("DELETE FROM icon_library WHERE id = ?").bind(id).run();
  return json({ ok: true, deleted: r.meta?.changes || 0 });
}

/* ---------- POST /api/icons/reset ---------- */
export async function resetIcons(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  await ensureIconLibraryReady(env);

  await env.DB.prepare("DELETE FROM icon_library").run();
  await env.KV.delete(KV_SEEDED_KEY);
  await seedBuiltinIcons(env);

  const res = await env.DB.prepare(
    "SELECT id, slug, name, category, source, site_url, color, mime_type, icon_content, builtin, created_at, updated_at " +
      "FROM icon_library ORDER BY builtin ASC, category ASC, created_at ASC, name ASC",
  ).all<IconLibraryRow>();

  return json({ ok: true, icons: (res.results || []).map(toDto), total: (res.results || []).length });
}

/* ---------- POST /api/icons/migrate（从旧 localStorage 导入自定义图标） ---------- */
export async function migrateIcons(req: Request, env: Env): Promise<Response> {
  const { authed } = await requireAdmin(req, env);
  if (!authed) return err(401, "未登录");
  await ensureIconLibraryReady(env);

  let body: { icons?: unknown[] };
  try {
    body = (await req.json()) as { icons?: unknown[] };
  } catch {
    return err(400, "JSON 格式错误");
  }
  if (!Array.isArray(body.icons)) return err(400, "icons 必须是数组");

  const now = Date.now();
  let imported = 0;
  for (const raw of body.icons.slice(0, 100)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (item.builtin === true) continue;
    const name = String(item.name || "").trim().slice(0, 48);
    if (!name) continue;
    const rawIcon = String(item.icon_content || item.icon || "").trim();
    const normalized = rawIcon && !rawIcon.includes(":") && !rawIcon.startsWith("/") ? `glyph:${rawIcon}` : rawIcon;
    const content = validateIconContent(normalized);
    if (!content) continue;
    const category = VALID_CATEGORIES.has(String(item.category || "")) ? String(item.category) : "自定义";
    const siteUrl = String(item.site_url || item.defaultUrl || "").trim().slice(0, 240);
    const source = String(item.source || (siteUrl ? "旧版导入" : "本地上传")).trim().slice(0, 80);
    const rawColor = String(item.color || "").trim();
    const color = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : "#3261e3";
    const id = String(item.id || "").trim().slice(0, 64) || `ico-mig-${now.toString(36)}-${imported}`;
    const slug = normalizeSlug(String(item.slug || id), name);
    const r = await env.DB.prepare(
      "INSERT OR IGNORE INTO icon_library (id, slug, name, category, source, site_url, color, mime_type, icon_content, builtin, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
    )
      .bind(id, slug, name, category, source, siteUrl, color, inferMimeType(content), content, now, now)
      .run();
    imported += r.meta?.changes || 0;
  }

  const res = await env.DB.prepare(
    "SELECT id, slug, name, category, source, site_url, color, mime_type, icon_content, builtin, created_at, updated_at " +
      "FROM icon_library ORDER BY builtin ASC, category ASC, created_at ASC, name ASC",
  ).all<IconLibraryRow>();

  return json({ ok: true, imported, icons: (res.results || []).map(toDto) });
}
