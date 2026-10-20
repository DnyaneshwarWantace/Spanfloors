"use server";

import { revalidatePath } from "next/cache";
import { desc, eq, ilike, or, count, and, like, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { mediaUrl, removeStored, saveUpload } from "@/server/storage";

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
  createdAt: string;
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
  createdAt: m.createdAt.toISOString(),
});

/** Paged media search (used by the library page and the editor's image picker). */
export async function listMedia(opts: { q?: string; kind?: "image" | "document" | "video" | "all"; page?: number; perPage?: number }) {
  await requireUser();
  const perPage = Math.min(opts.perPage ?? 48, 120);
  const page = Math.max(opts.page ?? 1, 1);
  const where: SQL[] = [];
  if (opts.q) where.push(or(ilike(schema.media.filename, `%${opts.q}%`), ilike(schema.media.alt, `%${opts.q}%`))!);
  if (opts.kind === "image") where.push(like(schema.media.mime, "image/%"));
  if (opts.kind === "video") where.push(like(schema.media.mime, "video/%"));
  if (opts.kind === "document") where.push(like(schema.media.mime, "application/%"));
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

export async function uploadMedia(form: FormData): Promise<{ items: MediaItem[]; errors: string[] }> {
  const user = await requireUser();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const items: MediaItem[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const saved = await saveUpload(file);
      const [row] = await db
        .insert(schema.media)
        .values({ ...saved, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), uploadedBy: user.id })
        .returning();
      items.push(toItem(row));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${file.name}: upload failed`);
    }
  }
  if (items.length) await logActivity(user.id, "upload", "media", null, `Uploaded ${items.length} file${items.length > 1 ? "s" : ""}`);
  revalidatePath("/admin/media/");
  return { items, errors };
}

export async function updateMedia(id: string, data: { alt: string; caption: string }) {
  await requireUser();
  await db
    .update(schema.media)
    .set({ alt: data.alt.trim().slice(0, 300), caption: data.caption.trim().slice(0, 1000) })
    .where(eq(schema.media.id, id));
  revalidatePath("/admin/media/");
}

export async function deleteMedia(id: string) {
  const user = await requireUser();
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id));
  if (!row) return;
  await db.delete(schema.media).where(eq(schema.media.id, id));
  await removeStored(row.path);
  await logActivity(user.id, "delete", "media", id, `Deleted file ${row.filename}`);
  revalidatePath("/admin/media/");
}
