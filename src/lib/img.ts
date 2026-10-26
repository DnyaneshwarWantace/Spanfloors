/* Responsive image addresses for files served from /media/ (shared by server and client code). */

export const WIDTHS = [320, 640, 960, 1280, 1600, 2048];

const isMedia = (url: string) => url.startsWith("/media/") && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(url);

/** A smaller WebP copy of a /media/ photo (other addresses are returned unchanged). */
export function sized(url: string, width: number, version?: string | null) {
  if (!isMedia(url)) return url;
  const base = url.split("?")[0];
  return `${base}?w=${width}${version ? `&v=${version}` : ""}`;
}

/** srcset for a /media/ photo, up to its own width (or undefined for other addresses). */
export function srcSet(url: string, originalWidth?: number | null, version?: string | null) {
  if (!isMedia(url)) return undefined;
  const max = originalWidth && originalWidth > 0 ? originalWidth : 2048;
  const list = WIDTHS.filter((w) => w <= max);
  if (!list.length || (max > list[list.length - 1] && list[list.length - 1] < 2048)) list.push(WIDTHS.find((w) => w > max) ?? 2048);
  return list.map((w) => `${sized(url, w, version)} ${w}w`).join(", ");
}
