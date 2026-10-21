/**
 * Tidies HTML imported from the old page builder: removes form leftovers, collapses builder
 * whitespace, wraps loose text in <p>, and demotes in-body <h1> to <h2> (the page title is the H1).
 */
const BLOCK = /(<\/?(?:h[1-6]|p|ul|ol|li|blockquote|figure|figcaption|table|thead|tbody|tr|th|td|iframe|hr|br)\b[^>]*>|<img\b[^>]*>)/gi;
const CONTAINERS = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "figcaption", "blockquote"]);

export function tidyImported(html: string): string {
  let s = html
    // form plugin leftovers
    .replace(/<img[^>]*(?:wpforms|submit-spin|loading)[^>]*>/gi, "")
    .replace(/Please enable JavaScript in your browser to complete this form\.[^<]*/gi, "")
    // old WordPress plugin leftovers (view counters)
    .replace(/<p[^>]*>\s*Post Views:\s*[\d,]+\s*<\/p>/gi, "")
    .replace(/Post Views:\s*[\d,]+/gi, "")
    // in-body H1 → H2
    .replace(/<h1(\s[^>]*)?>/gi, "<h2>")
    .replace(/<\/h1>/gi, "</h2>")
    // whitespace from builder markup
    .replace(/[\t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n");

  const parts = s.split(BLOCK);
  const out: string[] = [];
  let depth = 0;
  let loose = "";
  const flush = () => {
    const t = loose.trim();
    if (t) out.push(`<p>${t}</p>`);
    loose = "";
  };
  for (const part of parts) {
    if (!part) continue;
    const tag = part.match(/^<(\/?)([a-z0-9]+)/i);
    if (tag) {
      const closing = tag[1] === "/";
      const name = tag[2].toLowerCase();
      if (name === "br") {
        if (depth > 0) out.push("<br />");
        else loose += " ";
        continue;
      }
      if (depth === 0 && !closing) flush();
      if (CONTAINERS.has(name)) depth = Math.max(0, depth + (closing ? -1 : 1));
      out.push(part);
    } else if (depth === 0) {
      // inline markup (a, strong, em) outside a block becomes part of a paragraph
      loose += part.replace(/\n/g, " ");
    } else {
      out.push(part.replace(/\n/g, " "));
    }
  }
  flush();

  s = out
    .join("\n")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<(h[2-6])>\s*<\/\1>/g, "")
    .replace(/\n{2,}/g, "\n");
  return s.trim();
}
