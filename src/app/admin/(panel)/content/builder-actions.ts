"use server";

import { existsSync } from "node:fs";
import { updateTag } from "next/cache";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { mediaUrl, resolveStored } from "@/server/storage";
import { CATEGORIES, displayName, getFullCatalog, getCategory, productImages } from "@/lib/catalog";
import { cleanSections } from "@/sections/clean";
import type { Section } from "@/sections/types";

/* Server actions used by the page builder (Admin → Pages / Blog → sections). */

export type PickedMedia = { id: string; url: string; alt: string; filename: string; mime: string; available: boolean; width: number | null; height: number | null };

/** Thumbnails and names for media already chosen in sections. */
export async function mediaByIds(ids: string[]): Promise<PickedMedia[]> {
  await requireUser("content");
  const clean = [...new Set(ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i)))].slice(0, 500);
  if (!clean.length) return [];
  const rows = await db.select().from(schema.media).where(inArray(schema.media.id, clean));
  return rows.map((m) => {
    const full = resolveStored(m.path);
    return { id: m.id, url: mediaUrl(m.path), alt: m.alt, filename: m.filename, mime: m.mime, available: Boolean(full && existsSync(full)), width: m.width, height: m.height };
  });
}

export type PickerProduct = { id: string; name: string; collection: string; image: string | null; hidden: boolean; featured: boolean };

/** Every product from Twenty for the product picker (read-only). */
export async function pickerProducts(): Promise<{ products: PickerProduct[]; error?: string }> {
  await requireUser("content");
  try {
    const all = await getFullCatalog();
    return {
      products: all.map((p) => ({ id: p.id, name: displayName(p), collection: getCategory(p.categoryKey).title, image: productImages(p)[0] ?? null, hidden: p.hidden, featured: p.featured })),
    };
  } catch {
    return { products: [], error: "Products couldn't be loaded from Twenty right now. Try again in a minute." };
  }
}

export type LinkTarget = { href: string; label: string; kind: string };

/** Page, post and collection suggestions for link fields. */
export async function searchLinkTargets(q: string): Promise<LinkTarget[]> {
  await requireUser("content");
  const term = q.trim().slice(0, 80);
  const fixed: LinkTarget[] = [
    { href: "/", label: "Home", kind: "Site page" },
    { href: "/blog/", label: "Blog", kind: "Site page" },
    ...CATEGORIES.map((c) => ({ href: `/${c.slug}/`, label: c.title, kind: "Collection" })),
  ];
  const match = (t: LinkTarget) => !term || t.label.toLowerCase().includes(term.toLowerCase()) || t.href.includes(term.toLowerCase());
  const rows = await db
    .select({ path: schema.content.path, title: schema.content.title, type: schema.content.type })
    .from(schema.content)
    .where(
      and(
        isNull(schema.content.systemKey),
        inArray(schema.content.status, ["published", "scheduled"]),
        term ? or(ilike(schema.content.title, `%${term}%`), ilike(schema.content.path, `%${term}%`)) : undefined,
      ),
    )
    .orderBy(desc(schema.content.updatedAt))
    .limit(12);
  return [...fixed.filter(match), ...rows.map((r) => ({ href: r.path, label: r.title, kind: r.type === "post" ? "Blog post" : "Page" }))].slice(0, 16);
}

/* ---------- Reusable sections ---------- */

export type ReusableItem = { id: string; name: string; type: string; data: Record<string, unknown>; updatedAt: string };

export async function listReusable(): Promise<ReusableItem[]> {
  await requireUser("content");
  const rows = await db.select().from(schema.reusableSections).orderBy(asc(schema.reusableSections.name));
  return rows.map((r) => ({ id: r.id, name: r.name, type: r.section.type, data: r.section.data, updatedAt: r.updatedAt.toISOString() }));
}

/** Pages and posts that place this reusable section. */
export async function reusableUsage(id: string) {
  await requireUser("content");
  return db
    .select({ id: schema.content.id, title: schema.content.title, type: schema.content.type, path: schema.content.path })
    .from(schema.content)
    .where(sql`${schema.content.layout} @> ${JSON.stringify([{ type: "reusable", data: { ref: id } }])}::jsonb`);
}

function cleanOne(section: unknown): { section?: Section; error?: string } {
  const { sections, problems } = cleanSections([section], "page");
  const s = sections[0];
  if (!s) return { error: problems[0] ?? "That section can't be saved." };
  if (s.type === "reusable") return { error: "A reusable section can't contain another reusable section." };
  return { section: s };
}

export async function saveAsReusable(name: string, section: unknown): Promise<{ id?: string; error?: string }> {
  const user = await requireUser("content.all");
  const n = name.trim().slice(0, 80);
  if (!n) return { error: "Give the reusable section a name." };
  const { section: s, error } = cleanOne(section);
  if (!s) return { error };
  const [row] = await db
    .insert(schema.reusableSections)
    .values({ name: n, section: { type: s.type, data: s.data }, createdBy: user.id, updatedBy: user.id })
    .returning({ id: schema.reusableSections.id });
  await logActivity(user.id, "create", "reusable", row.id, `Saved reusable section “${n}”`);
  return { id: row.id };
}

export async function updateReusable(id: string, name: string, section: unknown): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser("content.all");
  const n = name.trim().slice(0, 80);
  if (!n) return { error: "Give the reusable section a name." };
  const { section: s, error } = cleanOne(section);
  if (!s) return { error };
  await db.update(schema.reusableSections).set({ name: n, section: { type: s.type, data: s.data }, updatedBy: user.id, updatedAt: new Date() }).where(eq(schema.reusableSections.id, id));
  await logActivity(user.id, "update", "reusable", id, `Updated reusable section “${n}”`);
  updateTag("content");
  return { ok: true };
}

export async function deleteReusable(id: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser("content.all");
  const used = await reusableUsage(id);
  if (used.length) return { error: `It is used on ${used.length} page${used.length === 1 ? "" : "s"}. Remove it from ${used.length === 1 ? "that page" : "those pages"} first.` };
  const [row] = await db.delete(schema.reusableSections).where(eq(schema.reusableSections.id, id)).returning({ name: schema.reusableSections.name });
  if (row) await logActivity(user.id, "delete", "reusable", id, `Deleted reusable section “${row.name}”`);
  return { ok: true };
}
