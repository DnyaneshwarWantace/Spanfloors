import "server-only";
import { existsSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATEGORIES, getCatalog, toCard } from "@/lib/catalog";
import type { CardProduct } from "@/components/ProductCard";
import { sanitizeBody } from "@/server/html";
import { mediaUrl, resolveStored } from "@/server/storage";
import { sectionDef } from "./registry";
import type { Field, ProductsValue, Section } from "./types";

/** A media file as sections use it. */
export type ResolvedMedia = {
  id: string;
  url: string;
  mime: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
  focalX: number;
  focalY: number;
  fit: "cover" | "contain";
  placeholder: boolean;
  filename: string;
  size: number;
  /** Changes when the file is replaced (used in image addresses so caches refresh). */
  version: string | null;
};

export type Resolved = {
  sections: Section[];
  media: Map<string, ResolvedMedia>;
  /** Product cards per productGrid section id. */
  products: Map<string, CardProduct[]>;
};

function walk(fields: Field[], data: Record<string, unknown>, visit: (f: Field, v: unknown) => void) {
  for (const f of fields) {
    const v = data?.[f.name];
    visit(f, v);
    if (f.kind === "items" && Array.isArray(v)) for (const item of v) walk(f.fields, item as Record<string, unknown>, visit);
  }
}

function cleanRich(fields: Field[], data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const f of fields) {
    const v = out[f.name];
    if (f.kind === "richtext") out[f.name] = typeof v === "string" ? sanitizeBody(v) : "";
    else if (f.kind === "items" && Array.isArray(v)) out[f.name] = v.map((item) => cleanRich(f.fields, (item ?? {}) as Record<string, unknown>));
  }
  return out;
}

/**
 * Expands reusable sections, drops hidden ones (unless previewing with `showHidden`), and loads every
 * photo, file and product the remaining sections refer to, in three queries.
 */
export async function resolveSections(layout: unknown, opts: { showHidden?: boolean } = {}): Promise<Resolved> {
  const input = (Array.isArray(layout) ? layout : []) as Section[];
  let sections = input.filter((s) => s && sectionDef(s.type) && (opts.showHidden || !s.hidden));

  // Reusable sections: replace the reference with the saved section (one level deep, never nested).
  const refIds = sections.filter((s) => s.type === "reusable" && typeof s.data?.ref === "string").map((s) => s.data.ref as string);
  if (refIds.length) {
    const rows = await db.select().from(schema.reusableSections).where(inArray(schema.reusableSections.id, [...new Set(refIds)]));
    const byId = new Map(rows.map((r) => [r.id, r.section]));
    sections = sections.flatMap((s) => {
      if (s.type !== "reusable") return [s];
      const saved = byId.get(s.data?.ref as string);
      if (!saved || saved.type === "reusable" || !sectionDef(saved.type)) return [];
      return [{ ...s, type: saved.type, data: saved.data }];
    });
  }

  // Rich text is cleaned when saved; cleaning again here means stored data from any source is never trusted.
  sections = sections.map((s) => ({ ...s, data: cleanRich(sectionDef(s.type)!.fields, s.data ?? {}) }));

  const mediaIds = new Set<string>();
  const productSections: { id: string; value: ProductsValue }[] = [];
  for (const s of sections) {
    walk(sectionDef(s.type)!.fields, s.data, (f, v) => {
      if ((f.kind === "image" || f.kind === "file") && typeof v === "string") mediaIds.add(v);
      if (f.kind === "images" && Array.isArray(v)) for (const id of v) if (typeof id === "string") mediaIds.add(id);
      if (f.kind === "products" && v) productSections.push({ id: s.id, value: v as ProductsValue });
    });
  }

  const media = new Map<string, ResolvedMedia>();
  if (mediaIds.size) {
    const rows = await db.select().from(schema.media).where(inArray(schema.media.id, [...mediaIds]));
    for (const m of rows) {
      const full = resolveStored(m.path);
      if (!full || !existsSync(full)) continue; // file not on this server (yet): the section renders without it
      media.set(m.id, {
        id: m.id,
        url: mediaUrl(m.path),
        mime: m.mime,
        alt: m.alt,
        caption: m.caption,
        width: m.width,
        height: m.height,
        focalX: m.focalX,
        focalY: m.focalY,
        fit: m.fit === "contain" ? "contain" : "cover",
        placeholder: m.placeholder,
        filename: m.filename,
        size: m.size,
        version: m.sha256?.slice(0, 8) ?? null,
      });
    }
  }

  const products = new Map<string, CardProduct[]>();
  if (productSections.length) {
    const catalog = await getCatalog().catch(() => []);
    for (const { id, value } of productSections) {
      const limit = value.limit ?? 8;
      let list = catalog;
      if (value.mode === "pick") {
        const byId = new Map(catalog.map((p) => [p.id, p]));
        list = (value.ids ?? []).map((pid) => byId.get(pid)).filter((p): p is (typeof catalog)[number] => Boolean(p));
      } else if (value.mode === "featured") {
        list = catalog.filter((p) => p.featured);
      } else {
        const key = CATEGORIES.find((c) => c.slug === value.collection)?.key;
        list = key ? catalog.filter((p) => p.categoryKey === key) : [];
      }
      products.set(id, list.slice(0, limit).map(toCard));
    }
  }

  return { sections, media, products };
}
