import { indexNowKey } from "@/server/indexnow";

export const dynamic = "force-dynamic";

/** The IndexNow key file (search engines check it to confirm pings come from this site). */
export async function GET() {
  return new Response(await indexNowKey(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
