"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { normalizePath, sanitizeBody, toText } from "@/server/html";

/** URLs owned by the product catalogue (served from Twenty) can't be used by pages or posts. */
const RESERVED = /^\/(engineered-wood-flooring|laminate-flooring|composite-flooring|decking|facades)-collection\/|^\/accessories\/|^\/admin\/|^\/media\//;

export type SaveState = { ok?: boolean; error?: string; id?: string; savedAt?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

export async function saveContent(_prev: SaveState, form: FormData): Promise<SaveState> {
  const user = await requireUser();
  const id = str(form, "id") || null;
  const type = str(form, "type") === "page" ? "page" : "post";
  const title = str(form, "title");
  if (!title) return { error: "Add a title." };

  const path = normalizePath(str(form, "path") || title);
  if (RESERVED.test(path)) return { error: `“${path}” is reserved for the product catalogue or system pages. Choose another URL.` };
  const clash = await db
    .select({ id: schema.content.id, title: schema.content.title })
    .from(schema.content)
    .where(id ? and(eq(schema.content.path, path), ne(schema.content.id, id)) : eq(schema.content.path, path));
  if (clash.length) return { error: `The URL ${path} is already used by “${clash[0].title}”.` };

  let status = str(form, "status") as "draft" | "published" | "scheduled" | "archived";
  if (!["draft", "published", "scheduled", "archived"].includes(status)) status = "draft";
  const publishedRaw = str(form, "publishedAt");
  let publishedAt = publishedRaw ? new Date(publishedRaw) : null;
  if (status === "published" && !publishedAt) publishedAt = new Date();
  if (status === "scheduled") {
    if (!publishedAt) return { error: "Pick a date and time to schedule this for." };
    if (publishedAt <= new Date()) status = "published";
  }

  const body = sanitizeBody(String(form.get("body") ?? ""));
  const excerpt = str(form, "excerpt") || toText(body).slice(0, 220);
  const values = {
    type: type as "post" | "page",
    title,
    path,
    body,
    excerpt,
    status,
    publishedAt,
    featuredMediaId: orNull(str(form, "featuredMediaId")),
    seoTitle: orNull(str(form, "seoTitle")),
    seoDescription: orNull(str(form, "seoDescription")),
    // "Hide from search engines" checkbox; otherwise keep any imported robots value that isn't a noindex.
    robots: str(form, "noindex") === "on" ? "noindex, nofollow" : /noindex/.test(str(form, "robots")) ? null : orNull(str(form, "robots")),
    canonicalUrl: orNull(str(form, "canonicalUrl")),
    tags: str(form, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    updatedAt: new Date(),
  };

  let savedId = id;
  let oldPath: string | null = null;
  if (id) {
    const [before] = await db.select({ path: schema.content.path }).from(schema.content).where(eq(schema.content.id, id));
    if (!before) return { error: "This item no longer exists." };
    oldPath = before.path;
    await db.update(schema.content).set(values).where(eq(schema.content.id, id));
    // Keep old links working when a published URL changes.
    if (oldPath !== path) {
      await db
        .insert(schema.redirects)
        .values({ fromPath: oldPath, toPath: path, note: `Auto: “${title}” URL changed` })
        .onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: path } });
    }
  } else {
    const [row] = await db
      .insert(schema.content)
      .values({ ...values, authorId: user.id })
      .returning({ id: schema.content.id });
    savedId = row.id;
  }

  await logActivity(user.id, id ? "update" : "create", type, savedId, `${id ? "Updated" : "Created"} ${type} “${title}” (${status})`);
  updateTag("content");
  revalidatePath(path);
  if (oldPath && oldPath !== path) revalidatePath(oldPath);

  if (!id) redirect(`/admin/content/${savedId}/?type=${type}&created=1`);
  return { ok: true, id: savedId ?? undefined, savedAt: new Date().toISOString() };
}

export async function deleteContent(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, id));
  if (!row) redirect("/admin/content/");
  await db.delete(schema.content).where(eq(schema.content.id, id));
  await logActivity(user.id, "delete", row.type, id, `Deleted ${row.type} “${row.title}”`);
  updateTag("content");
  revalidatePath(row.path);
  redirect(`/admin/content/?type=${row.type}&deleted=1`);
}

export async function duplicateContent(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, id));
  if (!row) redirect("/admin/content/");
  let path = row.path.replace(/\/$/, "-copy/");
  for (let n = 2; (await db.select({ id: schema.content.id }).from(schema.content).where(eq(schema.content.path, path))).length; n++) {
    path = row.path.replace(/\/$/, `-copy-${n}/`);
  }
  const { id: _id, createdAt: _c, updatedAt: _u, legacyWpId: _l, legacyWpType: _t, ...rest } = row;
  const [copy] = await db
    .insert(schema.content)
    .values({ ...rest, title: `${row.title} (copy)`, path, status: "draft", authorId: user.id })
    .returning({ id: schema.content.id });
  await logActivity(user.id, "create", row.type, copy.id, `Duplicated “${row.title}”`);
  redirect(`/admin/content/${copy.id}/?type=${row.type}`);
}
