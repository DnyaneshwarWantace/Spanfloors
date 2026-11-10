import { getSettings } from "@/server/settings";

/**
 * Shows an Allsy photo by its ID (the ID the client puts on a product in Twenty). Asks Allsy's Content API
 * with our key for a fresh signed link and sends the browser there; nothing is downloaded or stored here.
 * Allsy's links last about a day, so each link is reused for up to an hour.
 */
const links = new Map<string, { url: string; until: number }>();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const size = new URL(req.url).searchParams.get("size") === "medium" ? "thumbnailUrl" : "imageUrl";
  const cacheKey = `${id}:${size}`;
  const hit = links.get(cacheKey);
  if (hit && hit.until > Date.now()) return Response.redirect(hit.url, 302);

  const cfg = await getSettings(["allsy.apiUrl", "allsy.apiKey"]);
  const base = (cfg["allsy.apiUrl"] || "https://allsy.fly.dev/api/content/v1").replace(/\/$/, "");
  if (!cfg["allsy.apiKey"]) return new Response("Allsy is not set up", { status: 404 });
  const res = await fetch(`${base}/images/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${cfg["allsy.apiKey"]}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return new Response("Not found", { status: 404 });
  const data = ((await res.json()) as { data?: { imageUrl?: string; thumbnailUrl?: string; urlExpiresAt?: string } }).data;
  const url = data?.[size];
  if (!url) return new Response("Not found", { status: 404 });
  const expires = data?.urlExpiresAt ? Date.parse(data.urlExpiresAt) : Date.now() + 3_600_000;
  links.set(cacheKey, { url, until: Math.min(Date.now() + 3_600_000, expires - 300_000) });
  return Response.redirect(url, 302);
}
