/**
 * Imported HTML often points at WordPress resized copies (photo-1024x683.jpg). We store the
 * originals, so when a resized copy is missing but its original exists, point the link at the original.
 *   npm run content:fix-images
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";

const ROOT = join(process.cwd(), "storage", "uploads");

async function main() {
  const rows = await db.select({ id: schema.content.id, body: schema.content.body }).from(schema.content);
  let items = 0;
  let links = 0;
  for (const r of rows) {
    const body = r.body.replace(/\/media\/((?:wp|blog)\/[^"'\s)]+?)-\d{2,4}x\d{2,4}(\.[a-z0-9]+)/gi, (whole, base: string, ext: string) => {
      const sized = decodeURIComponent(whole.replace(/^\/media\//, ""));
      if (existsSync(join(ROOT, sized))) return whole; // resized copy exists: keep it
      if (!existsSync(join(ROOT, decodeURIComponent(base + ext)))) return whole; // original missing too
      links++;
      return `/media/${base}${ext}`;
    });
    if (body !== r.body) {
      await db.update(schema.content).set({ body }).where(eq(schema.content.id, r.id));
      items++;
    }
  }
  console.log(`pointed ${links} resized-image links at their originals in ${items} items`);
  process.exit(0);
}
main();
