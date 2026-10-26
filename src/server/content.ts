import "server-only";
import { unstable_cache } from "next/cache";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { existsSync } from "node:fs";
import { mediaUrl, resolveStored } from "./storage";
import { sized, srcSet } from "@/lib/img";

/** Published (or scheduled with its time already passed), and not past its end date. */
const isLive = () =>
  and(
    or(eq(schema.content.status, "published"), and(eq(schema.content.status, "scheduled"), lte(schema.content.publishedAt, sql`now()`))),
    or(isNull(schema.content.unpublishAt), gt(schema.content.unpublishAt, sql`now()`)),
  );

/** Normal pages and posts; fixed site pages (home, blog, collections) are read with getSystemPage. */
const notSystem = () => isNull(schema.content.systemKey);

const ogMedia = alias(schema.media, "og_media");

const fields = {
  id: schema.content.id,
  type: schema.content.type,
  path: schema.content.path,
  title: schema.content.title,
  excerpt: schema.content.excerpt,
  body: schema.content.body,
  layout: schema.content.layout,
  publishedAt: schema.content.publishedAt,
  updatedAt: schema.content.updatedAt,
  seoTitle: schema.content.seoTitle,
  seoDescription: schema.content.seoDescription,
  robots: schema.content.robots,
  canonicalUrl: schema.content.canonicalUrl,
  ogTitle: schema.content.ogTitle,
  ogDescription: schema.content.ogDescription,
  ogImageMediaId: schema.content.ogImageMediaId,
  ogImagePath: ogMedia.path,
  schemaType: schema.content.schemaType,
  aeo: schema.content.aeo,
  tags: schema.content.tags,
  featuredPath: schema.media.path,
  featuredAlt: schema.media.alt,
  author: schema.users.name,
  authorName: schema.content.authorName,
  relatedIds: schema.content.relatedIds,
};

const haveFile = (rel: string) => {
  const full = resolveStored(rel);
  return Boolean(full && existsSync(full));
};

/**
 * Photos in page text: drops ones whose file isn't on this server yet (so nothing renders broken) and gives the
 * rest smaller WebP copies (srcset) and lazy loading, so a 30 MB original is never sent to a phone.
 */
function withLocalImages(html: string) {
  return html.replace(/<img\b[^>]*\bsrc="\/media\/([^"?]+)"[^>]*>/g, (tag, rel: string) => {
    if (!haveFile(decodeURIComponent(rel))) return "";
    const url = `/media/${rel}`;
    const w = Number(tag.match(/\bwidth="(\d+)"/)?.[1]) || null;
    const set = srcSet(url, w);
    if (!set || /\bsrcset=/.test(tag)) return tag;
    return tag
      .replace(/\bsrc="[^"]+"/, `src="${sized(url, 1280)}" srcset="${set}" sizes="(min-width: 768px) 720px, 100vw"`)
      .replace(/<img\b/, /\bloading=/.test(tag) ? "<img" : '<img loading="lazy" decoding="async"');
  });
}

