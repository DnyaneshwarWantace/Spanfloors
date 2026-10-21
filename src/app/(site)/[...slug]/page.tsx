import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import ArticleBody from "@/components/ArticleBody";
import Reveal from "@/components/Reveal";
import { findRedirect, getContentByPath, listPosts } from "@/server/content";
import { breadcrumbLd, JsonLd, legacyFor, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getSettings } from "@/server/settings";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string[] }> };

const toPath = (slug: string[]) => `/${slug.map((s) => decodeURIComponent(s)).join("/")}/`;

function robotsMeta(value: string | null): Metadata["robots"] {
  const v = value ?? "max-image-preview:large";
  const index = !/noindex/.test(v);
  const follow = !/nofollow/.test(v);
  return { index, follow, googleBot: { index, follow, "max-image-preview": "large" } };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = toPath((await params).slug);
  const c = await getContentByPath(path);
  if (!c) return {};
  const defaults = await getSettings(["seo.defaultDescription"]);
  const legacy = legacyFor(path);
  const title = c.seoTitle || legacy?.title || `${c.title} - ${SITE_NAME}`;
  const description = c.seoDescription || legacy?.description || c.excerpt || defaults["seo.defaultDescription"] || undefined;
  const url = c.canonicalUrl || `${SITE_URL}${path}`;
  const image = c.featured?.url ?? legacy?.ogImage ?? "/brand/span-floors-logo.png";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: robotsMeta(c.robots),
    openGraph: {
      type: c.type === "post" ? "article" : "website",
      siteName: SITE_NAME,
      url,
      title,
      description,
      images: [{ url: image }],
      ...(c.type === "post" && c.publishedAt ? { publishedTime: c.publishedAt.toISOString(), modifiedTime: c.updatedAt.toISOString() } : {}),
    },
    twitter: { card: "summary_large_image", site: "@spanfloors", title, description, images: [image] },
  };
}

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");

export default async function CmsPage({ params }: Props) {
  const path = toPath((await params).slug);
  const c = await getContentByPath(path);

  if (!c) {
    const r = await findRedirect(path);
    if (r) (r.permanent ? permanentRedirect : redirect)(r.toPath);
    notFound();
  }

  const isPost = c.type === "post";
  const more = isPost ? (await listPosts({ limit: 4 })).posts.filter((p) => p.id !== c.id).slice(0, 3) : [];

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          ...(isPost ? [{ name: "Blog", path: "/blog/" }] : []),
          { name: c.title, path },
        ])}
      />
      {isPost && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: c.title,
            description: c.seoDescription || c.excerpt,
            url: `${SITE_URL}${path}`,
            datePublished: c.publishedAt?.toISOString(),
            dateModified: c.updatedAt.toISOString(),
            ...(c.featured ? { image: `${SITE_URL}${c.featured.url}` } : {}),
            author: c.authorName ? { "@type": "Person", name: c.authorName } : { "@type": "Organization", name: SITE_NAME },
            publisher: { "@id": `${SITE_URL}/#organization` },
          }}
        />
      )}

      <article>
        <header className="grid grid-cols-12 gap-gap border-b border-line px-gap pt-14 pb-10">
          <div className="col-span-12 md:col-span-8">
            {isPost && (
              <nav className="mb-4 text-2xs text-muted" aria-label="Breadcrumb">
                <Link href="/blog/" className="hover:text-ink">
                  Blog
                </Link>
                {c.publishedAt && <span> · {fmt(c.publishedAt)}</span>}
                {c.authorName && <span> · {c.authorName}</span>}
              </nav>
            )}
            <h1 className="mono text-display">{c.title}</h1>
          </div>
          {c.excerpt && isPost && <p className="col-span-12 self-end text-2xs leading-relaxed text-muted md:col-span-4">{c.excerpt}</p>}
        </header>

        {c.featured && (
          <Reveal zoom className="relative mx-gap mt-gap aspect-[21/9] overflow-hidden bg-paper-2">
            <img src={c.featured.url} alt={c.featured.alt} className="absolute inset-0 size-full object-cover" />
          </Reveal>
        )}

        <div className="grid grid-cols-12 gap-gap px-gap py-14">
          <ArticleBody html={c.body} className="col-span-12 md:col-span-8 md:col-start-3 xl:col-span-6 xl:col-start-4" />
        </div>

        {isPost && c.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 px-gap pb-10 md:pl-[calc(25%+var(--spacing-gap))]">
            {c.tags.map((t) => (
              <Link key={t} href={`/blog/?tag=${encodeURIComponent(t)}`} className="border border-line px-2.5 py-1 text-2xs hover:border-ink">
                {t}
              </Link>
            ))}
          </div>
        )}
      </article>

      {more.length > 0 && (
        <section className="px-gap pb-24">
          <div className="mb-10 flex items-baseline justify-between border-t border-line pt-3.5">
            <h2 className="mono text-title">More from the blog</h2>
            <Link href="/blog/" className="arrow-link">
              All articles
            </Link>
          </div>
          <div className="grid gap-gap md:grid-cols-3">
            {more.map((p) => (
              <Link key={p.id} href={p.path} className="group">
                <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
                  {p.featured ? (
                    <img src={p.featured.url} alt={p.featured.alt} className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-butter group-hover:scale-[1.03]" />
                  ) : (
                    <div className="wood" style={{ ["--tone" as string]: "#8a6a4a", ["--boards" as string]: 3 }} />
                  )}
                </div>
                <div className="mt-3 text-2xs text-muted">{fmt(p.publishedAt)}</div>
                <div className="mt-1 text-card group-hover:underline">{p.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
