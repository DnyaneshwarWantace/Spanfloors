import type { MetadataRoute } from "next";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATEGORIES, getCatalog } from "@/lib/catalog";
import { SITE_URL } from "@/lib/seo";
import { listLivePaths } from "@/server/content";
import { mediaUrl } from "@/server/storage";
import { parseVideo } from "@/sections/video";

// Rendered per request (the build has no API keys); Twenty data itself is cached for 5 minutes.
export const dynamic = "force-dynamic";

const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u}`);

type Sec = { hidden?: boolean; data?: Record<string, unknown> };

/** Photo ids and video links used by a page's visible sections. */
function fromLayout(layout: unknown) {
  const ids: string[] = [];
  const videos: { url: string; title: string }[] = [];
  for (const s of (Array.isArray(layout) ? layout : []) as Sec[]) {
    if (s?.hidden) continue;
    const d = s?.data ?? {};
    const collect = (v: unknown): void => {
      if (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)) ids.push(v);
      else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === "object") Object.values(v).forEach(collect);
    };
    collect(d.image);
    collect(d.images);
    if (Array.isArray(d.items)) for (const it of d.items as Record<string, unknown>[]) collect(it?.image);
    const v = parseVideo(d.url ?? d.video);
    if (v) videos.push({ url: v.url, title: String(d.title || d.heading || "Video") });
  }
  return { ids, videos };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, pages] = await Promise.all([getCatalog().catch(() => []), listLivePaths().catch(() => [])]);
  const live = pages.filter((p) => p.path !== "/" && !/noindex/.test(p.robots ?? ""));

  // One query for every photo the pages' sections use.
  const perPage = live.map((p) => ({ p, ...fromLayout(p.layout) }));
  const allIds = [...new Set(perPage.flatMap((x) => x.ids))];
  const media = new Map<string, string>();
  if (allIds.length) {
    const rows = await db.select({ id: schema.media.id, path: schema.media.path, mime: schema.media.mime }).from(schema.media).where(inArray(schema.media.id, allIds)).catch(() => []);
    for (const r of rows) if (r.mime.startsWith("image/")) media.set(r.id, mediaUrl(r.path));
  }

  // YouTube videos embedded in page text (imported pages and posts).
  const embedded = new Map<string, string[]>();
  const vrows = await db
    .execute<{ path: string; id: string }>(
      sql`select path, (regexp_matches(body, 'youtube(?:-nocookie)?\.com/embed/([A-Za-z0-9_-]{11})', 'g'))[1] as id from content where status in ('published', 'scheduled') and body like '%youtube%'`,
    )
    .then((r) => r.rows)
    .catch(() => []);
  for (const v of vrows) embedded.set(v.path, [...(embedded.get(v.path) ?? []), v.id]);

  const authorPages = await db
    .execute<{ slug: string }>(sql`select a.slug from authors a where exists (select 1 from content c where c.type = 'post' and c.status = 'published' and c.author_name = a.name)`)
    .then((r) => r.rows)
    .catch(() => []);

  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/${c.slug}/`, changeFrequency: "daily" as const, priority: 0.8 })),
    { url: `${SITE_URL}/blog/`, changeFrequency: "weekly" as const, priority: 0.6 },
    ...authorPages.map((a) => ({ url: `${SITE_URL}/blog/author/${a.slug}/`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...perPage.map(({ p, ids, videos }) => {
      const images = [...new Set([p.featuredPath ? mediaUrl(p.featuredPath) : null, ...ids.map((id) => media.get(id) ?? null)].filter((u): u is string => Boolean(u)))].slice(0, 20).map(abs);
      const all = [...videos, ...(embedded.get(p.path) ?? []).map((id) => ({ url: `https://www.youtube.com/watch?v=${id}`, title: p.title }))];
      const vids = [...new Map(all.map((v) => [parseVideo(v.url)?.id, v])).values()].slice(0, 5).map((v) => {
        const info = parseVideo(v.url)!;
        return { title: v.title, thumbnail_loc: info.thumbnail ?? `${SITE_URL}/brand/span-floors-logo.png`, description: v.title, player_loc: info.embed };
      });
      return {
        url: `${SITE_URL}${p.path}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: p.type === "post" ? 0.6 : 0.5,
        ...(images.length ? { images } : {}),
        ...(vids.length ? { videos: vids } : {}),
      };
    }),
    ...products.map((p) => ({
      url: `${SITE_URL}${p.href}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...(p.images.length ? { images: p.images.slice(0, 10).map(abs) } : {}),
    })),
  ];
}
