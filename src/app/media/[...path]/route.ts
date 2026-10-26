import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { extname } from "node:path";
import { resolveStored, variantFile } from "@/server/storage";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
};

/**
 * Serves uploaded and imported media from storage/uploads at /media/<path>.
 * With ?w=<width> a photo comes back as a smaller WebP copy (made once, then kept). A ?v= version in the
 * address (changes when the file is replaced) lets those copies be cached for a year; plain addresses are
 * cached for a day, so a replaced file shows up everywhere soon after.
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.map((p) => decodeURIComponent(p)).join("/");
  let full = resolveStored(rel);
  if (!full) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const w = Number(url.searchParams.get("w"));
  const versioned = url.searchParams.has("v");
  let type = TYPES[extname(full).toLowerCase()] ?? "application/octet-stream";
  if (w > 0 && w <= 4096) {
    const variant = await variantFile(rel, w);
    if (variant) {
      full = variant;
      type = "image/webp";
    }
  }
  try {
    const s = await stat(full);
    if (!s.isFile()) throw new Error();
    return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(s.size),
        "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=86400",
        "Last-Modified": s.mtime.toUTCString(),
        "X-Content-Type-Options": "nosniff",
        // SVGs can carry scripts: never let them run on our origin.
        ...(type === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      },
    });
  } catch {
    // Pre-launch fallback: imported WordPress files not copied yet are fetched from the old site.
    // Remove once the full uploads backup has been imported (npm run import:wp -- --from-dir …).
    // Off by default: set LEGACY_MEDIA_FALLBACK=on only while the old site is reachable for visitors.
    if (rel.startsWith("wp/") && process.env.LEGACY_MEDIA_FALLBACK === "on") {
      return Response.redirect(`https://www.spanfloors.com/wp-content/uploads/${rel.slice(3).split("/").map(encodeURIComponent).join("/")}`, 302);
    }
    return new Response("Not found", { status: 404 });
  }
}
