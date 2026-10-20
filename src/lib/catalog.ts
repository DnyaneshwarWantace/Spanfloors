import "server-only";
import { cache } from "react";
import legacySeo from "@/data/legacy-seo.json";
import { fetchAllProducts, type TwentyProduct } from "./twenty";
import { db, schema } from "@/db";
import type { ProductOverride } from "@/db/schema";
import { externalImageUrl, imageConfig } from "@/server/product-images";
import { allsyImageIndex } from "@/server/allsy";
import { mediaUrl } from "@/server/storage";
import { inArray } from "drizzle-orm";

export type CategoryKey = "engineered" | "laminate" | "composite" | "decking" | "facades" | "accessories";

export type Category = {
  key: CategoryKey;
  /** URL segment — matches the existing spanfloors.com URLs where one exists, to keep SEO. */
  slug: string;
  title: string;
  intro: string;
};

export const CATEGORIES: Category[] = [
  {
    key: "engineered",
    slug: "engineered-wood-flooring-collection",
    title: "Engineered Wood Flooring",
    intro:
      "Real timber wear layers over a stable multi-layer core. Planks, herringbone and chevron in European oak, walnut and teak, finished and ready to lay.",
  },
  {
    key: "laminate",
    slug: "laminate-flooring-collection",
    title: "Laminate Flooring",
    intro: "Hard-wearing laminate with authentic wood visuals, built for busy homes and easy upkeep.",
  },
  {
    key: "composite",
    slug: "composite-flooring-collection",
    title: "Composite Flooring",
    intro: "Composite floors that pair the look of wood with resistance to moisture and daily wear.",
  },
  {
    key: "decking",
    slug: "decking-collection",
    title: "Decking",
    intro: "Exterior timber and composite decking for terraces, pool surrounds and gardens.",
  },
  {
    key: "facades",
    slug: "facades-collection",
    title: "Facades",
    intro: "Timber cladding, fluted profiles and screening for exteriors that age beautifully.",
  },
  {
    key: "accessories",
    slug: "accessories",
    title: "Accessories",
    intro: "Skirting, profiles, underlays, adhesives and care products to finish every installation.",
  },
];

const FACADE_WORDS = /(cladding|fluted|screen|louv|facade|façade|batten)/i;

function categoryOf(p: TwentyProduct): CategoryKey | null {
  switch (p.category) {
    case "ENGINEERED_WOODEN_FLOORING":
      return "engineered";
    case "LAMINATE_FLOORING":
      return "laminate";
    case "COMPOSITE_FLOORING":
      return "composite";
    case "EXTERIOR_WOOD":
    case "EXTERIOR_COMPOSITE":
      return FACADE_WORDS.test(p.name) ? "facades" : "decking";
    case "ACCESSORIES":
    case "INSTALLATION_MATERIALS":
    case "EXTERIOR_ACCESSORIES":
      return "accessories";
    default:
      return null; // products without a category stay hidden
  }
}

export { label, TONE_COLORS } from "./labels";

/* ---------- Slugs (keep legacy spanfloors.com URLs) ---------- */

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bHB\b/gi, "herringbone"],
  [/\bCH\b/gi, "chevron"],
  [/\bCV\b/gi, "chevron"],
  [/\bWP\b/gi, "plank"],
  [/\bPL\b/gi, "plank"],
  [/\bTL\b/gi, "tile"],
];

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function productSlugCandidates(name: string): string[] {
  let expanded = name;
  for (const [re, word] of ABBREVIATIONS) expanded = expanded.replace(re, word);
  const base = slugify(expanded);
  const noCodes = slugify(expanded.replace(/\b[A-Z]{2,}\d+[A-Z0-9]*\b/g, ""));
  const withQs = base.replace(/-(plank|herringbone|chevron)$/, "-qs-$1");
  return [...new Set([base, noCodes, withQs, `${base}-2`])];
}

const legacyPaths = new Set(Object.keys(legacySeo as Record<string, unknown>));

