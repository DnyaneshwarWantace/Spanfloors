"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { normalizePath, sanitizeBody, toText } from "@/server/html";
import { saveRevision } from "@/server/revisions";
import { pingIndexNow } from "@/server/indexnow";
import { cleanSections } from "@/sections/clean";
import { cleanAeo, SCHEMA_TYPES } from "@/server/aeo";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth";

/** URLs owned by the product catalogue (served from Twenty) can't be used by pages or posts. */
const RESERVED = /^\/(engineered-wood-flooring|laminate-flooring|composite-flooring|decking|facades)-collection\/|^\/accessories\/|^\/admin\/|^\/media\//;

export type SaveState = { ok?: boolean; error?: string; id?: string; savedAt?: string; updatedAt?: string; warnings?: string[]; conflict?: boolean };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

/** Text from the first text-like sections, for an automatic excerpt. */
function layoutText(layout: { data: Record<string, unknown> }[]) {
  return layout
    .flatMap((s) => [s.data.intro, s.data.body].filter((v): v is string => typeof v === "string" && v.length > 0))
    .slice(0, 2)
    .join(" ");
}

/** Authors may only touch their own blog posts; fixed site pages need full content access. */
function mayEdit(user: SessionUser, row: { type: string; authorId: string | null; systemKey: string | null }) {
  if (can(user.role, "content.all")) return true;
  return row.type === "post" && row.authorId === user.id && !row.systemKey;
}

export async function saveContent(_prev: SaveState, form: FormData): Promise<SaveState> {
  const user = await requireUser("content");
  const id = str(form, "id") || null;
  const requestedType = str(form, "type") === "page" ? "page" : "post";
  const title = str(form, "title");
  if (!title) return { error: "Add a title." };

  const [existing] = id
    ? await db
        .select({ path: schema.content.path, type: schema.content.type, authorId: schema.content.authorId, systemKey: schema.content.systemKey, status: schema.content.status, updatedAt: schema.content.updatedAt, updatedByName: schema.users.name })
        .from(schema.content)
        .leftJoin(schema.contentRevisions, sql`${schema.contentRevisions.id} = (select r.id from content_revisions r where r.content_id = ${schema.content.id} order by r.created_at desc limit 1)`)
        .leftJoin(schema.users, eq(schema.users.id, schema.contentRevisions.userId))
        .where(eq(schema.content.id, id))
    : [];
  if (id && !existing) return { error: "This item no longer exists." };
  if (existing && !mayEdit(user, existing)) return { error: "You can only edit your own blog posts." };
  if (!existing && requestedType === "page" && !can(user.role, "content.all")) return { error: "Your account can write blog posts, not pages." };
  const type = existing?.type ?? requestedType;

  // Someone saved this item after this editor was opened: don't silently overwrite their work.
  const loadedAt = str(form, "loadedAt");
  if (existing && loadedAt && str(form, "force") !== "1" && existing.updatedAt.getTime() > new Date(loadedAt).getTime() + 1000) {
    const when = existing.updatedAt.toLocaleTimeString("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" });
    return { conflict: true, error: `${existing.updatedByName ?? "Someone"} saved this ${type} at ${when}, after you opened it. Reload to see their changes, or save yours anyway (theirs stays in the version history).` };
  }

  // Fixed site pages (home, blog, collections) keep their URL.
  const path = existing?.systemKey ? existing.path : normalizePath(str(form, "path") || title);
  if (!existing?.systemKey && RESERVED.test(path)) return { error: `“${path}” is reserved for the product catalogue or system pages. Choose another URL.` };
  const clash = await db
    .select({ id: schema.content.id, title: schema.content.title })
    .from(schema.content)
    .where(id ? and(eq(schema.content.path, path), ne(schema.content.id, id)) : eq(schema.content.path, path));
  if (clash.length) return { error: `The URL ${path} is already used by “${clash[0].title}”.` };

  let status = str(form, "status") as "draft" | "review" | "published" | "scheduled" | "archived";
  if (!["draft", "review", "published", "scheduled", "archived"].includes(status)) status = "draft";
  // Authors send posts for review; an editor publishes. Live posts are changed by editors only.
  if (!can(user.role, "content.publish")) {
    if (existing && ["published", "scheduled"].includes(existing.status)) return { error: "This post is live. Ask an editor to make changes to it." };
    if (status !== "draft") status = "review";
  }
  const publishedRaw = str(form, "publishedAt");
  let publishedAt = publishedRaw ? new Date(publishedRaw) : null;
  if (status === "published" && !publishedAt) publishedAt = new Date();
  const unpublishRaw = str(form, "unpublishAt");
  const unpublishAt = unpublishRaw && can(user.role, "content.publish") ? new Date(unpublishRaw) : null;
  if (unpublishAt && Number.isNaN(unpublishAt.getTime())) return { error: "The “take offline” date isn't valid." };
  if (unpublishAt && publishedAt && unpublishAt <= publishedAt) return { error: "The “take offline” date must be after the publish date." };
  if (status === "scheduled") {
    if (!publishedAt) return { error: "Pick a date and time to schedule this for." };
    if (publishedAt <= new Date()) status = "published";
  }

  let rawLayout: unknown = [];
  try {
    rawLayout = JSON.parse(String(form.get("layout") ?? "[]"));
  } catch {
    return { error: "The page sections could not be read. Reload the page and try again." };
  }
  const { sections: layout, problems } = cleanSections(rawLayout, existing?.systemKey ? "system" : type);
  // Drafts may be incomplete; a page can't go live with sections missing required content.
  if (problems.length && (status === "published" || status === "scheduled")) {
    return { error: `Fill in the missing content before publishing: ${problems.slice(0, 4).join(" ")}${problems.length > 4 ? ` (and ${problems.length - 4} more)` : ""}`, warnings: problems };
  }

  const body = sanitizeBody(String(form.get("body") ?? ""));
  const excerpt = str(form, "excerpt") || toText(body || layoutText(layout)).slice(0, 220);
  const values = {
    type: type as "post" | "page",
    title,
    path,
    body,
    layout,
    excerpt,
    status,
    publishedAt,
    unpublishAt,
    featuredMediaId: orNull(str(form, "featuredMediaId")),
    seoTitle: orNull(str(form, "seoTitle")),
    seoDescription: orNull(str(form, "seoDescription")),
    // "Hide from search engines" checkbox; otherwise keep any imported robots value that isn't a noindex.
    robots: str(form, "noindex") === "on" ? "noindex, nofollow" : /noindex/.test(str(form, "robots")) ? null : orNull(str(form, "robots")),
    canonicalUrl: orNull(str(form, "canonicalUrl")),
    ogTitle: orNull(str(form, "ogTitle").slice(0, 120)),
    ogDescription: orNull(str(form, "ogDescription").slice(0, 300)),
    ogImageMediaId: /^[0-9a-f-]{36}$/.test(str(form, "ogImageMediaId")) ? str(form, "ogImageMediaId") : null,
    focusKeyword: orNull(str(form, "focusKeyword").slice(0, 80)),
    schemaType: SCHEMA_TYPES.some((t) => t.value && t.value === str(form, "schemaType")) ? str(form, "schemaType") : null,
    aeo: (() => {
      try {
        return cleanAeo(JSON.parse(String(form.get("aeo") ?? "{}")));
      } catch {
        return cleanAeo({});
      }
    })(),
    tags: str(form, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    ...(type === "post"
      ? {
          authorName: orNull(str(form, "authorName").slice(0, 80)),
          relatedIds: [...new Set(str(form, "relatedIds").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x) && x !== id))].slice(0, 6),
        }
      : {}),
    updatedAt: new Date(),
  };

  let savedId = id;
  let oldPath: string | null = null;
  if (id && existing) {
    oldPath = existing.path;
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

  if (savedId) await saveRevision(savedId, user.id);
  await logActivity(user.id, id ? "update" : "create", type, savedId, `${id ? "Updated" : "Created"} ${type} “${title}” (${status})`);
  updateTag("content");
  revalidatePath(path);
  if (oldPath && oldPath !== path) revalidatePath(oldPath);
  // Tell search engines about live changes (and about an address that moved or went offline).
  const wasLive = existing && ["published", "scheduled"].includes(existing.status);
  if (status === "published" || wasLive) pingIndexNow([path, ...(oldPath && oldPath !== path ? [oldPath] : [])]);

  if (!id) redirect(`/admin/content/${savedId}/?type=${type}&created=1`);
  return { ok: true, id: savedId ?? undefined, savedAt: new Date().toISOString(), updatedAt: values.updatedAt.toISOString(), warnings: problems };
}

