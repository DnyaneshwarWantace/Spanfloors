import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { extname } from "node:path";
import { resolveStored } from "@/server/storage";

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

/** Serves uploaded and imported media from storage/uploads at /media/<path>. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.map((p) => decodeURIComponent(p)).join("/");
  const full = resolveStored(rel);
  if (!full) return new Response("Not found", { status: 404 });
  try {
    const s = await stat(full);
    if (!s.isFile()) throw new Error();
    const type = TYPES[extname(full).toLowerCase()] ?? "application/octet-stream";
    return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(s.size),
        "Cache-Control": "public, max-age=31536000, immutable",
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
