/**
 * Writes the website's public content to one JSON file: products (from Twenty, read-only), collections, pages,
 * blog posts, menus, contact details and studios. Used to preview Span Floors content inside another layout
 * (the Forté reference copy). Reads only; changes nothing here or in Twenty. Prices and stock are left out.
 *
 *   npm run export:site-data -- ~/Downloads/forte-spanfloors/data/spanfloors.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATEGORIES, displayName, formatOf, getCatalog, subtitleOf } from "@/lib/catalog";
import { mediaUrl } from "@/server/storage";
import { getConfig, getTexts } from "@/server/site-config";

const out = resolve(process.argv[2] ?? "site-data.json");

async function main() {
  const catalog = await getCatalog();
  const products = catalog.map((p) => ({
    id: p.id,
    name: displayName(p),
    /** Name as stored in Twenty (Allsy tags photos with it) and Twenty's Allsy image id. */
    twentyName: p.name,
    allsyImageId: p.imageId,
    subtitle: subtitleOf(p),
    format: formatOf(p),
    category: p.categoryKey,
    collection: p.collection,
    href: p.href,
    images: p.images,
    featured: p.featured,
    badges: p.badges,
    sortOrder: p.sortOrder,
    dimensions: p.dimensions,
    grade: p.grade,
    construction: p.construction,
    installation: p.installation,
    planksPerBox: p.planksPerBox,
    areaPerBoxSqft: p.areaPerBoxSqft,
    species: [...new Set(p.variants.map((v) => v.species).filter(Boolean))],
    description: p.descriptionHtml,
    differentiator: p.differentiator,
  }));

  const rows = await db
    .select({
      id: schema.content.id,
      type: schema.content.type,
      path: schema.content.path,
      title: schema.content.title,
      excerpt: schema.content.excerpt,
      body: schema.content.body,
      layout: schema.content.layout,
      publishedAt: schema.content.publishedAt,
      tags: schema.content.tags,
      authorName: schema.content.authorName,
      systemKey: schema.content.systemKey,
      seoTitle: schema.content.seoTitle,
      seoDescription: schema.content.seoDescription,
      status: schema.content.status,
      featuredPath: schema.media.path,
      featuredAlt: schema.media.alt,
    })
    .from(schema.content)
    .leftJoin(schema.media, eq(schema.media.id, schema.content.featuredMediaId))
    .where(inArray(schema.content.status, ["published", "draft"]))
    .orderBy(desc(schema.content.publishedAt));

  // Photos used inside page sections, so the preview can show them.
  const sectionIds = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)) sectionIds.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  rows.forEach((r) => walk(r.layout));
  const media = sectionIds.size
    ? await db.select({ id: schema.media.id, path: schema.media.path, alt: schema.media.alt }).from(schema.media).where(inArray(schema.media.id, [...sectionIds]))
    : [];

  const redirects = await db.select({ from: schema.redirects.fromPath, to: schema.redirects.toPath }).from(schema.redirects);
  const content = rows.map(({ featuredPath, featuredAlt, ...r }) => ({ ...r, image: featuredPath ? { url: mediaUrl(featuredPath), alt: featuredAlt ?? "" } : null }));
  const [header, footer, contact, studios, identity, texts, authors] = await Promise.all([
    getConfig("config.header"),
    getConfig("config.footer"),
    getConfig("config.contact"),
    getConfig("config.studios"),
    getConfig("config.identity"),
    getTexts(),
    db.select({ name: schema.authors.name, slug: schema.authors.slug, jobTitle: schema.authors.jobTitle, bio: schema.authors.bio }).from(schema.authors),
  ]);
  // Media ids in the identity settings → addresses.
  const idIds = [identity.logo, identity.logoLight, identity.favicon, identity.shareImage].filter((x): x is string => Boolean(x));
  const idMedia = idIds.length ? await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(inArray(schema.media.id, idIds)) : [];

  const data = {
    exportedAt: new Date().toISOString(),
    categories: CATEGORIES.map((c) => ({ ...c, count: products.filter((p) => p.category === c.key).length })),
    products,
    pages: content.filter((c) => c.type === "page" && !c.systemKey && c.status === "published"),
    posts: content.filter((c) => c.type === "post" && c.status === "published"),
    systemPages: content.filter((c) => c.systemKey && c.status === "published"),
    /** Drafts, for previewing pages the menus link to before they are published (e.g. Contact). */
    draftPages: content.filter((c) => c.type === "page" && !c.systemKey && c.status === "draft"),
    redirects,
    media: Object.fromEntries(media.map((m) => [m.id, { url: mediaUrl(m.path), alt: m.alt }])),
    menus: { header, footer },
    contact,
    studios,
    identity: Object.fromEntries(idMedia.map((m) => [m.id, mediaUrl(m.path)])),
    texts,
    authors,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data, null, 1));
  console.log(`Wrote ${out}: ${products.length} products, ${data.pages.length} pages, ${data.posts.length} posts, ${data.systemPages.length} site pages`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
