"use server";

import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser, type SessionUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { normalizePath, sanitizeBody } from "@/server/html";
import { createPreview, SHARED_PREVIEW_DAYS } from "@/server/previews";
import { saveRevision, REVISION_FIELDS } from "@/server/revisions";
import { cleanSections } from "@/sections/clean";
import { cleanAeo } from "@/server/aeo";
import { SITE_URL } from "@/lib/seo";
import type { Section } from "@/sections/types";
import { updateTag, revalidatePath } from "next/cache";

/* Preview, share, version history and "also editing" for the page/post editor. */

async function loadEditable(user: SessionUser, id: string) {
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, id));
  if (!row) return null;
  if (!can(user.role, "content.all") && (row.type !== "post" || row.authorId !== user.id || row.systemKey)) return null;
  return row;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Turns the editor's current (unsaved) form into a preview. */
export async function previewFromForm(form: FormData): Promise<{ id?: string; error?: string }> {
  const user = await requireUser("content");
  const id = str(form, "id") || null;
  const row = id ? await loadEditable(user, id) : null;
  if (id && !row) return { error: "You can't preview this item." };
  const type = row?.type ?? (str(form, "type") === "page" ? "page" : "post");
  let layout: unknown = [];
  try {
    layout = JSON.parse(String(form.get("layout") ?? "[]"));
  } catch {}
  const data = {
    type,
    title: str(form, "title") || "Untitled",
    path: row?.systemKey ? row.path : normalizePath(str(form, "path") || str(form, "title") || "preview"),
    body: sanitizeBody(String(form.get("body") ?? "")),
    layout: cleanSections(layout, row?.systemKey ? "system" : type).sections,
    excerpt: str(form, "excerpt"),
    featuredMediaId: str(form, "featuredMediaId") || null,
    publishedAt: str(form, "publishedAt") ? new Date(str(form, "publishedAt")).toISOString() : (row?.publishedAt?.toISOString() ?? null),
    seoDescription: str(form, "seoDescription"),
    tags: str(form, "tags").split(",").map((t) => t.trim()).filter(Boolean),
    authorName: form.has("authorName") ? str(form, "authorName") || null : (row?.authorName ?? null),
    contentId: id,
    relatedIds: str(form, "relatedIds").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)),
    updatedAt: new Date().toISOString(),
    aeo: (() => {
      try {
        return cleanAeo(JSON.parse(String(form.get("aeo") ?? "{}")));
      } catch {
        return {};
      }
    })(),
    schemaType: str(form, "schemaType"),
  };
  const p = await createPreview({ contentId: id, data, userId: user.id });
  return { id: p.id };
}

/** Makes a preview open without signing in, for a week. Returns the full link. */
export async function sharePreview(previewId: string): Promise<{ url?: string; expiresAt?: string; error?: string }> {
  const user = await requireUser("content");
  const expiresAt = new Date(Date.now() + SHARED_PREVIEW_DAYS * 864e5);
  const [row] = await db
    .update(schema.previews)
    .set({ shared: true, expiresAt })
    .where(and(eq(schema.previews.id, previewId), eq(schema.previews.createdBy, user.id), gt(schema.previews.expiresAt, new Date())))
    .returning({ id: schema.previews.id, contentId: schema.previews.contentId });
  if (!row) return { error: "This preview has expired. Open the preview again." };
  await logActivity(user.id, "share", "preview", row.contentId, `Shared a preview link (expires ${expiresAt.toISOString().slice(0, 10)})`);
  return { url: `${SITE_URL}/preview/${row.id}/`, expiresAt: expiresAt.toISOString() };
}

/* ---------- Version history ---------- */

export type VersionItem = { id: string; createdAt: string; status: string; title: string; note: string; by: string | null };

