"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { slugify } from "@/server/html";
import { safeHref } from "@/sections/clean";

/* Blog tools: tags (rename, merge, remove), author profiles, related-post search. */

const posts = (n: number | null) => `${n ?? 0} ${n === 1 ? "post" : "posts"}`;
const clean = (v: FormDataEntryValue | null, max = 60) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Renames a tag on every post; renaming to an existing tag merges the two. */
export async function renameTag(form: FormData) {
  const user = await requireUser("content.all");
  const from = clean(form.get("from"));
  const to = clean(form.get("to"));
  if (!from || !to || from === to) redirect("/admin/content/tags/?error=1");
  const res = await db.execute(sql`
    update content set tags = (select coalesce(array_agg(t order by o), '{}') from (select t, min(o) o from unnest(array_replace(tags, ${from}, ${to})) with ordinality u(t, o) group by t) x), updated_at = now()
    where ${from} = any(tags) returning id`);
  await logActivity(user.id, "update", "tag", null, `Renamed tag “${from}” to “${to}” on ${posts(res.rowCount)}`);
  updateTag("content");
  redirect(`/admin/content/tags/?done=${encodeURIComponent(`“${from}” is now “${to}” on ${posts(res.rowCount)}.`)}`);
}

export async function removeTag(form: FormData) {
  const user = await requireUser("content.all");
  const tag = clean(form.get("tag"));
  if (!tag) redirect("/admin/content/tags/");
  const res = await db.execute(sql`update content set tags = array_remove(tags, ${tag}), updated_at = now() where ${tag} = any(tags) returning id`);
  await logActivity(user.id, "update", "tag", null, `Removed tag “${tag}” from ${posts(res.rowCount)}`);
  updateTag("content");
  redirect(`/admin/content/tags/?done=${encodeURIComponent(`Removed “${tag}” from ${posts(res.rowCount)}.`)}`);
}

/** Saves an author profile. Renaming changes the byline on all their posts. */
export async function saveAuthor(form: FormData) {
  const user = await requireUser("content.all");
  const id = String(form.get("id") ?? "");
  const name = clean(form.get("name"), 80);
  if (!name) redirect(`/admin/content/authors/${id || "new"}/?error=name`);
  const slug = slugify(clean(form.get("slug"), 80) || name).replace(/\//g, "-");
  const photo = String(form.get("photoMediaId") ?? "");
  const values = {
    name,
    slug,
    jobTitle: clean(form.get("jobTitle"), 100),
    bio: String(form.get("bio") ?? "").trim().slice(0, 1500),
    photoMediaId: /^[0-9a-f-]{36}$/.test(photo) ? photo : null,
    links: String(form.get("links") ?? "")
      .split(/\s+/)
      .map((l) => safeHref(l))
      .filter((l) => /^https:\/\//.test(l))
      .slice(0, 6),
    updatedAt: new Date(),
  };
  const clash = await db.select({ id: schema.authors.id }).from(schema.authors).where(and(sql`(${schema.authors.name} = ${name} or ${schema.authors.slug} = ${slug})`, id ? ne(schema.authors.id, id) : undefined));
  if (clash.length) redirect(`/admin/content/authors/${id || "new"}/?error=taken`);
  if (id) {
    const [before] = await db.select().from(schema.authors).where(eq(schema.authors.id, id));
    if (!before) redirect("/admin/content/authors/");
    await db.update(schema.authors).set(values).where(eq(schema.authors.id, id));
    if (before.name !== name) await db.update(schema.content).set({ authorName: name }).where(eq(schema.content.authorName, before.name));
  } else {
    await db.insert(schema.authors).values(values);
  }
  await logActivity(user.id, id ? "update" : "create", "author", id || null, `Saved author profile “${name}”`);
  updateTag("content");
  redirect("/admin/content/authors/?saved=1");
}

/** Posts for the related-posts picker. */
export async function searchPosts(q: string, exclude: string | null) {
  await requireUser("content");
  return db
    .select({ id: schema.content.id, title: schema.content.title })
    .from(schema.content)
    .where(and(eq(schema.content.type, "post"), eq(schema.content.status, "published"), q.trim() ? ilike(schema.content.title, `%${q.trim().slice(0, 80)}%`) : undefined, exclude ? ne(schema.content.id, exclude) : undefined))
    .orderBy(sql`${schema.content.publishedAt} desc nulls last`)
    .limit(15);
}

export async function postTitles(ids: string[]) {
  await requireUser("content");
  const list = ids.filter((i) => /^[0-9a-f-]{36}$/.test(i));
  if (!list.length) return [];
  return db.select({ id: schema.content.id, title: schema.content.title }).from(schema.content).where(inArray(schema.content.id, list));
}
