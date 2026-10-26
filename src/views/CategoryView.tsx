import type { Metadata } from "next";
import Listing, { type ListingItem } from "@/components/Listing";
import { formatOf, getCatalog, getCategory, label, toCard, type CatalogProduct, type CategoryKey } from "@/lib/catalog";
import { breadcrumbLd, JsonLd, legacyFor, SITE_URL } from "@/lib/seo";
import { getSystemPage, type SystemKey } from "@/server/content";
import { systemMetadata } from "@/server/system-seo";
import RenderSections from "@/sections/RenderSections";

const FACETS = [
  { key: "category", label: "Category" },
  { key: "tone", label: "Colour Tones" },
  { key: "format", label: "Formats" },
  { key: "grade", label: "Grades" },
  { key: "construction", label: "Construction" },
  { key: "installation", label: "Installation" },
  { key: "brand", label: "Brands" },
];

const systemKeyOf = (c: { key: CategoryKey; slug: string } | null): SystemKey => (!c ? "home" : c.key === "accessories" ? "accessories" : `collection:${c.slug}`);

export function categoryMetadata(key: CategoryKey): Promise<Metadata> {
  const c = getCategory(key);
  return systemMetadata(systemKeyOf(c), `/${c.slug}/`, { title: `${c.title} | Span Floors`, description: c.intro });
}

/** Product listing for one category, or the whole catalogue when no category is given. */
export default async function CategoryView({ categoryKey }: { categoryKey?: CategoryKey }) {
  const c = categoryKey ? getCategory(categoryKey) : null;
  const path = c ? `/${c.slug}/` : "/";
  const page = await getSystemPage(systemKeyOf(c));
  let products: CatalogProduct[] = [];
  try {
    const all = await getCatalog();
    products = categoryKey ? all.filter((p) => p.categoryKey === categoryKey) : all;
  } catch (e) {
    console.error(e);
  }

  const labels: Record<string, string> = {};
  const items: ListingItem[] = products.map((p) => {
    const format = formatOf(p);
    const facets: Record<string, string[]> = {
      category: c ? [] : [getCategory(p.categoryKey).title],
      tone: p.collection ? [p.collection] : [],
      format: format ? [format] : [],
      grade: p.grade,
      construction: p.construction,
      installation: p.installation,
      brand: p.brand ? [p.brand] : [],
    };
    for (const vals of Object.values(facets)) for (const v of vals) labels[v] ??= label(v) || v;
    return { ...toCard(p), facets, createdAt: p.createdAt };
  });

  const title = c ? (legacyFor(path)?.h1 ?? c.title) : "Wooden Flooring, Decking & Facades";
  const intro = page?.excerpt?.trim() || (c?.intro ?? "Engineered wood flooring, decking, facades and accessories from Span Floors.");
  // Sections placed before a "Product list" section show above the products; the rest (or all, without one) below.
  const layout = (Array.isArray(page?.layout) ? page.layout : []) as { type: string }[];
  const at = layout.findIndex((s) => s.type === "listing");
  const above = at >= 0 ? layout.slice(0, at) : [];
  const below = at >= 0 ? layout.slice(at + 1) : layout;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, ...(c ? [{ name: c.title, path }] : [])])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          url: `${SITE_URL}${path}`,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: products.length,
            itemListElement: products.slice(0, 100).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}${p.href}`, name: p.name })),
          },
        }}
      />

      {above.length > 0 && <RenderSections layout={above} path={path} />}

      <section className="grid grid-cols-12 gap-gap border-b border-line px-gap pt-10 pb-10">
        <h1 className="mono col-span-12 text-title md:col-span-5">{title}</h1>
        <div className="col-span-12 grid gap-3 text-2xs leading-normal md:col-span-4 md:col-start-9">
          <p>{intro}</p>
          <p className="text-muted">{products.length} products</p>
        </div>
      </section>

      <Listing items={items} facets={FACETS} labels={labels} />

      {/* Extra sections added to this page in Admin → Site pages */}
      {below.length > 0 && <RenderSections layout={below} path={path} />}
    </>
  );
}
