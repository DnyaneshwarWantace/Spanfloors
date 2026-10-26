import "server-only";
import { count, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { TwentyProduct } from "@/lib/twenty";
import { getSetting } from "./settings";

/* Admin → Products: possible duplicates in Twenty, and products that arrived since someone last looked. */

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export type DuplicateGroup = { reason: string; products: { id: string; name: string }[] };

/** Products with the same name, or sharing one image ID, in Twenty. Fixed in Twenty; the website only reports them. */
export function findDuplicates(products: TwentyProduct[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const by = (key: (p: TwentyProduct) => string | null, reason: string) => {
    const map = new Map<string, TwentyProduct[]>();
    for (const p of products) {
      const k = key(p);
      if (k) map.set(k, [...(map.get(k) ?? []), p]);
    }
    for (const list of map.values()) if (list.length > 1) groups.push({ reason, products: list.map((p) => ({ id: p.id, name: p.name })) });
  };
  by((p) => norm(p.name) || null, "Same name");
  by((p) => p.imageId?.trim() || null, "Same image ID (allsyDecorImageId)");
  return groups;
}

/** Products first seen by the website after the last "mark as seen". The first run records today's list as known. */
export async function newProducts(products: TwentyProduct[]) {
  const [{ n }] = await db.select({ n: count() }).from(schema.productSeen);
  const ids = products.map((p) => p.id);
  if (ids.length) {
    // On the very first run everything counts as already known.
    const first = n === 0 ? new Date("2000-01-01T00:00:00Z") : new Date();
    await db
      .insert(schema.productSeen)
      .values(ids.map((id) => ({ twentyId: id, firstSeen: first })))
      .onConflictDoNothing();
  }
  const reviewed = new Date((await getSetting("products.reviewedAt")) || "2000-01-01T00:00:00Z");
  const rows = await db.select().from(schema.productSeen).where(sql`${schema.productSeen.firstSeen} > ${reviewed.toISOString()}`);
  const fresh = new Set(rows.map((r) => r.twentyId));
  return products.filter((p) => fresh.has(p.id));
}
