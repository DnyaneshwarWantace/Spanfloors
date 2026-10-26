/**
 * Points old links inside content at the new site (safe to re-run):
 *   /wp-content/uploads/…            → /media/wp/…
 *   https://blog.spanfloors.com/x/   → /blog/x/   (only when that post exists here; archives → /blog/)
 *   https://www.spanfloors.com/…     → /…
 *
 *   npm run content:fix-links [-- --dry]
 */
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";

async function main() {
  const dry = process.argv.includes("--dry");
  const rows = await db.select({ id: schema.content.id, path: schema.content.path, body: schema.content.body }).from(schema.content);
  const paths = new Set(rows.map((r) => r.path));
  let changed = 0;
  const unresolved = new Set<string>();

  for (const r of rows) {
    const body = r.body
      .replace(/(href|src)="(?:https?:\/\/(?:www\.)?spanfloors\.com)?\/wp-content\/uploads\//gi, '$1="/media/wp/')
      .replace(/href="https?:\/\/blog\.spanfloors\.com(\/[^"#?]*)?([^"]*)"/gi, (all, p: string | undefined, rest: string) => {
        const slug = (p ?? "/").replace(/\/?$/, "/");
        if (slug === "/" || /^\/(category|tag|author|page)\//.test(slug)) return `href="/blog/"`;
        if (paths.has(`/blog${slug}`)) return `href="/blog${slug}${rest}"`;
        unresolved.add(all);
        return all;
      })
      .replace(/href="https?:\/\/(?:www\.)?spanfloors\.com(\/[^"]*)?"/gi, (_, p: string | undefined) => `href="${p || "/"}"`);
    if (body !== r.body) {
      changed++;
      if (!dry) await db.update(schema.content).set({ body }).where(eq(schema.content.id, r.id));
    }
  }
  console.log(`${dry ? "would change" : "changed"} ${changed} items`);
  for (const u of unresolved) console.log(`  blog link with no matching post: ${u}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
