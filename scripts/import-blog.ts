/**
 * Imports the blog subdomain (blog.spanfloors.com, WordPress + Yoast) into the new site at /blog/<slug>/.
 *
 *   npm run import:blog              posts, categories/tags, Yoast SEO, featured-image records (re-runnable)
 *   npm run import:blog -- --files   also download the posts' images into storage/uploads/blog/ (gently)
 *
 * Old blog URLs are 301-redirected to the new ones by src/proxy.ts (host blog.spanfloors.com).
 */
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { db, schema } from "../src/db";
import { cleanWordPressHtml, decodeEntities, plainText, robotsString } from "../src/server/wp-clean";

const ORIGIN = "https://blog.spanfloors.com";
const UA = { "User-Agent": "SpanFloors-Migration/1.0" };
const STORAGE = join(process.cwd(), "storage", "uploads");

type Yoast = { title?: string; description?: string; robots?: Record<string, string>; og_image?: { url: string }[] };
type WpPost = {
  id: number;
  slug: string;
  link: string;
  status: string;
  date_gmt: string;
  modified_gmt: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  categories: number[];
  tags: number[];
  yoast_head_json?: Yoast;
};
type WpTerm = { id: number; name: string };
type WpMedia = { id: number; source_url: string; mime_type: string; alt_text: string; date_gmt: string; media_details?: { width?: number; height?: number; filesize?: number } };

async function fetchAll<T>(type: string, query = ""): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 50; page++) {
    const res = await fetch(`${ORIGIN}/wp-json/wp/v2/${type}?per_page=100&page=${page}${query}`, { headers: UA });
    if (!res.ok) break;
    const batch = (await res.json()) as T[];
    if (!batch.length) break;
    out.push(...batch);
    await new Promise((r) => setTimeout(r, 300)); // gentle on the live server
  }
  return out;
}

const relFromUrl = (url: string) => decodeURIComponent(url.split("/wp-content/uploads/")[1] ?? "");

async function main() {
  const fields = "&_fields=id,slug,link,status,date_gmt,modified_gmt,title,content,excerpt,featured_media,categories,tags,yoast_head_json";
  const [posts, categories, tags] = await Promise.all([fetchAll<WpPost>("posts", fields), fetchAll<WpTerm>("categories", "&_fields=id,name"), fetchAll<WpTerm>("tags", "&_fields=id,name")]);
  const catName = new Map(categories.map((c) => [c.id, decodeEntities(c.name)]));
  const tagName = new Map(tags.map((t) => [t.id, decodeEntities(t.name)]));
  console.log(`blog: ${posts.length} posts, ${categories.length} categories, ${tags.length} tags`);

  // Featured images
  const featuredIds = [...new Set(posts.map((p) => p.featured_media).filter(Boolean))];
  const mediaById = new Map<number, string>();
  for (let i = 0; i < featuredIds.length; i += 100) {
    const batch = await fetchAll<WpMedia>("media", `&include=${featuredIds.slice(i, i + 100).join(",")}&_fields=id,source_url,mime_type,alt_text,date_gmt,media_details`);
    for (const m of batch) {
      const rel = relFromUrl(m.source_url);
      if (!rel) continue;
      const values = {
        path: `blog/${rel}`,
        filename: rel.split("/").pop() ?? rel,
        mime: m.mime_type === "image/jpg" ? "image/jpeg" : m.mime_type,
        size: m.media_details?.filesize ?? 0,
        width: m.media_details?.width ?? null,
        height: m.media_details?.height ?? null,
        alt: decodeEntities(m.alt_text ?? ""),
        legacyUrl: m.source_url,
        createdAt: new Date(`${m.date_gmt}Z`),
      };
      const [row] = await db
        .insert(schema.media)
        .values(values)
        .onConflictDoUpdate({ target: schema.media.legacyUrl, set: { ...values, createdAt: undefined } })
        .returning({ id: schema.media.id });
      mediaById.set(m.id, row.id);
    }
  }

  const tally = { published: 0, draft: 0 };
  for (const p of posts) {
    const y = p.yoast_head_json ?? {};
    const status = p.status === "publish" ? ("published" as const) : ("draft" as const);
    const values = {
      type: "post" as const,
      path: `/blog/${p.slug}/`,
      title: decodeEntities(p.title.rendered).trim() || p.slug,
      excerpt: plainText(p.excerpt.rendered).slice(0, 500),
      body: cleanWordPressHtml(p.content.rendered, {
        origins: [ORIGIN, "http://blog.spanfloors.com"],
        mediaPrefix: "blog",
        // Links between blog posts point at their new /blog/ addresses; links to the main site become relative.
        linkRewrites: [
          [`${ORIGIN}/`, "/blog/"],
          ["https://www.spanfloors.com/", "/"],
          ["https://spanfloors.com/", "/"],
        ],
      }),
      featuredMediaId: mediaById.get(p.featured_media) ?? null,
      status,
      publishedAt: new Date(`${p.date_gmt}Z`),
      seoTitle: y.title ? decodeEntities(y.title) : null,
      seoDescription: y.description ? decodeEntities(y.description) : null,
      robots: robotsString(y.robots),
      tags: [...new Set([...p.categories.map((c) => catName.get(c)), ...p.tags.map((t) => tagName.get(t))].filter((x): x is string => Boolean(x) && x !== "Uncategorized"))],
      legacyWpId: p.id,
      legacyWpType: "blog",
      updatedAt: new Date(`${p.modified_gmt}Z`),
    };
    await db.insert(schema.content).values(values).onConflictDoUpdate({ target: [schema.content.legacyWpType, schema.content.legacyWpId], set: values });
    tally[status]++;
  }
  console.log("content:", tally);

  if (process.argv.includes("--files")) await downloadFiles();
  process.exit(0);
}

async function downloadFiles() {
  const rows = await db.select({ body: schema.content.body }).from(schema.content);
  const media = await db.select({ path: schema.media.path, url: schema.media.legacyUrl }).from(schema.media);
  const jobs = new Map<string, string>();
  for (const m of media) if (m.path.startsWith("blog/") && m.url) jobs.set(m.path, m.url);
  for (const r of rows) for (const m of r.body.matchAll(/\/media\/blog\/([^"'\s)]+)/g)) jobs.set(`blog/${decodeURIComponent(m[1])}`, `${ORIGIN}/wp-content/uploads/${m[1]}`);
  const queue = [...jobs.entries()].filter(([p]) => !existsSync(join(STORAGE, p)));
  console.log(`files: ${jobs.size} referenced, ${queue.length} to download`);
  let done = 0;
  let failed = 0;
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [rel, url] = job;
      try {
        const res = await fetch(url, { headers: UA });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const dest = join(STORAGE, rel);
        mkdirSync(dirname(dest), { recursive: true });
        await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
      } catch {
        failed++;
        if (failed >= 10 && failed > done / 2) {
          console.error("Server is refusing downloads; stopping.");
          queue.length = 0;
        }
      }
      done++;
      await new Promise((r) => setTimeout(r, 300));
    }
  };
  await Promise.all([worker(), worker()]);
  console.log(`files: done, ${failed} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
