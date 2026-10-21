/**
 * Completes the blog import from the WordPress export file (Tools → Export → All content):
 * every media-library item (not only the ones used in posts) and draft posts.
 *
 *   npm run import:blog-xml -- wordpress/spanfloors.WordPress.2026-10-20.xml [--files]
 *
 * --files downloads media not yet on disk, 2 at a time with pauses (gentle on the live server).
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { XMLParser } from "fast-xml-parser";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { cleanWordPressHtml, decodeEntities, plainText } from "../src/server/wp-clean";
import { slugify } from "../src/server/html";

const ORIGIN = "https://blog.spanfloors.com";
const STORAGE = join(process.cwd(), "storage", "uploads");
const UA = { "User-Agent": "SpanFloors-Migration/1.0" };
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf", mp4: "video/mp4", svg: "image/svg+xml" };

type Meta = { "wp:meta_key": string; "wp:meta_value": unknown };
type Item = Record<string, unknown> & { "wp:postmeta"?: Meta | Meta[] };

const text = (v: unknown) => (v == null ? "" : String(v));
const metaOf = (it: Item, key: string) => {
  const list = Array.isArray(it["wp:postmeta"]) ? it["wp:postmeta"] : it["wp:postmeta"] ? [it["wp:postmeta"]] : [];
  return text(list.find((m) => m["wp:meta_key"] === key)?.["wp:meta_value"]);
};

async function main() {
  const file = process.argv[2];
  if (!file || !existsSync(file)) throw new Error("Pass the path to the WordPress export XML");
  const parser = new XMLParser({ ignoreAttributes: true, cdataPropName: false, parseTagValue: false, trimValues: false });
  const items: Item[] = [].concat(parser.parse(readFileSync(file, "utf8")).rss.channel.item ?? []);

  // 1) Every media-library item
  let media = 0;
  for (const it of items.filter((i) => i["wp:post_type"] === "attachment")) {
    const url = text(it["wp:attachment_url"]);
    const rel = decodeURIComponent(url.split("/wp-content/uploads/")[1] ?? "");
    if (!rel) continue;
    const ext = rel.split(".").pop()!.toLowerCase();
    const values = {
      path: `blog/${rel}`,
      filename: rel.split("/").pop()!,
      mime: MIME[ext] ?? "application/octet-stream",
      alt: decodeEntities(metaOf(it, "_wp_attachment_image_alt")),
      caption: plainText(text(it["excerpt:encoded"])),
      legacyUrl: url,
      createdAt: new Date(`${text(it["wp:post_date_gmt"]).replace(" ", "T")}Z`),
    };
    if (Number.isNaN(values.createdAt.getTime())) values.createdAt = new Date();
    await db.insert(schema.media).values(values).onConflictDoUpdate({ target: schema.media.legacyUrl, set: { alt: values.alt, caption: values.caption } });
    media++;
  }
  console.log(`media: ${media} library items recorded`);

  // 2) Original authors (display names) for every blog post
  const channel = parser.parse(readFileSync(file, "utf8")).rss.channel;
  const authors = new Map<string, string>(
    ([] as Record<string, unknown>[]).concat(channel["wp:author"] ?? []).map((a) => [text(a["wp:author_login"]), decodeEntities(text(a["wp:author_display_name"]))]),
  );
  let bylines = 0;
  for (const it of items.filter((i) => i["wp:post_type"] === "post")) {
    const name = authors.get(text(it["dc:creator"]));
    if (!name) continue;
    await db
      .update(schema.content)
      .set({ authorName: name })
      .where(and(eq(schema.content.legacyWpType, "blog"), eq(schema.content.legacyWpId, Number(it["wp:post_id"]))));
    bylines++;
  }
  console.log(`authors: ${bylines} posts got their original byline`);

  // 3) Draft posts with a title (empty placeholder drafts are skipped)
  let drafts = 0;
  for (const it of items.filter((i) => i["wp:post_type"] === "post" && i["wp:status"] !== "publish")) {
    const title = decodeEntities(text(it.title)).trim();
    if (!title) continue;
    const slug = text(it["wp:post_name"]) || slugify(title);
    const wpId = Number(it["wp:post_id"]);
    // A draft may share its slug with a published post (e.g. an older copy): keep it apart.
    const [taken] = await db.select({ id: schema.content.legacyWpId }).from(schema.content).where(eq(schema.content.path, `/blog/${slug}/`));
    const path = taken && taken.id !== wpId ? `/blog/${slug}-draft-${wpId}/` : `/blog/${slug}/`;
    const values = {
      type: "post" as const,
      path,
      title,
      excerpt: plainText(text(it["excerpt:encoded"])).slice(0, 500),
      body: cleanWordPressHtml(text(it["content:encoded"]), { origins: [ORIGIN, "http://15.206.73.48"], mediaPrefix: "blog", linkRewrites: [[`${ORIGIN}/`, "/blog/"]] }),
      status: "draft" as const,
      legacyWpId: Number(it["wp:post_id"]),
      legacyWpType: "blog",
      updatedAt: new Date(),
    };
    await db.insert(schema.content).values(values).onConflictDoUpdate({ target: [schema.content.legacyWpType, schema.content.legacyWpId], set: values });
    drafts++;
    console.log(`  draft: ${title}`);
  }
  console.log(`drafts: ${drafts} imported (as drafts)`);

  if (process.argv.includes("--files")) await download();
  process.exit(0);
}

async function download() {
  const rows = await db.select({ path: schema.media.path, url: schema.media.legacyUrl }).from(schema.media);
  const queue = rows.filter((r) => r.path.startsWith("blog/") && r.url && !existsSync(join(STORAGE, r.path)));
  console.log(`files: ${queue.length} to download`);
  let done = 0;
  let failed = 0;
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const res = await fetch(job.url!, { headers: UA });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const dest = join(STORAGE, job.path);
        mkdirSync(dirname(dest), { recursive: true });
        await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
      } catch {
        failed++;
        if (failed >= 10 && failed > done / 2) {
          console.error("Server is refusing downloads; stopping.");
          queue.length = 0;
        }
      }
      if (++done % 100 === 0) console.log(`  ${done} done…`);
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
