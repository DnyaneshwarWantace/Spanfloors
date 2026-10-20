import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Fixed-window rate limit backed by Postgres (works across server processes).
 * Returns true when the request is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`case when ${schema.rateLimits.windowStart} < now() - (${windowSeconds} || ' seconds')::interval then 1 else ${schema.rateLimits.count} + 1 end`,
        windowStart: sql`case when ${schema.rateLimits.windowStart} < now() - (${windowSeconds} || ' seconds')::interval then now() else ${schema.rateLimits.windowStart} end`,
      },
    })
    .returning({ count: schema.rateLimits.count });
  return row.count <= limit;
}
