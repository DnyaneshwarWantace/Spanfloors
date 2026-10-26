"use server";

import { revalidatePath, updateTag } from "next/cache";
import { asc, count, desc, eq, ilike, inArray, like, notInArray, or, sql, and, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { existsSync } from "node:fs";
import { clearVariants, mediaUrl, overwriteStored, readReplacement, removeStored, resolveStored, saveUpload } from "@/server/storage";
import { mediaUsage, usedMediaIndex, type Usage } from "@/server/media-usage";

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  credit: string;
  focalX: number;
  focalY: number;
  fit: "cover" | "contain";
  placeholder: boolean;
  folder: string;
  createdAt: string;
  /** False for imported records whose file hasn't been copied onto this server yet. */
  available: boolean;
};

const toItem = (m: typeof schema.media.$inferSelect): MediaItem => ({
  id: m.id,
  url: mediaUrl(m.path),
  filename: m.filename,
  mime: m.mime,
  size: m.size,
  width: m.width,
  height: m.height,
  alt: m.alt,
  caption: m.caption,
  credit: m.credit,
  focalX: m.focalX,
  focalY: m.focalY,
  fit: m.fit === "contain" ? "contain" : "cover",
  placeholder: m.placeholder,
  folder: m.folder,
  createdAt: m.createdAt.toISOString(),
  available: (() => {
    const full = resolveStored(m.path);
    return Boolean(full && existsSync(full));
  })(),
});

export type MediaFilter = "all" | "unused" | "missing" | "noalt" | "placeholder";

/** Paged media search (used by the library page and every picker). */
export async function listMedia(opts: { q?: string; kind?: "image" | "document" | "video" | "all"; page?: number; perPage?: number; folder?: string | null; filter?: MediaFilter }) {
  await requireUser("media");
  const perPage = Math.min(opts.perPage ?? 48, 120);
  const page = Math.max(opts.page ?? 1, 1);
  const where: SQL[] = [];
  if (opts.q) where.push(or(ilike(schema.media.filename, `%${opts.q}%`), ilike(schema.media.alt, `%${opts.q}%`))!);
  if (opts.kind === "image") where.push(like(schema.media.mime, "image/%"));
  if (opts.kind === "video") where.push(like(schema.media.mime, "video/%"));
  if (opts.kind === "document") where.push(like(schema.media.mime, "application/%"));
  if (opts.folder != null) where.push(eq(schema.media.folder, opts.folder));
  if (opts.filter === "noalt") where.push(and(like(schema.media.mime, "image/%"), eq(schema.media.alt, ""))!);
  if (opts.filter === "placeholder") where.push(eq(schema.media.placeholder, true));
  if (opts.filter === "unused") {
    const used = await usedMediaIndex();
    const rows = await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media);
    const usedIds = rows.filter((r) => used.ids.has(r.id) || used.paths.has(r.path)).map((r) => r.id);
    if (usedIds.length) where.push(notInArray(schema.media.id, usedIds));
  }
  if (opts.filter === "missing") {
    const rows = await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media);
    const missing = rows.filter((r) => {
      const full = resolveStored(r.path);
      return !full || !existsSync(full);
    });
    where.push(missing.length ? inArray(schema.media.id, missing.map((r) => r.id)) : sql`false`);
  }
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(schema.media)
      .where(cond)
      .orderBy(desc(schema.media.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ n: count() }).from(schema.media).where(cond),
  ]);
  return { items: rows.map(toItem), total: n, page, perPage };
}

/** Folders with how many files each holds. */
export async function listFolders() {
  await requireUser("media");
  return db
    .select({ folder: schema.media.folder, n: count() })
    .from(schema.media)
    .groupBy(schema.media.folder)
    .orderBy(asc(schema.media.folder));
}

/** How many media records have their file on this server. */
export async function mediaAvailability() {
  await requireUser("media");
  const rows = await db.select({ path: schema.media.path }).from(schema.media);
  const available = rows.filter((r) => {
    const full = resolveStored(r.path);
    return Boolean(full && existsSync(full));
  }).length;
  return { total: rows.length, available };
}

