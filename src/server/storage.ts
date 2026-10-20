import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
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

/** Resolves a stored path safely inside the storage root (blocks "../" tricks). */
export function resolveStored(path: string): string | null {
  const full = normalize(join(STORAGE_ROOT, path));
  return full.startsWith(STORAGE_ROOT + sep) ? full : null;
}

export async function saveUpload(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: larger than 25 MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  // Trust the file's actual bytes, not its name or the browser-supplied type.
  const detected = await fileTypeFromBuffer(buf);
  const mime = detected?.mime ?? "";
  const ext = ALLOWED_UPLOADS[mime];
  if (!ext) throw new Error(`${file.name}: only JPG, PNG, WebP, GIF, AVIF, PDF and MP4 files can be uploaded`);

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
  return { path: rel, filename: file.name.slice(0, 200), mime, size: file.size, width, height };
}

export async function removeStored(path: string) {
  const full = resolveStored(path);
  if (full && existsSync(full)) await unlink(full);
}

export function mediaUrl(path: string) {
  return `/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