export async function deleteContent(form: FormData) {
  const user = await requireUser("content");
  const id = str(form, "id");
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, id));
  if (!row) redirect("/admin/content/");
  if (!mayEdit(user, row) || row.systemKey) redirect(`/admin/content/${id}/?type=${row.type}`);
  // Authors can delete their own posts only while they are not live.
  if (!can(user.role, "content.publish") && row.status === "published") redirect(`/admin/content/${id}/?type=${row.type}`);
  await db.delete(schema.content).where(eq(schema.content.id, id));
  await logActivity(user.id, "delete", row.type, id, `Deleted ${row.type} “${row.title}”`);
  if (row.status === "published") pingIndexNow([row.path]);
  updateTag("content");
  revalidatePath(row.path);
  redirect(`/admin/content/?type=${row.type}&deleted=1`);
}

export async function duplicateContent(form: FormData) {
  const user = await requireUser("content");
  const id = str(form, "id");
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, id));
  if (!row) redirect("/admin/content/");
  if (!mayEdit(user, row) || row.systemKey) redirect(`/admin/content/${id}/?type=${row.type}`);
  let path = row.path.replace(/\/$/, "-copy/");
  for (let n = 2; (await db.select({ id: schema.content.id }).from(schema.content).where(eq(schema.content.path, path))).length; n++) {
    path = row.path.replace(/\/$/, `-copy-${n}/`);
  }
  const { id: _id, createdAt: _c, updatedAt: _u, legacyWpId: _l, legacyWpType: _t, systemKey: _s, ...rest } = row;
  const [copy] = await db
    .insert(schema.content)
    .values({ ...rest, title: `${row.title} (copy)`, path, status: "draft", authorId: user.id })
    .returning({ id: schema.content.id });
  await saveRevision(copy.id, user.id, `Copy of “${row.title}”`);
  await logActivity(user.id, "create", row.type, copy.id, `Duplicated “${row.title}”`);
  redirect(`/admin/content/${copy.id}/?type=${row.type}`);
}
