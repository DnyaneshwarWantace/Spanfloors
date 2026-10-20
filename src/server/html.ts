import "server-only";
import sanitizeHtml from "sanitize-html";

/** The only HTML allowed in posts and pages (editor output and imported content). */
export function sanitizeBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "strong", "em", "u", "s", "code", "pre",
      "a", "ul", "ol", "li", "blockquote", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td", "iframe",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "title"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.google.com"],
    transformTags: {
      b: "strong",
      i: "em",
      a: (tagName, attribs) =>
        attribs.target === "_blank" ? { tagName, attribs: { ...attribs, rel: "noopener noreferrer" } } : { tagName, attribs },
    },
  });
}

/** Plain text (for excerpts and meta descriptions). */
export function toText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** "Wooden Flooring 101" or "/blog/x" → "/wooden-flooring-101/" style path with leading & trailing slash. */
export function normalizePath(input: string): string {
  const parts = input
    .split("/")
    .map((p) => slugify(p))
    .filter(Boolean);
  return parts.length ? `/${parts.join("/")}/` : "/";
}
