/**
 * Imports the current spanfloors.com (WordPress) into the new database.
 *
 *   npm run import:wp              pages, articles, media records (safe to re-run: updates in place)
 *   npm run import:wp -- --files   also download media files into storage/uploads (~1.9 GB), 2 at a time, gently
 *   npm run import:wp -- --from-dir /path/to/wp-content/uploads
 *                                  copy media from a backup of the uploads folder instead (preferred: no load on the live site)
 *
 * Reads only from the public WordPress REST API. Product pages under the collection URLs are
 * imported as "archived" because those URLs are now served live from Twenty.
 */
import { copyFileSync, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import sanitizeHtml from "sanitize-html";
import { db, schema } from "../src/db";
import legacySeo from "../src/data/legacy-seo.json";
import { tidyImported } from "../src/server/tidy";

const ORIGIN = "https://www.spanfloors.com";
const UPLOADS = `${ORIGIN}/wp-content/uploads/`;
const STORAGE = join(process.cwd(), "storage", "uploads");
const UA = { "User-Agent": "SpanFloors-Migration/1.0" };
const SEO = legacySeo as Record<string, { title: string | null; description: string | null; robots: string | null }>;

type WpItem = {
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
};
type WpMedia = {
  id: number;
  source_url: string;
  mime_type: string;
  alt_text: string;
  date_gmt: string;
  caption: { rendered: string };
  media_details?: { width?: number; height?: number; filesize?: number };
};

async function fetchAll<T>(type: string, fields: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 100; page++) {
    const res = await fetch(`${ORIGIN}/wp-json/wp/v2/${type}?per_page=100&page=${page}&_fields=${fields}`, { headers: UA });
    if (!res.ok) break;
    const batch = (await res.json()) as T[];
    if (!batch.length) break;
    out.push(...batch);
  }
  return out;
}

/** Product & category URLs are now owned by the Twenty-driven catalogue. */
const CATALOGUE = /^\/(engineered-wood-flooring|laminate-flooring|composite-flooring|decking|facades)-collection\//;
/** Pages that are really articles (WordPress "posts" on this site are empty test entries). */
const ARTICLE = /(guide|how-to|confused-about|launches|-tips|-vs-|why-choose|benefits)/;
/** Builder drafts, popups and thank-you pages: imported but not published. */
const UTILITY = /(-development|-new-design|popup|page-not-found|thank-you|-lp\/$|^\/x(-\d+)?\/$)/;