function shape<T extends { featuredPath: string | null; featuredAlt: string | null; ogImagePath: string | null; body: string }>(r: T) {
  const { featuredPath, featuredAlt, ogImagePath, ...rest } = r;
  return {
    ...rest,
    ogImage: ogImagePath && haveFile(ogImagePath) ? mediaUrl(ogImagePath) : null,
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
    .leftJoin(ogMedia, eq(ogMedia.id, schema.content.ogImageMediaId))
    .leftJoin(schema.users, eq(schema.users.id, schema.content.authorId))
    .where(and(eq(schema.content.path, path), isLive(), notSystem()))
    .limit(1);
}

/** The data cache stores JSON, so dates come back as strings: turn them back into Date objects. */
function reviveDates<T extends { publishedAt: Date | string | null; updatedAt: Date | string }>(r: T) {
  return { ...r, publishedAt: r.publishedAt ? new Date(r.publishedAt) : null, updatedAt: new Date(r.updatedAt) };
}

const cachedByPath = unstable_cache(
  async (path: string) => {
    const [row] = await queryByPath(path);
    return row ? shape(row) : null;
  },
  ["content-by-path"],
  { tags: ["content"], revalidate: 60 },
);

/** A live page or post at this exact path (with trailing slash). */
export async function getContentByPath(path: string) {
  const row = await cachedByPath(path);
  return row ? reviveDates(row) : null;
}

const cachedPosts = unstable_cache(
  async (opts: { limit?: number; offset?: number; tag?: string } = {}) => {
    const where = and(eq(schema.content.type, "post"), isLive(), notSystem(), opts.tag ? sql`${opts.tag} = any(${schema.content.tags})` : undefined);
    const [rows, [{ n }]] = await Promise.all([
      db
        .select(fields)
        .from(schema.content)
        .leftJoin(schema.media, eq(schema.media.id, schema.content.featuredMediaId))
        .leftJoin(ogMedia, eq(ogMedia.id, schema.content.ogImageMediaId))
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

/** Live blog posts, newest first. */
export async function listPosts(opts: { limit?: number; offset?: number; tag?: string } = {}) {
  const r = await cachedPosts(opts);
  return { posts: r.posts.map(reviveDates), total: r.total };
}

/** Every live page/post path (for the sitemap). */
const cachedLivePaths = unstable_cache(
  async () =>
    db
      .select({
        path: schema.content.path,
        title: schema.content.title,
        updatedAt: schema.content.updatedAt,
        type: schema.content.type,
        robots: schema.content.robots,
        featuredPath: schema.media.path,
        layout: schema.content.layout,
      })
      .from(schema.content)
      .leftJoin(schema.media, eq(schema.media.id, schema.content.featuredMediaId))
      .where(and(isLive(), notSystem(), inArray(schema.content.type, ["post", "page"]))),
  ["live-paths"],
  { tags: ["content"], revalidate: 300 },
);

export async function listLivePaths() {
  return (await cachedLivePaths()).map((r) => ({ ...r, updatedAt: new Date(r.updatedAt) }));
}

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

/* ---------- Fixed site pages (home, blog, collections, accessories) ---------- */

export type SystemKey = "home" | "blog" | "accessories" | `collection:${string}`;

const cachedSystem = unstable_cache(
  async (key: string) => {
    const [row] = await db
      .select({
        title: schema.content.title,
        layout: schema.content.layout,
        excerpt: schema.content.excerpt,
        seoTitle: schema.content.seoTitle,
        seoDescription: schema.content.seoDescription,
        robots: schema.content.robots,
        canonicalUrl: schema.content.canonicalUrl,
        ogTitle: schema.content.ogTitle,
        ogDescription: schema.content.ogDescription,
        ogImagePath: schema.media.path,
        updatedAt: schema.content.updatedAt,
      })
      .from(schema.content)
      .leftJoin(schema.media, eq(schema.media.id, schema.content.ogImageMediaId))
      .where(and(eq(schema.content.systemKey, key), isNotNull(schema.content.systemKey)))
      .limit(1);
    return row ?? null;
  },
  ["system-page"],
  { tags: ["content"], revalidate: 60 },
);

/** The editable record behind a fixed site page: its SEO, share settings and extra sections. */
export async function getSystemPage(key: SystemKey) {
  const row = await cachedSystem(key).catch(() => null);
  if (!row) return null;
  return {
    ...row,
    updatedAt: new Date(row.updatedAt),
    ogImage: row.ogImagePath && haveFile(row.ogImagePath) ? mediaUrl(row.ogImagePath) : null,
  };
}

/** The first photo in a page's sections (a hero or the first image), used in its share card. */
export async function firstSectionPhoto(layout: unknown): Promise<string | null> {
  if (!Array.isArray(layout)) return null;
  for (const s of layout as { hidden?: boolean; data?: Record<string, unknown> }[]) {
    if (s?.hidden) continue;
    const d = s?.data ?? {};
    const id = typeof d.image === "string" ? d.image : Array.isArray(d.images) && typeof d.images[0] === "string" ? d.images[0] : null;
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) continue;
    const [m] = await db.select({ path: schema.media.path, mime: schema.media.mime }).from(schema.media).where(eq(schema.media.id, id));
    if (m?.mime.startsWith("image/") && haveFile(m.path)) return mediaUrl(m.path);
  }
  return null;
}

/**
 * Up to `limit` posts to show under an article: the hand-picked ones first (in their order), then posts that
 * share a tag, then the newest.
 */
const textArray = (xs: string[]) => sql`array[${sql.join(xs.map((x) => sql`${x}`), sql`, `)}]::text[]`;

const cachedRelated = unstable_cache(
  async (id: string | null, picked: string[], tags: string[], limit: number) => {
    const base = () =>
      db
        .select(fields)
        .from(schema.content)
        .leftJoin(schema.media, eq(schema.media.id, schema.content.featuredMediaId))
        .leftJoin(ogMedia, eq(ogMedia.id, schema.content.ogImageMediaId))
        .leftJoin(schema.users, eq(schema.users.id, schema.content.authorId));
    const notSelf = id ? sql`${schema.content.id} <> ${id}` : undefined;
    const live = and(eq(schema.content.type, "post"), isLive(), notSystem(), notSelf);
    const chosen = picked.length ? await base().where(and(live, inArray(schema.content.id, picked))) : [];
    const out = picked.flatMap((p) => chosen.filter((c) => c.id === p));
    const skip = () => (out.length ? notInArray(schema.content.id, out.map((o) => o.id)) : undefined);
    if (out.length < limit && tags.length) {
      out.push(
        ...(await base()
          .where(and(live, skip(), sql`${schema.content.tags} && ${textArray(tags)}`))
          .orderBy(sql`cardinality(array(select unnest(${schema.content.tags}) intersect select unnest(${textArray(tags)}))) desc`, desc(schema.content.publishedAt))
          .limit(limit - out.length)),
      );
    }
    if (out.length < limit) out.push(...(await base().where(and(live, skip())).orderBy(desc(schema.content.publishedAt)).limit(limit - out.length)));
    return out.slice(0, limit).map(shape);
  },
  ["related-posts"],
  { tags: ["content"], revalidate: 300 },
);

export async function relatedPosts(id: string | null, picked: string[], tags: string[], limit = 3) {
  return (await cachedRelated(id, picked, tags, limit)).map(reviveDates);
}

export type AuthorProfile = { name: string; slug: string; jobTitle: string; bio: string; links: string[]; photo: string | null };

const cachedAuthors = unstable_cache(
  async () => {
    const rows = await db
      .select({ name: schema.authors.name, slug: schema.authors.slug, jobTitle: schema.authors.jobTitle, bio: schema.authors.bio, links: schema.authors.links, photoPath: schema.media.path })
      .from(schema.authors)
      .leftJoin(schema.media, eq(schema.media.id, schema.authors.photoMediaId));
    return rows.map(({ photoPath, ...a }) => ({ ...a, photo: photoPath && haveFile(photoPath) ? mediaUrl(photoPath) : null }));
  },
  ["authors"],
  { tags: ["content"], revalidate: 300 },
);

/** The profile for a post's byline (matched by name), if one has been set up. */
export async function authorByName(name: string | null): Promise<AuthorProfile | null> {
  if (!name) return null;
  return (await cachedAuthors()).find((a) => a.name === name) ?? null;
}

export async function authorBySlug(slug: string): Promise<AuthorProfile | null> {
  return (await cachedAuthors()).find((a) => a.slug === slug) ?? null;
}

const cachedByAuthor = unstable_cache(
  async (name: string) =>
    (
      await db
        .select(fields)
        .from(schema.content)
        .leftJoin(schema.media, eq(schema.media.id, schema.content.featuredMediaId))
        .leftJoin(ogMedia, eq(ogMedia.id, schema.content.ogImageMediaId))
        .leftJoin(schema.users, eq(schema.users.id, schema.content.authorId))
        .where(and(eq(schema.content.type, "post"), isLive(), notSystem(), eq(schema.content.authorName, name)))
        .orderBy(desc(schema.content.publishedAt))
        .limit(200)
    ).map(shape),
  ["posts-by-author"],
  { tags: ["content"], revalidate: 300 },
);

export async function postsByAuthor(name: string) {
  return (await cachedByAuthor(name)).map(reviveDates);
}
