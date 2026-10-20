import "server-only";
import { unstable_cache } from "next/cache";
import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { existsSync } from "node:fs";
import { mediaUrl, resolveStored } from "./storage";

/** Published, or scheduled with its time already passed. */
const isLive = () =>
  or(eq(schema.content.status, "published"), and(eq(schema.content.status, "scheduled"), lte(schema.content.publishedAt, sql`now()`)));

const fields = {
  id: schema.content.id,
  type: schema.content.type,
  path: schema.content.path,
  title: schema.content.title,
  excerpt: schema.content.excerpt,
  body: schema.content.body,
  publishedAt: schema.content.publishedAt,
  updatedAt: schema.content.updatedAt,
  seoTitle: schema.content.seoTitle,
  seoDescription: schema.content.seoDescription,
  robots: schema.content.robots,
  canonicalUrl: schema.content.canonicalUrl,
  tags: schema.content.tags,
  featuredPath: schema.media.path,
  featuredAlt: schema.media.alt,
  author: schema.users.name,
};

const haveFile = (rel: string) => {
  const full = resolveStored(rel);
  return Boolean(full && existsSync(full));
};

/** Drops <img> tags pointing at media we don't have on disk yet (e.g. imports still pending), so nothing renders broken. */
function withLocalImages(html: string) {
  return html.replace(/<img\b[^>]*\bsrc="\/media\/([^"]+)"[^>]*>/g, (tag, rel: string) => (haveFile(decodeURIComponent(rel)) ? tag : ""));
}

function shape<T extends { featuredPath: string | null; featuredAlt: string | null; body: string }>(r: T) {
  const { featuredPath, featuredAlt, ...rest } = r;
  return {
    ...rest,
    body: withLocalImages(rest.body),
    featured: featuredPath && haveFile(featuredPath) ? { url: mediaUrl(featuredPath), alt: featuredAlt ?? "" } : null,
  };
}

export type PublicContent = ReturnType<typeof shape<Awaited<ReturnType<typeof queryByPath>>[number]>>;

function queryByPath(path: string) {
  return db
    .select(fields)
    .from(schema.content)
    .leftJoin(schema.media, eq(schema.media.id, schema.content.featuredMediaId))
    .leftJoin(schema.users, eq(schema.users.id, schema.content.authorId))
    .where(and(eq(schema.content.path, path), isLive()))
    .limit(1);
}

/** A live page or post at this exact path (with trailing slash). */
export const getContentByPath = unstable_cache(
  async (path: string) => {
    const [row] = await queryByPath(path);
    return row ? shape(row) : null;
  },
  ["content-by-path"],
  { tags: ["content"], revalidate: 60 },
);

/** Live blog posts, newest first. */
export const listPosts = unstable_cache(
  async (opts: { limit?: number; offset?: number; tag?: string } = {}) => {
    const where = and(eq(schema.content.type, "post"), isLive(), opts.tag ? sql`${opts.tag} = any(${schema.content.tags})` : undefined);
    const [rows, [{ n }]] = await Promise.all([
      db
        .select(fields)
        .from(schema.content)
        .leftJoin(schema.media, eq(schema.media.id, schema.content.featuredMediaId))
        .leftJoin(schema.users, eq(schema.users.id, schema.content.authorId))
        .where(where)
        .orderBy(desc(schema.content.publishedAt))
        .limit(opts.limit ?? 24)
        .offset(opts.offset ?? 0),
      db.select({ n: sql<number>`count(*)::int` }).from(schema.content).where(where),
    ]);
    return { posts: rows.map(shape), total: n };
  },
  ["list-posts"],
  { tags: ["content"], revalidate: 60 },
);

/** Every live page/post path (for the sitemap). */
export const listLivePaths = unstable_cache(
  async () =>
    db
      .select({ path: schema.content.path, updatedAt: schema.content.updatedAt, type: schema.content.type, robots: schema.content.robots })
      .from(schema.content)
      .where(and(isLive(), inArray(schema.content.type, ["post", "page"]))),
  ["live-paths"],
  { tags: ["content"], revalidate: 300 },
);

/** Redirect configured in the admin for this path, if any (also counts the hit). */
export async function findRedirect(path: string) {
  const [r] = await unstable_cache(
    async (p: string) => db.select().from(schema.redirects).where(eq(schema.redirects.fromPath, p)).limit(1),
    ["redirect-by-path"],
    { tags: ["redirects"], revalidate: 300 },
  )(path);
  if (r) {
    db.update(schema.redirects)
      .set({ hits: sql`${schema.redirects.hits} + 1` })
      .where(eq(schema.redirects.id, r.id))
      .catch(() => undefined);
  }
  return r ?? null;
}