function decodeEntities(s: string) {
  return s
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Strips page-builder wrappers and inline styling, keeping readable content only. */
function cleanBody(html: string): string {
  const withoutShortcodes = html.replace(/\[\/?et_pb[^\]]*\]/g, "").replace(/\[\/?[a-z_]+[^\]]*\]/g, "");
  const clean = sanitizeHtml(withoutShortcodes, {
    allowedTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "blockquote", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "iframe"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "player.vimeo.com", "www.google.com"],
    transformTags: {
      b: "strong",
      i: "em",
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, src: attribs["data-src"] ?? attribs.src ?? "" } }),
    },
    exclusiveFilter: (frame) => (frame.tag === "p" || frame.tag === "a") && !frame.text.trim() && !frame.mediaChildren?.length,
  });
  return clean
    .replaceAll(UPLOADS, "/media/wp/")
    .replace(/https?:\/\/(www\.)?spanfloors\.net\/wp-content\/uploads\//g, "/media/wp/")
    .replace(/https?:\/\/blog\.spanfloors\.com\/wp-content\/uploads\//g, "/media/blog/")
    .replaceAll(`${ORIGIN.replace("www.", "")}/wp-content/uploads/`, "/media/wp/")
    .replaceAll(`href="${ORIGIN}/`, 'href="/')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pathOf(link: string) {
  const u = new URL(link);
  return u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
}

async function importMedia(): Promise<Map<number, string>> {
  const items = await fetchAll<WpMedia>("media", "id,source_url,mime_type,alt_text,date_gmt,caption,media_details");
  const byWpId = new Map<number, string>();
  for (const m of items) {
    if (!m.source_url.includes("/wp-content/uploads/")) continue;
    const rel = m.source_url.split("/wp-content/uploads/")[1];
    const values = {
      path: `wp/${decodeURIComponent(rel)}`,
      filename: decodeURIComponent(rel.split("/").pop() ?? rel),
      mime: m.mime_type === "image/jpg" ? "image/jpeg" : m.mime_type,
      size: m.media_details?.filesize ?? 0,
      width: m.media_details?.width ?? null,
      height: m.media_details?.height ?? null,
      alt: decodeEntities(m.alt_text ?? ""),
      caption: decodeEntities(sanitizeHtml(m.caption?.rendered ?? "", { allowedTags: [] })).trim(),
      legacyUrl: m.source_url,
      legacyWpId: m.id,
      createdAt: new Date(`${m.date_gmt}Z`),
    };
    const [row] = await db
      .insert(schema.media)
      .values(values)
      .onConflictDoUpdate({ target: schema.media.legacyWpId, set: { ...values, createdAt: undefined } })
      .returning({ id: schema.media.id });
    byWpId.set(m.id, row.id);
  }
  console.log(`media: ${byWpId.size} records`);
  return byWpId;
}

async function importContent(mediaIds: Map<number, string>) {
  const fields = "id,slug,link,status,date_gmt,modified_gmt,title,content,excerpt,featured_media";
  const [pages, posts] = await Promise.all([fetchAll<WpItem>("pages", fields), fetchAll<WpItem>("posts", fields)]);
  const tally = { published: 0, archived: 0, draft: 0, articles: 0 };

  for (const [wpType, items] of [
    ["page", pages],
    ["post", posts],
  ] as const) {
    for (const it of items) {
      const path = pathOf(it.link);
      const title = decodeEntities(it.title.rendered).trim() || it.slug;
      const isArticle = wpType === "post" || ARTICLE.test(path);
      // Published only if it was a real page on the live site (listed in its sitemap); builder leftovers stay as drafts.
      const status: "archived" | "draft" | "published" = CATALOGUE.test(path)
        ? "archived"
        : UTILITY.test(path) || it.status !== "publish" || title === "x" || !SEO[path]
          ? "draft"
          : "published";
      const seo = SEO[path];
      const values = {
        type: isArticle ? ("post" as const) : ("page" as const),
        path,
        title,
        excerpt: decodeEntities(sanitizeHtml(it.excerpt.rendered, { allowedTags: [] })).trim().slice(0, 500),
        body: tidyImported(cleanBody(it.content.rendered)),
        featuredMediaId: mediaIds.get(it.featured_media) ?? null,
        status,
        publishedAt: new Date(`${it.date_gmt}Z`),
        seoTitle: seo?.title ?? null,
        seoDescription: seo?.description ?? null,
        robots: seo?.robots ?? null,
        legacyWpId: it.id,
        legacyWpType: wpType,
        updatedAt: new Date(`${it.modified_gmt}Z`),
      };
      await db
        .insert(schema.content)
        .values(values)
        .onConflictDoUpdate({ target: [schema.content.legacyWpType, schema.content.legacyWpId], set: values });
      tally[status]++;
      if (isArticle && status === "published") tally.articles++;
    }
  }
  console.log(`content: ${pages.length} pages + ${posts.length} posts →`, tally);
}

async function downloadFiles() {
  const rows = await db.select({ path: schema.media.path, url: schema.media.legacyUrl }).from(schema.media);
  // Plus resized variants referenced inside page bodies (e.g. photo-1024x683.jpg)
  const bodies = await db.select({ body: schema.content.body }).from(schema.content);
  const referenced = new Set<string>();
  for (const b of bodies) for (const m of b.body.matchAll(/\/media\/wp\/([^"'\s)]+)/g)) referenced.add(decodeURIComponent(m[1]));
  const jobs = new Map<string, string>();
  for (const r of rows) if (r.url) jobs.set(r.path, r.url);
  for (const rel of referenced) jobs.set(`wp/${rel}`, UPLOADS + rel.split("/").map(encodeURIComponent).join("/"));

  const queue = [...jobs.entries()].filter(([p]) => !existsSync(join(STORAGE, p)));
  console.log(`files: ${jobs.size} total, ${queue.length} to download`);
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
          console.error("Server is refusing downloads (likely rate-limited). Stopping; use --from-dir with an uploads backup instead.");
          queue.length = 0;
        }
      }
      await new Promise((r) => setTimeout(r, 250));
      if (++done % 200 === 0) console.log(`  ${done} downloaded…`);
    }
  };
  // Gentle on the live server: 2 parallel downloads with a pause, and stop if the server starts refusing us.
  await Promise.all(Array.from({ length: 2 }, worker));
  console.log(`files: done (${failed} failed)`);
}

/** Copies media from a local backup of wp-content/uploads (no requests to the live site). */
function copyFromDir(dir: string) {
  return db.select({ path: schema.media.path }).from(schema.media).then((rows) => {
    let copied = 0;
    let missing = 0;
    for (const r of rows) {
      const rel = r.path.replace(/^wp\//, "");
      const src = join(dir, rel);
      const dest = join(STORAGE, r.path);
      if (existsSync(dest)) continue;
      if (!existsSync(src)) {
        missing++;
        continue;
      }
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      copied++;
    }
    console.log(`files: copied ${copied} from ${dir} (${missing} not found in backup)`);
  });
}

async function main() {
  const mediaIds = await importMedia();
  await importContent(mediaIds);
  const fromDir = process.argv[process.argv.indexOf("--from-dir") + 1];
  if (process.argv.includes("--from-dir") && fromDir) await copyFromDir(fromDir);
  else if (process.argv.includes("--files")) await downloadFiles();
  console.log(`done: ${await db.$count(schema.content)} content items, ${await db.$count(schema.media)} media records in database`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

