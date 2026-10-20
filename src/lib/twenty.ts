import "server-only";

/**
 * Twenty CRM client — STRICTLY READ-ONLY.
 *
 * The client's Twenty workspace is their live CRM. This module only ever sends
 * HTTP GET requests. Do not add POST/PATCH/PUT/DELETE or GraphQL mutations here
 * or anywhere else in the codebase (see CLAUDE.md).
 */

import { getSettings } from "@/server/settings";

/** Twenty URL, key and refresh interval come from Admin → Integrations (falling back to .env.local). */
async function twentyGet<T>(path: string): Promise<T> {
  const cfg = await getSettings(["twenty.apiUrl", "twenty.apiKey", "twenty.refreshSeconds"]);
  const apiKey = cfg["twenty.apiKey"];
  if (!apiKey) throw new Error("Twenty API key is not set (Admin → Integrations)");
  const res = await fetch(`${cfg["twenty.apiUrl"] ?? "https://api.twenty.com"}${path}`, {
    method: "GET", // read-only: never change this
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    next: { revalidate: Number(cfg["twenty.refreshSeconds"] ?? 300), tags: ["twenty"] },
  });
  if (!res.ok) throw new Error(`Twenty GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

type Currency = { amountMicros: number | null; currencyCode: string | null } | null;

type RawAttachment = { id: string; name?: string | null; fullPath?: string | null; fileCategory?: string | null };

type RawStock = {
  id: string;
  name: string | null;
  format: string | null;
  dimensions: string | null;
  mmMeasurement: string | null;
  species: string | null;
  productType: string | null;
  sqftBox: string | null;
  skip: string | null;
};

type RawMasterProduct = {
  id: string;
  name: string | null;
  brand: string | null;
  range: string | null;
  differentiator: string | null;
  dimensions: string | null;
  specification: string | null;
  category: string | null;
  categoryLegacyText: string | null;
  collection: string | null;
  grade: string[] | null;
  construction: string[] | null;
  installation: string[] | null;
  accessoryType: string | null;
  unit: string | null;
  lengths: string | null;
  numberOfPlanksPerBox: string | null;
  areaPerBoxSqft: number | null;
  listPricePerSqftInr: Currency;
  allsyDecorImageId: string | null;
  createdAt: string;
  updatedAt: string;
  stockHeader?: RawStock[] | null;
  attachments?: RawAttachment[] | null;
};

type Page = {
  data: { masterProducts: RawMasterProduct[] };
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
};

/** Public product shape. Only fields that are safe to show on the website — no stock, cost or blocking data. */
export type TwentyProduct = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  collection: string | null;
  grade: string[];
  construction: string[];
  installation: string[];
  accessoryType: string | null;
  dimensions: string | null;
  range: string | null;
  differentiator: string | null;
  specification: string | null;
  lengths: string | null;
  unit: string | null;
  planksPerBox: string | null;
  areaPerBoxSqft: number | null;
  listPricePerSqftInr: number | null;
  imageId: string | null;
  attachmentImages: string[];
  variants: {
    id: string;
    format: string | null;
    dimensions: string | null;
    species: string | null;
    productType: string | null;
    sqftBox: string | null;
  }[];
  createdAt: string;
  updatedAt: string;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)(\?|$)/i;

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function toPublic(p: RawMasterProduct): TwentyProduct {
  return {
    id: p.id,
    name: clean(p.name) ?? "Untitled product",
    brand: clean(p.brand),
    category: p.category,
    collection: p.collection,
    grade: p.grade ?? [],
    construction: p.construction ?? [],
    installation: p.installation ?? [],
    accessoryType: p.accessoryType,
    dimensions: clean(p.dimensions),
    range: clean(p.range),
    differentiator: clean(p.differentiator),
    specification: clean(p.specification),
    lengths: clean(p.lengths),
    unit: p.unit,
    planksPerBox: clean(p.numberOfPlanksPerBox),
    areaPerBoxSqft: p.areaPerBoxSqft,
    listPricePerSqftInr: p.listPricePerSqftInr?.amountMicros ? p.listPricePerSqftInr.amountMicros / 1_000_000 : null,
    imageId: clean(p.allsyDecorImageId),
    attachmentImages: (p.attachments ?? [])
      .filter((a) => a.fullPath && /^https?:\/\//.test(a.fullPath) && (a.fileCategory === "IMAGE" || IMAGE_EXT.test(a.fullPath)))
      .map((a) => a.fullPath as string),
    variants: (p.stockHeader ?? [])
      .filter((s) => s.skip !== "YES")
      .map((s) => ({
        id: s.id,
        format: clean(s.format),
        dimensions: clean(s.dimensions) ?? clean(s.mmMeasurement),
        species: clean(s.species),
        productType: clean(s.productType),
        sqftBox: clean(s.sqftBox),
      })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** All master products from Twenty (paged GET requests), mapped to the public shape. */
export async function fetchAllProducts(): Promise<TwentyProduct[]> {
  const all: TwentyProduct[] = [];
  let cursor: string | null | undefined = null;
  for (let i = 0; i < 50; i++) {
    const qs = new URLSearchParams({ limit: "60", depth: "1" });
    if (cursor) qs.set("starting_after", cursor);
    const page: Page = await twentyGet<Page>(`/rest/masterProducts?${qs}`);
    all.push(...page.data.masterProducts.map(toPublic));
    if (!page.pageInfo?.hasNextPage || !page.pageInfo.endCursor) break;
    cursor = page.pageInfo.endCursor;
  }
  return all;
}
