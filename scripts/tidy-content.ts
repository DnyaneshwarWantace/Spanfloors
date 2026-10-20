/** Re-tidies imported page bodies already in the database (no requests to the old site). */
import { eq, isNotNull } from "drizzle-orm";
import { db, schema } from "../src/db";
import { sanitizeBody } from "../src/server/html";
import { tidyImported } from "../src/server/tidy";

async function main() {
  const rows = await db.select({ id: schema.content.id, body: schema.content.body }).from(schema.content).where(isNotNull(schema.content.legacyWpId));
  let changed = 0;
  for (const r of rows) {
    const body = sanitizeBody(tidyImported(r.body));
    if (body !== r.body) {
      await db.update(schema.content).set({ body }).where(eq(schema.content.id, r.id));
      changed++;
    }
  }
  console.log(`tidied ${changed} of ${rows.length} imported items`);
  process.exit(0);
}
main();