export async function listVersions(contentId: string): Promise<VersionItem[]> {
  const user = await requireUser("content");
  if (!(await loadEditable(user, contentId))) return [];
  const rows = await db
    .select({ id: schema.contentRevisions.id, createdAt: schema.contentRevisions.createdAt, status: schema.contentRevisions.status, title: schema.contentRevisions.title, note: schema.contentRevisions.note, by: schema.users.name })
    .from(schema.contentRevisions)
    .leftJoin(schema.users, eq(schema.users.id, schema.contentRevisions.userId))
    .where(eq(schema.contentRevisions.contentId, contentId))
    .orderBy(desc(schema.contentRevisions.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

async function loadRevision(user: SessionUser, revisionId: string) {
  const [rev] = await db.select().from(schema.contentRevisions).where(eq(schema.contentRevisions.id, revisionId));
  if (!rev) return null;
  const row = await loadEditable(user, rev.contentId);
  return row ? { rev, row } : null;
}

/** A preview of an old version, for viewing it on the site layout. */
export async function previewVersion(revisionId: string): Promise<{ id?: string; error?: string }> {
  const user = await requireUser("content");
  const found = await loadRevision(user, revisionId);
  if (!found) return { error: "That version no longer exists." };
  const p = await createPreview({ contentId: found.row.id, data: { ...found.rev.snapshot, type: found.row.type, updatedAt: found.rev.createdAt.toISOString() }, userId: user.id });
  return { id: p.id };
}

/** Puts an old version back. The current content is kept in history first, so nothing is lost. */
export async function restoreVersion(revisionId: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser("content");
  const found = await loadRevision(user, revisionId);
  if (!found) return { error: "That version no longer exists." };
  const { rev, row } = found;
  if (!can(user.role, "content.publish") && ["published", "scheduled"].includes(row.status)) return { error: "This item is live. Ask an editor to restore an older version." };
  const snap = rev.snapshot as Record<string, unknown>;
  // Content comes back; the address and publish status stay as they are now.
  const restorable = REVISION_FIELDS.filter((k) => !["path", "status", "publishedAt", "unpublishAt"].includes(k));
  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of restorable) {
    const v = snap[k];
    if (k === "layout") values.layout = cleanSections(v ?? [], row.systemKey ? "system" : row.type).sections;
    else if (k === "body") values.body = sanitizeBody(typeof v === "string" ? v : "");
    else values[k] = v ?? (k === "tags" || k === "relatedIds" ? [] : k === "aeo" ? {} : k === "excerpt" || k === "title" ? row[k] : null);
  }
  await db.update(schema.content).set(values).where(eq(schema.content.id, row.id));
  const when = rev.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  await saveRevision(row.id, user.id, `Restored the version from ${when}`);
  await logActivity(user.id, "restore", row.type, row.id, `Restored “${row.title}” to the version from ${when}`);
  updateTag("content");
  revalidatePath(row.path);
  return { ok: true };
}

/** Brings back one section from an old version: replaces the same section if it's still there, otherwise adds it back. */
export async function restoreSection(revisionId: string, sectionId: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser("content");
  const found = await loadRevision(user, revisionId);
  if (!found) return { error: "That version no longer exists." };
  const { rev, row } = found;
  if (!can(user.role, "content.publish") && ["published", "scheduled"].includes(row.status)) return { error: "This item is live. Ask an editor to restore it." };
  const old = (Array.isArray(rev.snapshot.layout) ? rev.snapshot.layout : []) as Section[];
  const oldIndex = old.findIndex((s) => s.id === sectionId);
  if (oldIndex < 0) return { error: "That section isn't in the older version." };
  const current = (Array.isArray(row.layout) ? row.layout : []) as Section[];
  const at = current.findIndex((s) => s.id === sectionId);
  const next = [...current];
  if (at >= 0) next[at] = old[oldIndex];
  else next.splice(Math.min(oldIndex, next.length), 0, old[oldIndex]);
  await db.update(schema.content).set({ layout: cleanSections(next, row.systemKey ? "system" : row.type).sections, updatedAt: new Date() }).where(eq(schema.content.id, row.id));
  await saveRevision(row.id, user.id, "Brought back one section from an older version");
  await logActivity(user.id, "restore", row.type, row.id, `Brought back a section on “${row.title}”`);
  updateTag("content");
  revalidatePath(row.path);
  return { ok: true };
}

/* ---------- Also editing ---------- */

/** Marks this person as editing the item and returns who else had it open in the last 90 seconds. */
export async function editingHeartbeat(contentId: string): Promise<{ others: { name: string; secondsAgo: number }[]; updatedAt: string | null }> {
  const user = await requireUser("content");
  if (!/^[0-9a-f-]{36}$/.test(contentId)) return { others: [], updatedAt: null };
  await db
    .insert(schema.editingPresence)
    .values({ contentId, userId: user.id })
    .onConflictDoUpdate({ target: [schema.editingPresence.contentId, schema.editingPresence.userId], set: { lastSeen: new Date() } })
    .catch(() => undefined);
  const [others, [row]] = await Promise.all([
    db
      .select({ name: schema.users.name, lastSeen: schema.editingPresence.lastSeen })
      .from(schema.editingPresence)
      .innerJoin(schema.users, eq(schema.users.id, schema.editingPresence.userId))
      .where(and(eq(schema.editingPresence.contentId, contentId), ne(schema.editingPresence.userId, user.id), gt(schema.editingPresence.lastSeen, sql`now() - interval '90 seconds'`))),
    db.select({ updatedAt: schema.content.updatedAt }).from(schema.content).where(eq(schema.content.id, contentId)),
  ]);
  return {
    others: others.map((o) => ({ name: o.name, secondsAgo: Math.max(0, Math.round((Date.now() - o.lastSeen.getTime()) / 1000)) })),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

/** Called when the editor closes the page, so others stop seeing the warning straight away. */
export async function editingLeft(contentId: string) {
  const user = await requireUser("content");
  if (!/^[0-9a-f-]{36}$/.test(contentId)) return;
  await db.delete(schema.editingPresence).where(and(eq(schema.editingPresence.contentId, contentId), eq(schema.editingPresence.userId, user.id))).catch(() => undefined);
}
