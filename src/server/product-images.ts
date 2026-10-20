import "server-only";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { getSettings } from "./settings";
import { assetsByIds } from "./allsy";

/**
 * Connector for the external product-image service (images referenced by ID from Twenty's
 * `allsyDecorImageId`, plus extra IDs added in the admin).
 *
 * - mode "allsy":    (default) images synced from Allsy.io (see allsy.ts), resolved in the catalogue.
 * - mode "template": public URLs built from a template, used directly by browsers.
 * - mode "api":      a private API needing a key. Our server fetches the image (key never leaves the
 *                    server), validates it really is an image, caches it on disk and serves it at
 *                    /product-image/<id>/.
 * - mode "none":     no external images (products use uploaded images or the placeholder).
 */

const CACHE_DIR = join(process.cwd(), "storage", "cache", "product-images");
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export const isValidImageId = (id: string) => /^[A-Za-z0-9._-]{1,128}$/.test(id);

export async function imageConfig() {
  const c = await getSettings([
    "images.mode",
    "images.urlTemplate",
    "images.apiUrl",
    "images.apiKey",
    "images.apiKeyHeader",
    "images.apiKeyPrefix",
    "images.jsonPath",
  ]);
  const mode = (c["images.mode"] ?? "allsy") as "allsy" | "none" | "template" | "api";
  return {
    mode,
    urlTemplate: c["images.urlTemplate"],
    apiUrl: c["images.apiUrl"],
    apiKey: c["images.apiKey"],
    apiKeyHeader: c["images.apiKeyHeader"] || "Authorization",
    apiKeyPrefix: c["images.apiKeyPrefix"] ?? "",
    jsonPath: c["images.jsonPath"],
  };
}

export type ImageConfig = Awaited<ReturnType<typeof imageConfig>>;

/** Public URL for an external image ID, or null if the connector isn't set up. */
export function externalImageUrl(id: string, cfg: ImageConfig): string | null {
  if (!isValidImageId(id)) return null;
  if (cfg.mode === "template" && cfg.urlTemplate?.includes("{id}")) return cfg.urlTemplate.replace("{id}", encodeURIComponent(id));
  if (cfg.mode === "api" && cfg.apiUrl?.includes("{id}")) return `/product-image/${encodeURIComponent(id)}/`;
  return null;
}

function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

async function fetchLimited(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { method: "GET", headers, redirect: "follow", signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Image service answered ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("Image too large");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Image too large");
  return { buf, contentType: res.headers.get("content-type") ?? "" };
}

/** Fetches (or reads from cache) the image for an ID via the private API. */
export async function loadApiImage(id: string, opts: { bypassCache?: boolean } = {}): Promise<{ buf: Buffer; mime: string }> {
  if (!isValidImageId(id)) throw new Error("Invalid image ID");
  const cfg = await imageConfig();
  if (cfg.mode !== "api" || !cfg.apiUrl?.includes("{id}")) throw new Error("Image API is not configured");

  const cacheFile = join(CACHE_DIR, id);
  if (!opts.bypassCache) {
    try {
      const s = await stat(cacheFile);
      if (Date.now() - s.mtimeMs < CACHE_TTL_MS) {
        const buf = await readFile(cacheFile);
        const t = await fileTypeFromBuffer(buf);
        if (t && IMAGE_TYPES.has(t.mime)) return { buf, mime: t.mime };
      }
    } catch {}
  }

  const url = cfg.apiUrl.replace("{id}", encodeURIComponent(id));
  if (!/^https:\/\//.test(url)) throw new Error("Image API must use https");
  const auth: Record<string, string> = cfg.apiKey ? { [cfg.apiKeyHeader]: `${cfg.apiKeyPrefix}${cfg.apiKey}` } : {};
  let { buf, contentType } = await fetchLimited(url, { ...auth, Accept: "image/*,application/json" });

  // JSON response: follow the configured path to the real image URL.
  if (contentType.includes("json")) {
    const target = pick(JSON.parse(buf.toString("utf8")), cfg.jsonPath || "url");
    if (typeof target !== "string" || !/^https:\/\//.test(target)) throw new Error("Couldn’t find an https image URL in the API response (check the JSON path)");
    // Only send the key back to the same host it belongs to.
    const sameHost = new URL(target).host === new URL(url).host;
    ({ buf, contentType } = await fetchLimited(target, sameHost ? auth : {}));
  }

  const t = await fileTypeFromBuffer(buf);
  if (!t || !IMAGE_TYPES.has(t.mime)) throw new Error("The image service didn’t return an image");
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFile, buf);
  return { buf, mime: t.mime };
}

/** Admin "test" helper: resolves an ID with the current settings and reports what happened. */
export async function testImageId(id: string): Promise<{ ok: boolean; url?: string; message: string }> {
  const cfg = await imageConfig();
  if (!isValidImageId(id)) return { ok: false, message: "That doesn’t look like a valid image ID." };
  if (cfg.mode === "none") return { ok: false, message: "Image mode is “none”. Choose allsy, template or api first." };
  if (cfg.mode === "allsy") {
    const [a] = await assetsByIds([id]);
    if (!a || a.deleted) return { ok: false, message: "This ID hasn’t been received from Allsy.io yet (push it from Allsy.io or run Sync now)." };
    if (a.flags.length) return { ok: false, url: a.url, message: `Received from Allsy.io but held back: ${a.flags.join(", ").replace(/_/g, " ")}.` };
    return { ok: true, url: a.url, message: `Synced from Allsy.io${a.width ? ` (${a.width}×${a.height})` : ""}.` };
  }
  if (cfg.mode === "template") {
    const url = externalImageUrl(id, cfg);
    if (!url) return { ok: false, message: "Set a URL template containing {id}." };
    try {
      const { buf } = await fetchLimited(url, {});
      const t = await fileTypeFromBuffer(buf);
      return t && IMAGE_TYPES.has(t.mime) ? { ok: true, url, message: `Found a ${t.ext.toUpperCase()} image (${Math.round(buf.length / 1024)} KB).` } : { ok: false, url, message: "That URL didn’t return an image." };
    } catch (e) {
      return { ok: false, url, message: e instanceof Error ? e.message : "Request failed" };
    }
  }
  try {
    const { buf, mime } = await loadApiImage(id, { bypassCache: true });
    return { ok: true, url: externalImageUrl(id, cfg) ?? undefined, message: `Found a ${mime.split("/")[1].toUpperCase()} image (${Math.round(buf.length / 1024)} KB).` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Request failed" };
  }
}
