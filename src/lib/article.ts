/** Helpers for blog articles: reading time and the "In this article" list. */

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "’")
    .replace(/&quot;|&ldquo;|&rdquo;/g, "\"")
    .replace(/&[a-z]+;|&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Minutes to read at about 220 words a minute (never less than 1). */
export function readingMinutes(html: string) {
  const words = decode(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export type TocItem = { id: string; text: string; level: 2 | 3 };

/** Gives every h2/h3 in the article an id (keeping existing ones) and returns them as a contents list. */
export function withHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (tag, lvl: string, attrs = "", inner: string) => {
    const text = decode(inner);
    if (!text) return tag;
    const existing = attrs.match(/\sid="([^"]+)"/)?.[1];
    let id =
      existing ||
      text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) ||
      "section";
    if (!existing) {
      const base = id;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    }
    used.add(id);
    toc.push({ id, text: text.slice(0, 120), level: lvl === "2" ? 2 : 3 });
    return existing ? tag : `<h${lvl}${attrs} id="${id}">${inner}</h${lvl}>`;
  });
  return { html: out, toc };
}
