import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Gobo, { goboSceneFor } from "@/components/Gobo";
import ProductMedia from "@/components/ProductMedia";
import CardsSlider from "@/components/CardsSlider";
import PdpGallery from "@/components/PdpGallery";
import ArticleBody from "@/components/ArticleBody";
import {
  closestProduct,
  displayName,
  formatOf,
  getCatalog,
  getCategory,
  getCategoryProducts,
  getProduct,
  label,
  productImages,
  toCard,
  type CatalogProduct,
  type CategoryKey,
} from "@/lib/catalog";
import { breadcrumbLd, JsonLd, legacyFor, pageMetadata, SITE_URL } from "@/lib/seo";

export async function productStaticParams(key: CategoryKey) {
  try {
    return (await getCategoryProducts(key)).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function productMetadata(key: CategoryKey, slug: string): Promise<Metadata> {
  const c = getCategory(key);
  const p = await getProduct(key, slug).catch(() => null);
  if (!p) return { title: c.title };
  const meta = pageMetadata(p.href, {
    title: `${displayName(p)} - Span Floors`,
    description: describe(p, c.title),
    image: productImages(p)[0] ?? null,
  });
  // Admin SEO overrides win over legacy/generated values.
  if (p.seoTitle) meta.title = { absolute: p.seoTitle };
  if (p.seoDescription) meta.description = p.seoDescription;
  return meta;
}

function describe(p: CatalogProduct, categoryTitle: string): string {
  if (p.specification) return p.specification;
  const bits = [
    p.brand && `by ${p.brand}`,
    p.collection && `in ${label(p.collection).toLowerCase()} tones`,
    p.grade.length && `${p.grade.map(label).join("/")} grade`,
    p.dimensions && `sized ${p.dimensions}`,
  ].filter(Boolean);
  return `${displayName(p)}: ${categoryTitle.toLowerCase()} ${bits.join(", ")}. Order free samples from Span Floors.`;
}

/** Short, plain-language notes on each grade (shown in the Grade section). */
const GRADE_NOTES: Record<string, string> = {
  AB: "A calm, consistent surface with only small, scattered knots and gentle colour variation.",
  ABC: "Balanced character: small to medium knots and moderate colour variation across boards.",
  ABCD: "Full natural character with larger knots, colour shifts and visible grain movement.",
  NATURE: "Natural timber character with knots and colour variation left on show.",
  OPT1_NATUR: "Natural timber character with knots and colour variation left on show.",
  CHARACTER: "Pronounced knots, splits and colour contrast for a lived-in, rustic look.",
  TAVERN: "Bold, rugged character with large knots and strong variation, like old tavern boards.",
  RUSTIC: "Heavy knots, cracks and colour variation that celebrate raw timber.",
  SELECT_BETTER: "Selected boards with minimal knots and an even, refined appearance.",
  SELECT_CUT: "Selected boards with minimal knots and an even, refined appearance.",
  COMPOSED_CUT: "A composed mix of boards with light, even character.",
  NATURAL_CUT: "Boards cut to show the timber's natural grain and features.",
  OPT1_COMMON: "Everyday grade with natural features and colour variation.",
};

function specRows(p: CatalogProduct): [string, string][] {
  const rows: [string, string | null | undefined][] = [
    ["Brand", p.brand],
    ["Format", formatOf(p)],
    ["Dimensions", p.dimensions],
    ["Length", p.range ?? p.lengths],
    ["Width", p.differentiator],
    ["Colour tone", p.collection && label(p.collection)],
    ["Grade", p.grade.map(label).join(", ")],
    ["Construction", p.construction.map(label).join(", ")],
    ["Installation", p.installation.map(label).join(", ")],
    ["Species", [...new Set(p.variants.map((v) => v.species).filter(Boolean))].join(", ")],
    ["Planks per box", p.planksPerBox],
    ["Coverage per box", p.areaPerBoxSqft ? `${p.areaPerBoxSqft} sq ft` : null],
    ["Type", p.accessoryType && label(p.accessoryType)],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}

const FORMAT_ICON: Record<string, string> = {
  Herringbone: "M2 10l4-4 4 4M2 6l4-4 4 4",
  Chevron: "M2 9l4-4 4 4M2 5l4-4 4 4",
  Plank: "M1 3h10M1 6h10M1 9h10",
  Tile: "M1 1h10v10H1zM6 1v10M1 6h10",
};

export default async function ProductView({ categoryKey, slug }: { categoryKey: CategoryKey; slug: string }) {
  const c = getCategory(categoryKey);
  const p = await getProduct(categoryKey, slug).catch(() => null);
  if (!p) {
    // An old spanfloors.com product URL: 301 to the closest product, or to the category, to keep its ranking.
    if (legacyFor(`/${c.slug}/${slug}/`)) {
      const products = await getCategoryProducts(categoryKey).catch(() => []);
      permanentRedirect(closestProduct(slug, products)?.href ?? `/${c.slug}/`);
    }
    notFound();
  }

  const name = displayName(p);
  const format = formatOf(p);
  const images = productImages(p);
  const specs = specRows(p);
  const lead = describe(p, c.title);
  const legacy = legacyFor(p.href);
  const catalog = await getCatalog();
  const inCategory = catalog.filter((x) => x.categoryKey === categoryKey);

  // Other tones in the same format (and brand when known), shown as swatches like a colour range.
  const tones = inCategory.filter((x) => x.id === p.id || (formatOf(x) === format && (!p.brand || x.brand === p.brand) && x.collection)).slice(0, 10);

  const similar = inCategory
    .filter((x) => x.id !== p.id)
    .sort(
      (a, b) =>
        Number(b.collection === p.collection) - Number(a.collection === p.collection) || Number(formatOf(b) === format) - Number(formatOf(a) === format),
    )
    .slice(0, 10)
    .map(toCard);

  // Variants grouped by format; products without linked variants show their own size.
  const groups = new Map<string, { size: string; box: string | null }[]>();
  for (const v of p.variants) {
    const key = v.format ?? format ?? "Standard";
    groups.set(key, [...(groups.get(key) ?? []), { size: v.dimensions ?? "—", box: v.sqftBox }]);
  }
  if (!groups.size && p.dimensions) {
    groups.set(format ?? "Standard", [{ size: p.dimensions, box: p.areaPerBoxSqft ? `${p.areaPerBoxSqft} sq ft/box` : null }]);
  }
  const gradeLabel = p.grade.map(label).join(", ") || "—";
  const categoryGrades = [...new Set(inCategory.flatMap((x) => x.grade))].slice(0, 6);

  const boards = format === "Plank" ? 3 : format === "Tile" ? 2 : 6;
  const scene = goboSceneFor(p.id);
  const slides = [
    <>
      <ProductMedia src={images[0]} alt={name} tone={p.collection} boards={boards} eager />
      <Gobo scene={scene} strength={1.15} />
    </>,
    <ProductMedia key="b" src={images[1]} alt={`${name} — detail`} tone={p.collection} boards={1} />,
    <>
      <ProductMedia src={images[2]} alt={`${name} — room view`} tone={p.collection} boards={boards + 2} />
      <Gobo scene={goboSceneFor(p.id, 1)} strength={0.9} />
    </>,
    ...images.slice(3).map((src, i) => <ProductMedia key={`x${i}`} src={src} alt={`${name} — ${i + 4}`} tone={p.collection} />),
  ];

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: c.title, path: `/${c.slug}/` },
          { name, path: p.href },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          url: `${SITE_URL}${p.href}`,
          description: lead,
          category: c.title,
          ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
          ...(images.length ? { image: images } : {}),
        }}
      />

      {/* Cover: info column (32.5%) · gap (13.9%) · gallery bleeding off the right edge */}
      <section className="flex flex-col lg:grid lg:h-[calc(100svh-var(--spacing-header))] lg:min-h-[44rem] lg:grid-cols-[32.5%_13.9%_minmax(0,1fr)]">
        <div className="order-2 flex flex-col px-gap pt-6 pb-gap lg:order-1 lg:overflow-y-auto lg:pt-[3.5rem]">
          <nav className="text-2xs text-muted" aria-label="Breadcrumb">
            <Link href={`/${c.slug}/`} className="hover:text-ink">
              {c.title}
            </Link>
            {p.brand && <span> · {p.brand}</span>}
          </nav>
          <h1 className="mono mt-3 text-title">{legacy?.h1 ?? name}</h1>

          {p.dimensions && (
            <div className="mono mt-12 mb-6 flex items-baseline justify-between gap-4 border-b border-line pb-3 text-body">
              <span>{p.dimensions}</span>
              {format && <span className="shrink-0 text-muted">{format}</span>}
            </div>
          )}
          <p className="max-w-[30rem] text-2xs leading-relaxed">{lead}</p>

          {tones.length > 1 && (
            <div className="mt-6">
              <div className="mb-2 text-2xs text-muted">
                Tone: <span className="text-ink">{p.collection ? label(p.collection) : "—"}</span>
              </div>
              <div className="flex flex-wrap gap-0.5">
                {tones.map((t) => (
                  <Link
                    key={t.id}
                    href={t.href}
                    title={displayName(t)}
                    aria-current={t.id === p.id ? "page" : undefined}
                    className="relative size-8 overflow-hidden outline-offset-2 outline-ink aria-[current=page]:outline aria-[current=page]:outline-1"
                  >
                    <ProductMedia src={productImages(t)[0]} alt={displayName(t)} tone={t.collection} boards={2} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {groups.size > 0 && (
            <div className="mt-8 border-t border-line">
              {[...groups.entries()].map(([fmt, rows], i) => (
                <details key={fmt} open={i === 0}>
                  <summary className="chev mt-2 bg-paper-2 py-1.5 pr-2 pl-1.5 text-body">
                    <span className="flex items-center gap-3">
                      <span className="grid size-6 place-items-center bg-paper-2">
                        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1">
                          <path d={FORMAT_ICON[fmt] ?? FORMAT_ICON.Plank} />
                        </svg>
                      </span>
                      {fmt}
                    </span>
                  </summary>
                  <div className="pb-2 text-2xs">
                    <div className="grid grid-cols-[1fr_7rem] px-2 pt-3 pb-1.5 text-muted">
                      <span>Size</span>
                      <span>Grade</span>
                    </div>
                    {rows.map((r, j) => (
                      <div key={j} className={`grid min-h-[1.85rem] grid-cols-[1fr_7rem] items-center px-2 ${j === 0 ? "border-b border-ink bg-paper-2" : ""}`}>
                        <span>
                          {r.size}
                          {r.box && <span className="text-muted"> · {r.box}</span>}
                        </span>
                        <span>{gradeLabel}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}

          <div className="mt-auto grid grid-cols-3 gap-gap pt-10 pb-5 text-center text-2xs">
            <div>
              <svg viewBox="0 0 24 24" className="mx-auto mb-1.5 size-5" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M4 7h16v13H4zM4 7l2-3h12l2 3M9 11h6" />
              </svg>
              Free samples
            </div>
            <div>
              <strong className="mb-1 block text-body font-medium">20+ years</strong>Expertise
            </div>
            <div>
              <strong className="mb-1 block text-body font-medium">Pan-India</strong>Installation
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px">
            <Link
              href="/thank-you-for-free-sample/"
              className="flex h-12 items-center justify-center gap-2 border border-ink bg-ink text-2xs text-paper transition-colors hover:bg-transparent hover:text-ink"
            >
              Add Sample <span aria-hidden="true">+</span>
            </Link>
            <Link href="/contact-us/" className="flex h-12 items-center justify-center border border-ink text-2xs transition-colors hover:bg-ink hover:text-paper">
              Enquire Now
            </Link>
          </div>
        </div>

        <div className="hidden lg:order-2 lg:block" />

        <div className="order-1 h-[62svh] min-h-[22rem] min-w-0 overflow-hidden pt-4 pl-gap lg:order-3 lg:h-auto lg:min-h-0 lg:pt-[4.7rem] lg:pb-4 lg:pl-0">
          <PdpGallery slides={slides} label={`${name} images`} />
        </div>
      </section>

      {/* Description + accordions */}
      <section className="grid grid-cols-12 gap-gap px-gap pt-14 pb-[4.5rem]">
        <p className="col-span-12 mb-16 text-lead md:col-span-9">{lead}</p>
        {p.descriptionHtml && <ArticleBody html={p.descriptionHtml} className="col-span-12 mb-12 md:col-span-6" />}
        <div className="col-span-12 text-2xs md:col-span-6 md:col-start-7">
          <details open className="border-b border-line">
            <summary className="chev mt-1 bg-paper-2 px-2 py-2.5">Specifications</summary>
            <dl className="grid grid-cols-[1fr_2fr] gap-x-4 gap-y-2 px-2 pt-4 pb-5">
              {specs.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </details>
          <details className="border-b border-line">
            <summary className="chev mt-1 bg-paper-2 px-2 py-2.5">Installation &amp; Care</summary>
            <p className="px-2 pt-4 pb-5 leading-relaxed">
              Let the boxes acclimatise on site before laying, keep relative humidity between 45 and 65%, and clean with a dry or lightly damp mop and a
              pH-neutral wood cleaner. Our team can advise on subfloors, underlays and finishing profiles.
            </p>
          </details>
          <details className="border-b border-line">
            <summary className="chev mt-1 bg-paper-2 px-2 py-2.5">Files &amp; Downloads</summary>
            <p className="px-2 pt-4 pb-5">
              <Link className="arrow-link" href="/downloads/">
                Catalogues and technical sheets
              </Link>
            </p>
          </details>
        </div>
      </section>

      {/* Grade */}
      {categoryGrades.length > 1 && (
        <section className="px-gap pb-20">
          <div className="grid grid-cols-12 gap-gap border-t border-line pt-3.5">
            <h2 className="mono col-span-12 text-title md:col-span-6">Grade</h2>
            <p className="col-span-12 text-2xs leading-relaxed md:col-span-4 md:col-start-9">
              Grade describes how much natural character shows in the timber: knots, grain movement and colour variation. It changes the look, not the
              performance.
            </p>
          </div>
          <div className="mt-14 grid gap-gap sm:grid-cols-2 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ ["--n" as string]: categoryGrades.length }}>
            {categoryGrades.map((g, i) => {
              const current = p.grade.includes(g);
              const samples = inCategory.filter((x) => x.grade.includes(g)).slice(0, 2);
              return (
                <div key={g} className={`border-l border-line pl-2.5 ${current ? "" : "opacity-55"}`}>
                  <div className="text-2xs font-medium">{String(i + 1).padStart(2, "0")}</div>
                  <div className="mt-2 mb-4 text-card">
                    {label(g)}
                    {current && <span className="ml-2 text-2xs text-muted">This product</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {samples.map((s) => (
                      <div key={s.id} className="relative aspect-[5/6] overflow-hidden">
                        <ProductMedia src={productImages(s)[0]} alt={displayName(s)} tone={s.collection} boards={2} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-2xs leading-relaxed text-muted">{GRADE_NOTES[g] ?? "Natural timber character in this grade."}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="pb-24">
          <div className="mx-gap mb-[7rem] flex items-baseline justify-between border-t border-line pt-3.5">
            <h2 className="mono text-title">Similar Products</h2>
            <Link className="arrow-link" href={`/${c.slug}/`}>
              View all {c.title.toLowerCase()}
            </Link>
          </div>
          <CardsSlider products={similar} />
        </section>
      )}
    </>
  );
}
