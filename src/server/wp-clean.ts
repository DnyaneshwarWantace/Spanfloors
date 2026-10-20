import sanitizeHtml from "sanitize-html";
import { tidyImported } from "./tidy";

/** Shared helpers for importing WordPress content (main site and blog subdomain). */

export function decodeEntities(s: string) {
  return s
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export const plainText = (html: string) => decodeEntities(sanitizeHtml(html, { allowedTags: [] })).replace(/\s+/g, " ").trim();

/**
 * Strips page-builder wrappers and inline styling, keeps readable content, and rewrites
 * links: uploads → /media/<mediaPrefix>/…, internal links → relative paths.
 */
export function cleanWordPressHtml(html: string, opts: { origins: string[]; mediaPrefix: string; linkRewrites?: [string, string][] }): string {
  const withoutShortcodes = html.replace(/\[\/?et_pb[^\]]*\]/g, "").replace(/\[\/?[a-z_]+[^\]]*\]/g, "");
  let out = sanitizeHtml(withoutShortcodes, {
    allowedTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "blockquote", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "iframe"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.google.com"],
    transformTags: {
      b: "strong",
      i: "em",
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, src: attribs["data-src"] ?? attribs["data-lazy-src"] ?? attribs.src ?? "" } }),
    },
    exclusiveFilter: (frame) => (frame.tag === "p" || frame.tag === "a") && !frame.text.trim() && !frame.mediaChildren?.length,
  });
  for (const origin of opts.origins) {
    out = out.replaceAll(`${origin}/wp-content/uploads/`, `/media/${opts.mediaPrefix}/`);
  }
  for (const [from, to] of opts.linkRewrites ?? []) out = out.replaceAll(`href="${from}`, `href="${to}`);
  return tidyImported(out.replace(/\n{3,}/g, "\n\n").trim());
}

/** Yoast/AIOSEO robots object → "index, follow, max-image-preview:large" style string. */
export function robotsString(r: Record<string, string> | null | undefined): string | null {
  if (!r) return null;
  const parts = Object.values(r).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
