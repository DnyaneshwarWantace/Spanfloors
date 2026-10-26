import "server-only";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { legacyFor, SITE_NAME } from "@/lib/seo";
import { sectionDef } from "@/sections/registry";
import type { Field, Section } from "@/sections/types";

/**
 * SEO checks for one page or post: the same list feeds the live checklist in the editor and the SEO overview.
 * Each check says what to do in plain words.
 */

export type CheckStatus = "good" | "warn" | "bad";
export type Check = { id: string; status: CheckStatus; text: string };
export type SeoReport = { score: number; checks: Check[] };

export type SeoInput = {
  id: string | null;
  type: "post" | "page";
  title: string;
  path: string;
  body: string;
  layout: Section[];
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  robots: string;
  ogImageMediaId: string | null;
  aeo?: { answer?: string };
};

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const words = (t: string) => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Collects text, headings, links and media ids from sections. */
function fromSections(layout: Section[]) {
  const html: string[] = [];
  const text: string[] = [];
  const headings: string[] = [];
  const media: string[] = [];
  const links: string[] = [];
  let hasHero = false;
  const walk = (fields: Field[], data: Record<string, unknown>) => {
    for (const f of fields) {
      const v = data?.[f.name];
      if (f.name === "heading" && typeof v === "string" && v) headings.push("h2");
      if ((f.kind === "text" || f.kind === "textarea") && typeof v === "string") text.push(v);
      if (f.kind === "richtext" && typeof v === "string") html.push(v);
      if ((f.kind === "image" || f.kind === "file") && typeof v === "string") media.push(v);
      if (f.kind === "images" && Array.isArray(v)) media.push(...v.filter((x): x is string => typeof x === "string"));
      if (f.kind === "link" && v && typeof (v as { href?: string }).href === "string") links.push((v as { href: string }).href);
      if (f.kind === "items" && Array.isArray(v)) for (const item of v) walk(f.fields, item as Record<string, unknown>);
    }
  };
  for (const s of layout) {
    if (s.hidden) continue;
    const def = sectionDef(s.type);
    if (!def) continue;
    if (s.type === "hero") hasHero = true;
    walk(def.fields, s.data);
  }
  return { html: html.join("\n"), text: text.join(" "), headings, media, links, hasHero };
}

