import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { getSettings } from "@/server/settings";

/**
 * Shows an Allsy photo by its ID (the ID the client puts on a product in Twenty). Asks Allsy's Content API
 * with our key for a fresh signed link. Allsy's links last about a day, so each link is reused for up to an hour.
 *
 * Without `?w=`: sends the browser to Allsy's link (nothing kept here).
 * With `?w=480|960|1600`: a web-sized copy (WebP) so pages load fast. Allsy's originals are 1–3 MB each and slow
 * to fetch, so the resized copy is kept in storage/cache/allsy/ (not the media library) and fetched again from
 * Allsy after a week, so a photo the client changes in Allsy shows within a week (delete the folder to refresh now).
 */
const links = new Map<string, { url: string; until: number }>();
const WIDTHS = new Set([480, 960, 1600]);
const CACHE_DIR = join(process.cwd(), "storage", "cache", "allsy");
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const working = new Map<string, Promise<Buffer | null>>();

async function signedUrl(id: string, size: "imageUrl" | "thumbnailUrl") {
  const cacheKey = `${id}:${size}`;
  const hit = links.get(cacheKey);
  if (hit && hit.until > Date.now()) return hit.url;
  const cfg = await getSettings(["allsy.apiUrl", "allsy.apiKey"]);
  const base = (cfg["allsy.apiUrl"] || "https://allsy.fly.dev/api/content/v1").replace(/\/$/, "");
  if (!cfg["allsy.apiKey"]) return null;
  const res = await fetch(`${base}/images/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${cfg["allsy.apiKey"]}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = ((await res.json()) as { data?: { imageUrl?: string; thumbnailUrl?: string; urlExpiresAt?: string } }).data;
  const url = data?.[size];
  if (!url) return null;
  const expires = data?.urlExpiresAt ? Date.parse(data.urlExpiresAt) : Date.now() + 3_600_000;
  links.set(cacheKey, { url, until: Math.min(Date.now() + 3_600_000, expires - 300_000) });
  return url;
}

async function resized(id: string, w: number): Promise<Buffer | null> {
  const file = join(CACHE_DIR, `${id}-${w}.webp`);
  const kept = await stat(file).catch(() => null);
  if (kept && Date.now() - kept.mtimeMs < MAX_AGE_MS) return readFile(file);
  const url = await signedUrl(id, "imageUrl");
  const res = url ? await fetch(url, { signal: AbortSignal.timeout(25_000) }).catch(() => null) : null;
  if (!res?.ok) return kept ? readFile(file) : null; // Allsy down: keep showing the copy we have
  const out = await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer()
    .catch(() => null);
  if (!out) return null;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, out);
  return out;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;

  const w = Number(q.get("w"));
  if (WIDTHS.has(w)) {
    const key = `${id}-${w}`;
    if (!working.has(key)) working.set(key, resized(id, w).finally(() => working.delete(key)));
    const body = await working.get(key)!;
    if (!body) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    });
  }

  const url = await signedUrl(id, q.get("size") === "medium" ? "thumbnailUrl" : "imageUrl");
  if (!url) return new Response("Not found", { status: 404 });
  return Response.redirect(url, 302);
}
