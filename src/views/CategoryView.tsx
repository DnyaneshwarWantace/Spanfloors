import type { Metadata } from "next";
import Listing, { type ListingItem } from "@/components/Listing";
import { formatOf, getCatalog, getCategory, label, toCard, type CatalogProduct, type CategoryKey } from "@/lib/catalog";
import { breadcrumbLd, JsonLd, legacyFor, pageMetadata, SITE_URL } from "@/lib/seo";

const FACETS = [
  { key: "category", label: "Category" },
  { key: "tone", label: "Colour Tones" },
  { key: "format", label: "Formats" },
  { key: "grade", label: "Grades" },
  { key: "construction", label: "Construction" },
  { key: "installation", label: "Installation" },
  { key: "brand", label: "Brands" },
];

export function categoryMetadata(key: CategoryKey): Metadata {
  const c = getCategory(key);
  return pageMetadata(`/${c.slug}/`, { title: `${c.title} | Span Floors`, description: c.intro });
}

/** Product listing for one category, or the whole catalogue when no category is given. */
export default async function CategoryView({ categoryKey }: { categoryKey?: CategoryKey }) {
  const c = categoryKey ? getCategory(categoryKey) : null;
  const path = c ? `/${c.slug}/` : "/";
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
  const intro = c?.intro ?? "Engineered wood flooring, decking, facades and accessories from Span Floors.";

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

      <section className="grid grid-cols-12 gap-gap border-b border-line px-gap pt-10 pb-10">
        <h1 className="mono col-span-12 text-title md:col-span-5">{title}</h1>
        <div className="col-span-12 grid gap-3 text-2xs leading-normal md:col-span-4 md:col-start-9">
          <p>{intro}</p>
          <p className="text-muted">{products.length} products</p>
        </div>
      </section>

      <Listing items={items} facets={FACETS} labels={labels} />
    </>
  );
}
