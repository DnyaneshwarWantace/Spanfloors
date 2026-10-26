import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import sharp from "sharp";
import { imageSize } from "image-size";
import { fileTypeFromBuffer } from "file-type";
import { slugify } from "./html";

/** Uploaded files live on disk (VPS). Swap these functions for S3 later without touching callers. */
export const STORAGE_ROOT = join(process.cwd(), "storage", "uploads");

export const ALLOWED_UPLOADS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
};
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Generated smaller copies (WebP) live here, outside the uploads folder: safe to delete at any time. */
export const CACHE_ROOT = join(process.cwd(), "storage", "cache", "media");
/** Widths the site asks for (srcset). Anything else is rounded up to the next one. */
export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1600, 2048] as const;

export const sha256Of = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

/**
 * Cleans a new photo before it is stored: turns it the right way up and removes location and camera data
 * (EXIF/GPS). Keeps the same format. GIFs (animation), SVG and other files are stored as they are.
 */
async function cleanImage(buf: Buffer, mime: string): Promise<Buffer> {
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(mime)) return buf;
  const img = sharp(buf, { failOn: "none" }).rotate();
  const out =
    mime === "image/jpeg"
      ? img.jpeg({ quality: 90, mozjpeg: true })
      : mime === "image/png"
        ? img.png({ compressionLevel: 9 })
        : mime === "image/webp"
          ? img.webp({ quality: 90 })
          : img.avif({ quality: 70 });
  return out.toBuffer();
}

/** Resolves a stored path safely inside the storage root (blocks "../" tricks). */
export function resolveStored(path: string): string | null {
  const full = normalize(join(STORAGE_ROOT, path));
  return full.startsWith(STORAGE_ROOT + sep) ? full : null;
}

export async function saveUpload(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: larger than 25 MB`);
  const raw = Buffer.from(await file.arrayBuffer());
  // Trust the file's actual bytes, not its name or the browser-supplied type.
  const detected = await fileTypeFromBuffer(raw);
  const mime = detected?.mime ?? "";
  const ext = ALLOWED_UPLOADS[mime];
  if (!ext) throw new Error(`${file.name}: only JPG, PNG, WebP, GIF, AVIF, PDF and MP4 files can be uploaded`);
  const buf = await cleanImage(raw, mime).catch(() => raw);

  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const base = slugify(file.name.replace(/\.[^.]+$/, "")).replace(/\//g, "-") || "file";
  let rel = `${folder}/${base}.${ext}`;
  for (let n = 2; existsSync(join(STORAGE_ROOT, rel)); n++) rel = `${folder}/${base}-${n}.${ext}`;

  const dest = resolveStored(rel)!;
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);

  let width: number | null = null;
  let height: number | null = null;
  if (mime.startsWith("image/")) {
    try {
      const dim = imageSize(buf);
      width = dim.width ?? null;
      height = dim.height ?? null;
    } catch {}
  }
  // The fingerprint of the original file catches the same file uploaded again.
  return { path: rel, filename: file.name.slice(0, 200), mime, size: buf.length, width, height, sha256: sha256Of(raw) };
}

/** Checks a file for "replace": same kind of file as before, cleaned the same way. */
export async function readReplacement(file: File, currentMime: string) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("The file is larger than 25 MB.");
  const raw = Buffer.from(await file.arrayBuffer());
  const mime = (await fileTypeFromBuffer(raw))?.mime ?? "";
  if (!ALLOWED_UPLOADS[mime]) throw new Error("Only JPG, PNG, WebP, GIF, AVIF, PDF and MP4 files can be used.");
  const family = (m: string) => (m.startsWith("image/") ? "image" : m);
  if (family(mime) !== family(currentMime)) throw new Error("Replace a photo with a photo, a PDF with a PDF and a video with a video.");
  // The address keeps its file extension, so a photo is converted to the original's format if needed.
  let buf = await cleanImage(raw, mime).catch(() => raw);
  if (mime !== currentMime && currentMime.startsWith("image/")) {
    const img = sharp(raw, { failOn: "none" }).rotate();
    buf = await (currentMime === "image/png" ? img.png() : currentMime === "image/webp" ? img.webp({ quality: 90 }) : currentMime === "image/avif" ? img.avif() : img.jpeg({ quality: 90, mozjpeg: true })).toBuffer();
  }
  let width: number | null = null;
  let height: number | null = null;
  if (currentMime.startsWith("image/")) {
    try {
      const dim = imageSize(buf);
      width = dim.width ?? null;
      height = dim.height ?? null;
    } catch {}
  }
  return { buf, size: buf.length, width, height, sha256: sha256Of(raw) };
}

/** Writes new content over a stored file (the address stays the same) and drops its cached smaller copies. */
export async function overwriteStored(path: string, buf: Buffer) {
  const full = resolveStored(path);
  if (!full) throw new Error("Bad file path.");
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buf);
  await clearVariants(path);
}

export async function clearVariants(path: string) {
  const dir = join(CACHE_ROOT, dirname(path));
  const base = path.split("/").pop()!;
  try {
    for (const f of await readdir(dir)) if (f.startsWith(`${base}.w`)) await rm(join(dir, f), { force: true });
  } catch {}
}

/**
 * A smaller WebP copy of a stored photo, made on first request and kept on disk. Returns null when the
 * file isn't a photo we can resize (the original is served instead).
 */
export async function variantFile(path: string, width: number): Promise<string | null> {
  const src = resolveStored(path);
  if (!src || !/\.(jpe?g|png|webp|avif)$/i.test(path)) return null;
  const w = VARIANT_WIDTHS.find((x) => x >= width) ?? VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];
  const out = normalize(join(CACHE_ROOT, `${path}.w${w}.webp`));
  if (!out.startsWith(CACHE_ROOT + sep)) return null;
  try {
    const [s, o] = await Promise.all([stat(src), stat(out).catch(() => null)]);
    if (o && o.mtimeMs >= s.mtimeMs) return out;
  } catch {
    return null;
  }
  try {
    await mkdir(dirname(out), { recursive: true });
    const buf = await sharp(src, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await writeFile(out, buf);
    return out;
  } catch {
    return null;
  }
}

export async function removeStored(path: string) {
  const full = resolveStored(path);
  if (full && existsSync(full)) await unlink(full);
}

export function mediaUrl(path: string) {
  return `/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
