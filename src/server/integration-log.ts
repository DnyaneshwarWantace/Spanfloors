import "server-only";
import { lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type Service = "email" | "twenty" | "allsy" | "pagespeed" | "ai" | "indexnow";

/** Keeps the log to the last 90 days. */
const KEEP_DAYS = 90;

/**
 * Records one call to an outside service (sent email, lead copied to Twenty, test button…) for Admin →
 * Integrations → Log. Never throws: logging must not break the thing being logged. Never pass keys or passwords.
 */
export async function logIntegration(service: Service, action: string, ok: boolean, message = "", userId: string | null = null) {
  try {
    await db.insert(schema.integrationLog).values({ service, action: action.slice(0, 60), ok, message: message.slice(0, 500), userId });
    if (Math.random() < 0.02) await db.delete(schema.integrationLog).where(lt(schema.integrationLog.createdAt, sql`now() - ${`${KEEP_DAYS} days`}::interval`));
  } catch (e) {
    console.error("integration log failed:", e instanceof Error ? e.message : e);
  }
}
