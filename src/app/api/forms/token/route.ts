import { issueFormToken } from "@/server/form-token";
import { getSettings } from "@/server/settings";

/** Issues the anti-bot token every form must send back as `_t` (plus the optional Turnstile site key). */
export async function GET() {
  const { "turnstile.siteKey": turnstileSiteKey } = await getSettings(["turnstile.siteKey"]);
  return Response.json({ token: issueFormToken(), turnstileSiteKey: turnstileSiteKey ?? null }, { headers: { "Cache-Control": "no-store" } });
}
