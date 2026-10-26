/**
 * One-off clean-up for existing media (safe to re-run):
 *  - records a fingerprint (SHA-256) for every file on this server, so duplicate uploads are caught;
 *  - puts imported files into folders ("Old website", "Old blog") when they have none;
 *  - reports files that are stored more than once.
 *   npm run media:backfill
 */
import { createReadStream, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import { db, schema } from "../src/db";
import { resolveStored } from "../src/server/storage";

const hashFile = (path: string) =>
  new Promise<string>((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });

(async () => {
  const rows = await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(isNull(schema.media.sha256));
  let hashed = 0;
  for (const r of rows) {
    const full = resolveStored(r.path);
    if (!full || !existsSync(full)) continue;
    await db.update(schema.media).set({ sha256: await hashFile(full) }).where(eq(schema.media.id, r.id));
    if (++hashed % 200 === 0) console.log(`  ${hashed} fingerprinted…`);
  }
  const wp = await db.update(schema.media).set({ folder: "Old website" }).where(and(like(schema.media.path, "wp/%"), eq(schema.media.folder, ""))).returning({ id: schema.media.id });
  const blog = await db.update(schema.media).set({ folder: "Old blog" }).where(and(like(schema.media.path, "blog/%"), eq(schema.media.folder, ""))).returning({ id: schema.media.id });
  const dups = await db.execute<{ n: number; copies: number }>(sql`select count(*)::int as n, coalesce(sum(c - 1), 0)::int as copies from (select sha256, count(*) as c from media where sha256 is not null group by sha256 having count(*) > 1) d`);
  console.log(`fingerprinted ${hashed} files; folders: ${wp.length} → Old website, ${blog.length} → Old blog; ${dups.rows[0].n} files stored more than once (${dups.rows[0].copies} extra copies)`);
  process.exit(0);
})();
