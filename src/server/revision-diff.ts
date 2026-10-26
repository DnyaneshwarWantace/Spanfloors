import { sectionDef } from "@/sections/registry";
import type { Section } from "@/sections/types";

/* What changed between two saved versions of a page or post (Admin → page → Version history → Compare). */

export type SectionChange = { id: string; label: string; status: "added" | "removed" | "changed" | "same" | "moved" };
export type FieldChange = { field: string; label: string; before: string; after: string };

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  excerpt: "Excerpt",
  body: "Main text",
  featuredMediaId: "Featured image",
  seoTitle: "SEO title",
  seoDescription: "Meta description",
  robots: "Search engine visibility",
  canonicalUrl: "Canonical URL",
  ogTitle: "Share title",
  ogDescription: "Share description",
  ogImageMediaId: "Share image",
  focusKeyword: "Focus keyword",
  tags: "Tags",
  authorName: "Author",
  path: "Address",
  status: "Status",
};

const plain = (v: unknown) =>
  v == null ? "" : typeof v === "string" ? v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : Array.isArray(v) ? v.join(", ") : JSON.stringify(v);
const clip = (s: string) => (s.length > 160 ? `${s.slice(0, 157)}…` : s);

/** Ignores internal ids of list items so a copied list isn't reported as changed. */
const norm = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => k !== "id").map(([k, x]) => [k, norm(x)]));
  return v;
};
const same = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

function labelOf(s: Section) {
  const def = sectionDef(s.type);
  const heading = typeof s.data?.heading === "string" && s.data.heading ? `: ${s.data.heading}` : "";
  return `${s.name || def?.label || s.type}${heading}`;
}

export function diffVersions(older: Record<string, unknown>, newer: Record<string, unknown>) {
  const fields: FieldChange[] = [];
  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    const a = older[field];
    const b = newer[field];
    if (same(a ?? null, b ?? null)) continue;
    const before = field === "featuredMediaId" || field === "ogImageMediaId" ? (a ? "a photo" : "none") : clip(plain(a));
    const after = field === "featuredMediaId" || field === "ogImageMediaId" ? (b ? "another photo" : "none") : clip(plain(b));
    fields.push({ field, label, before: before || "empty", after: after || "empty" });
  }

  const oldList = (Array.isArray(older.layout) ? older.layout : []) as Section[];
  const newList = (Array.isArray(newer.layout) ? newer.layout : []) as Section[];
  const oldById = new Map(oldList.map((s) => [s.id, { s }]));
  const newIds = new Set(newList.map((s) => s.id));
  // Position among the sections both versions share, so adding one section doesn't mark the rest as moved.
  const oldOrder = new Map(oldList.filter((s) => newIds.has(s.id)).map((s, i) => [s.id, i]));
  const newOrder = new Map(newList.filter((s) => oldById.has(s.id)).map((s, i) => [s.id, i]));
  const sections: SectionChange[] = [];
  newList.forEach((s) => {
    const o = oldById.get(s.id);
    if (!o) sections.push({ id: s.id, label: labelOf(s), status: "added" });
    else {
      const strip = (x: Section) => ({ type: x.type, hidden: x.hidden ?? false, name: x.name ?? "", anchor: x.anchor ?? "", theme: x.theme ?? "", spacing: x.spacing ?? "", data: x.data });
      const content = same(strip(o.s), strip(s));
      sections.push({ id: s.id, label: labelOf(s), status: !content ? "changed" : oldOrder.get(s.id) !== newOrder.get(s.id) ? "moved" : "same" });
    }
  });
  for (const s of oldList) if (!newIds.has(s.id)) sections.push({ id: s.id, label: labelOf(s), status: "removed" });

  return { fields, sections, changed: fields.length + sections.filter((s) => s.status !== "same").length };
}