export type CatalogProduct = TwentyProduct & {
  categoryKey: CategoryKey;
  slug: string;
  href: string;
  /** True when this URL already existed on spanfloors.com. */
  legacyUrl: boolean;
  /** Resolved image URLs: gallery uploads, then Twenty attachments, then the image service. */
  images: string[];
  /** Admin extras stored in our database (Twenty stays read-only). */
  hidden: boolean;
  featured: boolean;
  sortOrder: number;
  nameOverride: string | null;
  descriptionHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

async function loadOverrides(): Promise<Map<string, ProductOverride>> {
  const rows = await db.select().from(schema.productOverrides).catch(() => []);
  return new Map(rows.map((r) => [r.twentyId, r]));
}

async function galleryUrls(overrides: Map<string, ProductOverride>): Promise<Map<string, string>> {
  const ids = [...new Set([...overrides.values()].flatMap((o) => o.mediaIds))];
  if (!ids.length) return new Map();
  const rows = await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(inArray(schema.media.id, ids));
  return new Map(rows.map((r) => [r.id, mediaUrl(r.path)]));
}

/** Every categorised product, including ones hidden in the admin. */
export const getFullCatalog = cache(async (): Promise<CatalogProduct[]> => {
  const [products, cfg, overrides, allsy] = await Promise.all([fetchAllProducts(), imageConfig(), loadOverrides(), allsyImageIndex()]);
  const gallery = await galleryUrls(overrides);
  const used = new Set<string>();
  const out: CatalogProduct[] = [];

  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const key = categoryOf(p);
    if (!key) continue;
    const o = overrides.get(p.id);
    const cat = CATEGORIES.find((c) => c.key === key)!;
    const candidates = o?.slug ? [o.slug] : productSlugCandidates(p.name);
    let slug = candidates.find((c) => legacyPaths.has(`/${cat.slug}/${c}/`) && !used.has(`${cat.slug}/${c}`));
    const legacyUrl = Boolean(slug);
    if (!slug) {
      slug = candidates[0] || p.id;
      let n = 2;
      while (used.has(`${cat.slug}/${slug}`)) slug = `${candidates[0]}-${n++}`;
    }
    used.add(`${cat.slug}/${slug}`);

    const external = o?.useExternalImages === false ? [] : [p.imageId, ...(o?.externalImageIds ?? [])].filter((x): x is string => Boolean(x));
    // Order: admin gallery uploads → Twenty attachments → Allsy.io (or other configured image host).
    const fromHost =
      cfg.mode === "allsy"
        ? [
            ...external.map((id) => allsy.byId.get(id)),
            ...(o?.useExternalImages === false ? [] : (allsy.byProduct.get(p.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map((x) => x.url)),
          ]
        : external.map((id) => externalImageUrl(id, cfg));
    const images = [
      ...(o?.mediaIds ?? []).map((id) => gallery.get(id)).filter((u): u is string => Boolean(u)),
      ...p.attachmentImages,
      ...fromHost.filter((u): u is string => Boolean(u)),
    ];

    out.push({
      ...p,
      categoryKey: key,
      slug,
      href: `/${cat.slug}/${slug}/`,
      legacyUrl,
      images: [...new Set(images)],
      hidden: o?.hidden ?? false,
      featured: o?.featured ?? false,
      sortOrder: o?.sortOrder ?? 0,
      nameOverride: o?.displayName ?? null,
      descriptionHtml: o?.descriptionHtml ?? "",
      seoTitle: o?.seoTitle ?? null,
      seoDescription: o?.seoDescription ?? null,
    });
  }
  // Order set in Admin → Products → Arrange (positions 1…n); unarranged products follow, featured first, then A–Z.
  const pos = (x: CatalogProduct) => (x.sortOrder > 0 ? x.sortOrder : Number.MAX_SAFE_INTEGER);
  return out.sort((a, b) => pos(a) - pos(b) || Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
});

/** Products visible on the website. */
export const getCatalog = cache(async (): Promise<CatalogProduct[]> => (await getFullCatalog()).filter((p) => !p.hidden));

export function getCategory(key: CategoryKey): Category {
  return CATEGORIES.find((c) => c.key === key)!;
}

export async function getCategoryProducts(key: CategoryKey) {
  return (await getCatalog()).filter((p) => p.categoryKey === key);
}

export async function getProduct(key: CategoryKey, slug: string) {
  return (await getCatalog()).find((p) => p.categoryKey === key && p.slug === slug) ?? null;
}

/* ---------- Images ---------- */

/** Image URLs for a product (resolved when the catalogue loads). */
export function productImages(p: TwentyProduct | CatalogProduct): string[] {
  return "images" in p ? p.images : p.attachmentImages;
}

export function displayName(p: TwentyProduct | CatalogProduct): string {
  if ("nameOverride" in p && p.nameOverride) return p.nameOverride;
  let n = p.name;
  for (const [re, word] of ABBREVIATIONS) n = n.replace(re, word.charAt(0).toUpperCase() + word.slice(1));
  return n.replace(/\s+/g, " ").trim();
}

export function formatOf(p: TwentyProduct): string | null {
  const f = p.variants.find((v) => v.format)?.format;
  if (f) return f;
  const n = displayName(p);
  return /herringbone/i.test(n) ? "Herringbone" : /chevron/i.test(n) ? "Chevron" : /plank/i.test(n) ? "Plank" : /tile/i.test(n) ? "Tile" : null;
}

/* ---------- View helpers ---------- */

export function subtitleOf(p: TwentyProduct): string {
  return [formatOf(p), p.brand].filter(Boolean).join(" · ");
}

export function toCard(p: CatalogProduct) {
  return {
    id: p.id,
    href: p.href,
    name: displayName(p),
    subtitle: subtitleOf(p),
    image: productImages(p)[0] ?? null,
    tone: p.collection,
  };
}

/* ---------- Legacy URL matching ---------- */

const STOP = new Set(["qs", "2", "3", "and"]);
const tokens = (s: string) => new Set(s.split("-").filter((t) => t && !STOP.has(t)));

/** Best product for an old URL slug by word overlap; null when nothing is close enough. */
export function closestProduct(oldSlug: string, products: CatalogProduct[]): CatalogProduct | null {
  const a = tokens(oldSlug);
  let best: CatalogProduct | null = null;
  let bestScore = 0;
  for (const p of products) {
    const b = tokens(p.slug);
    const shared = [...a].filter((t) => b.has(t)).length;
    const score = shared / new Set([...a, ...b]).size;
    if (score > bestScore) [best, bestScore] = [p, score];
  }
  return bestScore >= 0.6 ? best : null;
}


const LEGACY_PRODUCT_PATH = /^\/(engineered-wood-flooring|laminate-flooring|composite-flooring|decking|facades)-collection\/[^/]+\/$/;

/** Every old spanfloors.com product URL and where it resolves on the new site. */
export async function legacyProductMap() {
  const catalog = await getCatalog();
  const byHref = new Map(catalog.map((p) => [p.href, p]));
  return [...legacyPaths]
    .filter((path) => LEGACY_PRODUCT_PATH.test(path))
    .map((path) => {
      const [, catSlug, slug] = path.split("/");
      const cat = CATEGORIES.find((c) => c.slug === catSlug);
      if (byHref.has(path)) return { path, outcome: "same" as const, target: path };
      const match = cat ? closestProduct(slug, catalog.filter((p) => p.categoryKey === cat.key)) : null;
      return match
        ? { path, outcome: "product" as const, target: match.href }
        : { path, outcome: "category" as const, target: `/${catSlug}/` };
    });
}

/** Everything in Twenty, including products hidden from the site (for the admin dashboard). */
export async function getAdminProducts() {
  const [all, catalog] = await Promise.all([fetchAllProducts(), getFullCatalog()]);
  const live = new Map(catalog.map((p) => [p.id, p]));
  return all.map((p) => {
    const c = live.get(p.id);
    return {
      ...p,
      displayName: displayName(c ?? p),
      format: formatOf(p),
      live: Boolean(c) && !c?.hidden,
      hiddenByAdmin: c?.hidden ?? false,
      featured: c?.featured ?? false,
      href: c?.href ?? null,
      legacyUrl: c?.legacyUrl ?? false,
      categoryTitle: c ? getCategory(c.categoryKey).title : null,
      images: c ? c.images : productImages(p),
    };
  });
}