/** Uploads files. A file that is already in the library (same content) is reused instead of stored twice. */
export async function uploadMedia(form: FormData): Promise<{ items: MediaItem[]; errors: string[]; reused: string[] }> {
  const user = await requireUser("media");
  const folder = String(form.get("folder") ?? "").trim().slice(0, 120);
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const items: MediaItem[] = [];
  const errors: string[] = [];
  const reused: string[] = [];
  for (const file of files) {
    try {
      const saved = await saveUpload(file);
      const [dup] = await db.select().from(schema.media).where(eq(schema.media.sha256, saved.sha256)).limit(1);
      if (dup && resolveStored(dup.path) && existsSync(resolveStored(dup.path)!)) {
        await removeStored(saved.path);
        items.push(toItem(dup));
        reused.push(`${file.name} is already in the library as “${dup.filename}”, so that file was used.`);
        continue;
      }
      const [row] = await db
        .insert(schema.media)
        .values({ ...saved, folder, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), uploadedBy: user.id })
        .returning();
      items.push(toItem(row));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${file.name}: upload failed`);
    }
  }
  const added = items.length - reused.length;
  if (added) await logActivity(user.id, "upload", "media", null, `Uploaded ${added} file${added > 1 ? "s" : ""}`);
  revalidatePath("/admin/media/");
  return { items, errors, reused };
}

export type MediaUpdate = { alt: string; caption: string; credit?: string; focalX?: number; focalY?: number; fit?: "cover" | "contain"; placeholder?: boolean; folder?: string };

export async function updateMedia(id: string, data: MediaUpdate) {
  await requireUser("media");
  const pct = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : undefined);
  await db
    .update(schema.media)
    .set({
      alt: data.alt.trim().slice(0, 300),
      caption: data.caption.trim().slice(0, 1000),
      ...(data.credit != null ? { credit: data.credit.trim().slice(0, 200) } : {}),
      ...(pct(data.focalX) != null ? { focalX: pct(data.focalX) } : {}),
      ...(pct(data.focalY) != null ? { focalY: pct(data.focalY) } : {}),
      ...(data.fit ? { fit: data.fit === "contain" ? "contain" : "cover" } : {}),
      ...(data.placeholder != null ? { placeholder: Boolean(data.placeholder) } : {}),
      ...(data.folder != null ? { folder: data.folder.trim().slice(0, 120) } : {}),
    })
    .where(eq(schema.media.id, id));
  updateTag("content");
  revalidatePath("/admin/media/");
}

/** Where a file is used (shown before it can be deleted). */
export async function getUsage(id: string): Promise<Usage[]> {
  await requireUser("media");
  const [row] = await db.select({ path: schema.media.path }).from(schema.media).where(eq(schema.media.id, id));
  return row ? mediaUsage(id, row.path) : [];
}

/** Deletes a file, unless it is still used somewhere. */
export async function deleteMedia(id: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser("media");
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id));
  if (!row) return { ok: true };
  const used = await mediaUsage(id, row.path);
  if (used.length) return { error: `It's used on ${used.length} page${used.length === 1 ? "" : "s"} or setting${used.length === 1 ? "" : "s"}. Remove it there first.` };
  await db.delete(schema.media).where(eq(schema.media.id, id));
  await removeStored(row.path);
  await clearVariants(row.path);
  await logActivity(user.id, "delete", "media", id, `Deleted file ${row.filename}`);
  revalidatePath("/admin/media/");
  return { ok: true };
}

/** Swaps the file behind a media record. The address stays the same, so every page shows the new file. */
export async function replaceMedia(form: FormData): Promise<{ item?: MediaItem; error?: string }> {
  const user = await requireUser("media");
  const id = String(form.get("id") ?? "");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file." };
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id));
  if (!row) return { error: "That file no longer exists." };
  try {
    const next = await readReplacement(file, row.mime);
    await overwriteStored(row.path, next.buf);
    const [updated] = await db
      .update(schema.media)
      .set({ size: next.size, width: next.width, height: next.height, sha256: next.sha256 })
      .where(eq(schema.media.id, id))
      .returning();
    await logActivity(user.id, "update", "media", id, `Replaced the file behind ${row.filename}`);
    updateTag("content");
    revalidatePath("/", "layout");
    return { item: toItem(updated) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The file couldn't be replaced." };
  }
}

/** Sets alt text or folder on many files at once. */
export async function bulkUpdateMedia(ids: string[], data: { alt?: string; folder?: string; onlyEmptyAlt?: boolean }) {
  const user = await requireUser("media");
  const list = ids.filter((i) => /^[0-9a-f-]{36}$/.test(i)).slice(0, 500);
  if (!list.length) return { updated: 0 };
  const set: Partial<typeof schema.media.$inferInsert> = {};
  if (data.folder != null) set.folder = data.folder.trim().slice(0, 120);
  if (data.alt != null) set.alt = data.alt.trim().slice(0, 300);
  if (!Object.keys(set).length) return { updated: 0 };
  const where = data.alt != null && data.onlyEmptyAlt ? and(inArray(schema.media.id, list), eq(schema.media.alt, "")) : inArray(schema.media.id, list);
  const res = await db.update(schema.media).set(set).where(where).returning({ id: schema.media.id });
  await logActivity(user.id, "update", "media", null, `Updated ${res.length} files at once`);
  revalidatePath("/admin/media/");
  return { updated: res.length };
}

/** Deletes many files at once; files that are still used are skipped. */
export async function bulkDeleteMedia(ids: string[]) {
  const user = await requireUser("media");
  const list = ids.filter((i) => /^[0-9a-f-]{36}$/.test(i)).slice(0, 500);
  const used = await usedMediaIndex();
  const rows = list.length ? await db.select().from(schema.media).where(inArray(schema.media.id, list)) : [];
  let deleted = 0;
  let skipped = 0;
  for (const r of rows) {
    if (used.ids.has(r.id) || used.paths.has(r.path)) {
      skipped++;
      continue;
    }
    await db.delete(schema.media).where(eq(schema.media.id, r.id));
    await removeStored(r.path);
    await clearVariants(r.path);
    deleted++;
  }
  if (deleted) await logActivity(user.id, "delete", "media", null, `Deleted ${deleted} unused files`);
  revalidatePath("/admin/media/");
  return { deleted, skipped };
}
