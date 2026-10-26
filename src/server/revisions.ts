import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/** How many saved versions are kept per page or post (oldest are removed first). */
export const KEEP_REVISIONS = 50;

/** The fields a version stores (everything an editor can change). */
export const REVISION_FIELDS = [
  "title", "path", "body", "layout", "excerpt", "status", "publishedAt", "unpublishAt", "featuredMediaId",
  "seoTitle", "seoDescription", "robots", "canonicalUrl", "ogImageMediaId", "ogTitle", "ogDescription",
  "focusKeyword", "schemaType", "aeo", "tags", "authorName", "relatedIds",
] as const;

/** Stores a copy of the item as it is now. Called after every save. */
export async function saveRevision(contentId: string, userId: string | null, note = "") {
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, contentId));
  if (!row) return;
  const snapshot = Object.fromEntries(REVISION_FIELDS.map((k) => [k, row[k] ?? null]));
  await db.insert(schema.contentRevisions).values({ contentId, snapshot, title: row.title, status: row.status, userId, note });

  const old = await db
    .select({ id: schema.contentRevisions.id })
    .from(schema.contentRevisions)
    .where(eq(schema.contentRevisions.contentId, contentId))
    .orderBy(desc(schema.contentRevisions.createdAt))
    .offset(KEEP_REVISIONS);
  if (old.length) {
    await db.delete(schema.contentRevisions).where(and(eq(schema.contentRevisions.contentId, contentId), inArray(schema.contentRevisions.id, old.map((o) => o.id))));
  }
}
