/**
 * Downloads only the old-site media files that published pages/posts actually use
 * (images in the body + featured images), skipping files already in storage/uploads.
 *
 *   npm run media:fetch-used            download (2 at a time, gently; stops if the site starts refusing)
 *   npm run media:fetch-used -- --dry   just list what's missing
 */
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { inArray } from "drizzle-orm";
import { db, schema } from "../src/db";

const UPLOADS = "https://www.spanfloors.com/wp-content/uploads/";
const STORAGE = join(process.cwd(), "storage", "uploads");
const UA = { "User-Agent": "Mozilla/5.0 (SpanFloors-Migration/1.0)" };

async function main() {
  const live = await db
    .select({ body: schema.content.body, featured: schema.content.featuredMediaId })
    .from(schema.content)
    .where(inArray(schema.content.status, ["published", "scheduled"]));

  const needed = new Map<string, string>(); // storage path → source URL
  for (const r of live)
    for (const m of r.body.matchAll(/\/media\/(wp\/[^"'\s)?#]+)/g)) {
      const rel = decodeURIComponent(m[1]);
      needed.set(rel, UPLOADS + rel.slice(3).split("/").map(encodeURIComponent).join("/"));
    }
  const featuredIds = live.map((r) => r.featured).filter((v): v is string => Boolean(v));
  if (featuredIds.length) {
    const rows = await db.select({ path: schema.media.path, url: schema.media.legacyUrl }).from(schema.media).where(inArray(schema.media.id, featuredIds));
    for (const r of rows) if (r.path.startsWith("wp/") && r.url) needed.set(r.path, r.url);
  }

  const queue = [...needed.entries()].filter(([p]) => !existsSync(join(STORAGE, p)));
  console.log(`used by live pages: ${needed.size} files, ${queue.length} missing`);
  if (process.argv.includes("--dry")) {
    for (const [p] of queue) console.log(`  ${p}`);
    process.exit(0);
  }

  let ok = 0;
  let notFound = 0;
  let refused = 0;
  let stopped = false;
  const worker = async () => {
    for (let job = queue.shift(); job && !stopped; job = queue.shift()) {
      const [rel, url] = job;
      const dest = join(STORAGE, rel);
      try {
        const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) });
        if (res.status === 404) {
          notFound++;
          continue;
        }
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !res.body || type.includes("text/html")) throw new Error(`${res.status} ${type}`);
        mkdirSync(dirname(dest), { recursive: true });
        await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
        if (statSync(dest).size === 0) throw new Error("empty");
        ok++;
        refused = 0;
        if (ok % 50 === 0) console.log(`  ${ok} downloaded…`);
      } catch (e) {
        if (existsSync(dest)) unlinkSync(dest);
        console.warn(`  failed ${rel}: ${(e as Error).message}`);
        // 5 refusals in a row = firewall kicked in; stop rather than hammer the live site.
        if (++refused >= 5) {
          stopped = true;
          console.error("The old site is refusing downloads. Stopped; re-run later (already downloaded files are kept).");
        }
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));
  console.log(`done: ${ok} downloaded, ${notFound} not on the old site (404), ${queue.length} left`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
