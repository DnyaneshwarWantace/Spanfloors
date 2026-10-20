import { timingSafeEqual } from "node:crypto";
import { retryPendingLeads } from "@/server/twenty-leads";

/**
 * Retries sending waiting leads to Twenty. Call every 5 minutes from the server's cron:
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://www.spanfloors.com/api/cron/sync-leads
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await retryPendingLeads(50), { headers: { "Cache-Control": "no-store" } });
}
