import Link from "next/link";
import ArrangeProducts from "@/components/admin/ArrangeProducts";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { CATEGORIES, displayName, getFullCatalog, subtitleOf, type CategoryKey } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function ArrangePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const catalog = await getFullCatalog().catch(() => []);
  const available = CATEGORIES.filter((c) => catalog.some((p) => p.categoryKey === c.key));
  const current = available.find((c) => c.key === sp.category) ?? available[0];
  const items = current
    ? catalog
        .filter((p) => p.categoryKey === (current.key as CategoryKey))
        .map((p) => ({
          id: p.id,
          name: displayName(p),
          subtitle: subtitleOf(p),
          image: p.images[0] ?? null,
          tone: p.collection,
          hidden: p.hidden,
          featured: p.featured,
          editHref: `/admin/products/${p.id}/`,
        }))
    : [];

  return (
    <>
      <PageHeader
        title="Arrange products"
        description={
          <>
            <Link href="/admin/products/" className="hover:underline">← All products</Link> · Set the order products appear on the website. Changes are stored here only, never in Twenty.
          </>
        }
      />
      <nav className="mb-5 flex flex-wrap gap-x-4 gap-y-2 border-b border-line" aria-label="Category">
        {available.map((c) => (
          <Link
            key={c.key}
            href={`/admin/products/arrange/?category=${c.key}`}
            aria-current={c.key === current?.key ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent pb-2 text-2xs text-muted hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
          >
            {c.title} ({catalog.filter((p) => p.categoryKey === c.key).length})
          </Link>
        ))}
      </nav>
      {current ? <ArrangeProducts key={current.key} initial={items} categoryTitle={current.title} /> : <p className="text-muted">No products with a category yet.</p>}
    </>
  );
}