export async function checkSeo(c: SeoInput): Promise<SeoReport> {
  const checks: Check[] = [];
  const add = (id: string, status: CheckStatus, text: string) => checks.push({ id, status, text });
  const legacy = legacyFor(c.path);
  const sec = fromSections(c.layout);
  const html = `${c.body}\n${sec.html}`;
  const plain = `${strip(html)} ${sec.text}`.trim();
  const effectiveTitle = c.seoTitle || legacy?.title || `${c.title} - ${SITE_NAME}`;
  const effectiveDesc = c.seoDescription || legacy?.description || c.excerpt;

  // Title
  const tl = effectiveTitle.length;
  if (tl < 30) add("title", "warn", `The search title is short (${tl} characters). Aim for 50–60 so Google shows a full, specific title.`);
  else if (tl > 60) add("title", "warn", `The search title is ${tl} characters; Google cuts it at about 60. Put the important words first.`);
  else add("title", "good", `Search title length is good (${tl} characters).`);

  // Description
  const dl = effectiveDesc.length;
  if (!dl) add("description", "bad", "Add a meta description: one or two sentences that make people click.");
  else if (dl < 70) add("description", "warn", `The meta description is short (${dl} characters). Aim for 120–160.`);
  else if (dl > 160) add("description", "warn", `The meta description is ${dl} characters; Google usually shows about 160.`);
  else add("description", "good", `Meta description length is good (${dl} characters).`);

  // Focus keyword
  const kw = norm(c.focusKeyword);
  if (!kw) add("keyword", "warn", "Set a focus keyword (the phrase people search for) to check the page against it.");
  else {
    const inTitle = norm(effectiveTitle).includes(kw);
    const inDesc = norm(effectiveDesc).includes(kw);
    const inUrl = norm(c.path.replace(/[/-]/g, " ")).includes(kw);
    const first = norm(plain.slice(0, 600)).includes(kw);
    const count = norm(plain).split(kw).length - 1;
    add("kw-title", inTitle ? "good" : "warn", inTitle ? "The focus keyword is in the search title." : "Use the focus keyword in the search title.");
    add("kw-desc", inDesc ? "good" : "warn", inDesc ? "The focus keyword is in the meta description." : "Use the focus keyword in the meta description.");
    add("kw-url", inUrl ? "good" : "warn", inUrl ? "The focus keyword is in the address." : "The address doesn't contain the focus keyword (only change it for new pages; old addresses keep their rankings).");
    add("kw-first", first ? "good" : "warn", first ? "The focus keyword appears near the start of the text." : "Mention the focus keyword in the first paragraph.");
    if (count === 0) add("kw-count", "bad", "The focus keyword doesn't appear in the page text.");
  }

  // Headings
  const order = [...sec.headings, ...[...html.matchAll(/<h([1-6])\b/gi)].map((m) => `h${m[1]}`)];
  const levels = order.map((h) => Number(h.slice(1)));
  const skips = levels.some((l, i) => i > 0 && l - levels[i - 1] > 1) || (levels.length > 0 && levels[0] > 2);
  if (c.type === "page" && c.layout.length > 0 && !sec.hasHero) add("h1", "warn", "This page has no hero section, so the page title is used as the main heading. Add a hero for a clearer heading.");
  else add("h1", "good", "The page has one main heading.");
  if (skips) add("headings", "warn", "Headings skip a level (e.g. a sub-heading before any heading). Use Heading, then Subheading, in order.");
  else if (plain.length > 1500 && levels.length === 0) add("headings", "warn", "Long text without headings is hard to scan. Add headings to break it up.");

  // Length
  const wc = words(plain);
  const min = c.type === "post" ? 300 : 150;
  add("words", wc >= min ? "good" : "warn", wc >= min ? `${wc} words of text.` : `Only ${wc} words of text. Pages with ${min}+ useful words rank better.`);

  // Links
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).concat(sec.links);
  const internal = hrefs.filter((h) => h.startsWith("/") || /spanfloors\.com/.test(h)).length;
  add("links", internal > 0 ? "good" : "warn", internal > 0 ? `${internal} link${internal === 1 ? "" : "s"} to other pages on the site.` : "Link to at least one related page or product on the site.");

  // Images and their descriptions
  const bodyImgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const noAltBody = bodyImgs.filter((t) => !/\balt="[^"]+"/i.test(t)).length;
  let noAltSections = 0;
  const ids = [...new Set(sec.media.filter((x) => /^[0-9a-f-]{36}$/.test(x)))];
  let ogSize: { width: number | null; height: number | null } | null = null;
  const lookup = [...ids, ...(c.ogImageMediaId ? [c.ogImageMediaId] : [])];
  if (lookup.length) {
    const rows = await db.select({ id: schema.media.id, alt: schema.media.alt, mime: schema.media.mime, width: schema.media.width, height: schema.media.height }).from(schema.media).where(inArray(schema.media.id, lookup));
    noAltSections = rows.filter((r) => ids.includes(r.id) && r.mime.startsWith("image/") && !r.alt.trim()).length;
    const og = rows.find((r) => r.id === c.ogImageMediaId);
    if (og) ogSize = { width: og.width, height: og.height };
  }
  const noAlt = noAltBody + noAltSections;
  if (bodyImgs.length + ids.length > 0) add("alt", noAlt ? "warn" : "good", noAlt ? `${noAlt} photo${noAlt === 1 ? " has" : "s have"} no description (alt text). Add one in the media library; Google and screen readers use it.` : "Every photo has a description (alt text).");

  // Share image
  if (!c.ogImageMediaId) add("share", "good", "No share image chosen: a branded card with the page title is used on WhatsApp and social apps.");
  else if (ogSize && ((ogSize.width ?? 0) < 1200 || (ogSize.height ?? 0) < 630)) add("share", "warn", `The share image is ${ogSize.width}×${ogSize.height}. Use at least 1200×630 so it looks sharp when shared.`);
  else add("share", "good", "The share image is large enough.");

  // Visibility
  if (/noindex/.test(c.robots)) add("noindex", "bad", "This page is hidden from search engines (noindex). Untick it if the page should appear in Google.");

  // Address
  if (c.path.length > 80) add("url", "warn", "The address is long. Short addresses are easier to share and read.");

  // Answer engines
  if (c.type === "post") {
    const ans = (c.aeo?.answer ?? "").trim();
    add("answer", ans ? "good" : "warn", ans ? "The post has a short answer for AI search." : "Add a short answer (40–60 words) under Answer engines; AI search quotes it.");
  }

  // Duplicates elsewhere on the site
  const notSelf = c.id ? ne(schema.content.id, c.id) : undefined;
  const dupWhere = [
    c.seoTitle ? eq(schema.content.seoTitle, c.seoTitle) : undefined,
    c.seoDescription ? eq(schema.content.seoDescription, c.seoDescription) : undefined,
  ].filter(Boolean);
  if (dupWhere.length) {
    const dups = await db
      .select({ title: schema.content.title, seoTitle: schema.content.seoTitle, seoDescription: schema.content.seoDescription })
      .from(schema.content)
      .where(and(notSelf, or(...dupWhere), inArray(schema.content.status, ["published", "scheduled", "draft", "review"]), or(isNull(schema.content.robots), sql`${schema.content.robots} not like '%noindex%'`)))
      .limit(3);
    const t = dups.find((d) => c.seoTitle && d.seoTitle === c.seoTitle);
    const d = dups.find((x) => c.seoDescription && x.seoDescription === c.seoDescription);
    if (t) add("dup-title", "bad", `“${t.title}” uses the same search title. Each page needs its own.`);
    if (d) add("dup-desc", "bad", `“${d.title}” uses the same meta description. Write a different one.`);
  }

  const weight = { good: 1, warn: 0.5, bad: 0 } as const;
  const score = Math.round((checks.reduce((n, ch) => n + weight[ch.status], 0) / Math.max(checks.length, 1)) * 100);
  const rank = { bad: 0, warn: 1, good: 2 } as const;
  return { score, checks: checks.sort((a, b) => rank[a.status] - rank[b.status]) };
}
