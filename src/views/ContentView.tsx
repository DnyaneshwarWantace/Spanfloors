import Link from "next/link";
import ArticleBody from "@/components/ArticleBody";
import Reveal from "@/components/Reveal";
import { authorByName, relatedPosts } from "@/server/content";
import { readingMinutes, withHeadingIds } from "@/lib/article";
import { breadcrumbLd, JsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";
import RenderSections from "@/sections/RenderSections";
import type { Section } from "@/sections/types";
import { AnswerBox, QuestionList } from "@/components/AnswerBlocks";
import { cleanAeo } from "@/server/aeo";
import { getTexts } from "@/server/site-config";
import { sized, srcSet } from "@/lib/img";

/** What a page or post needs to render (the live item, an unsaved preview, or an old version). */
export type ViewContent = {
  id: string | null;
  type: "post" | "page";
  title: string;
  body: string;
  layout: unknown;
  excerpt: string;
  publishedAt: Date | null;
  updatedAt: Date;
  tags: string[];
  authorName: string | null;
  seoDescription: string | null;
  featured: { url: string; alt: string } | null;
  aeo?: unknown;
  schemaType?: string | null;
  relatedIds?: string[];
};

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");

/** A CMS page or blog post on the site layout. Shared by the live route and the admin previews. */
export default async function ContentView({ c, path, preview = false }: { c: ViewContent; path: string; preview?: boolean }) {
  const isPost = c.type === "post";
  const layout = (Array.isArray(c.layout) ? c.layout : []) as Section[];
  // A page built from sections: its hero is the page heading; without a hero the usual title header shows.
  const hasHero = !isPost && layout.some((s) => s.type === "hero" && !s.hidden);
  const useSections = !isPost && layout.length > 0;
  const aeo = cleanAeo(c.aeo);
  const texts = await getTexts();
  const url = `${SITE_URL}${path}`;
  const modified = aeo.reviewedAt && new Date(aeo.reviewedAt) > c.updatedAt ? new Date(aeo.reviewedAt) : c.updatedAt;
  const more = isPost ? await relatedPosts(c.id, c.relatedIds ?? [], c.tags) : [];
  const author = isPost ? await authorByName(c.authorName) : null;
  const article = isPost ? withHeadingIds(c.body) : { html: c.body, toc: [] };
  const minutes = isPost ? readingMinutes(c.body) : 0;
  const authorLd = author
    ? {
        "@type": "Person",
        name: author.name,
        url: `${SITE_URL}/blog/author/${author.slug}/`,
        ...(author.jobTitle ? { jobTitle: author.jobTitle } : {}),
        ...(author.photo ? { image: `${SITE_URL}${author.photo}` } : {}),
        ...(author.links.length ? { sameAs: author.links } : {}),
        worksFor: { "@id": `${SITE_URL}/#organization` },
      }
    : c.authorName
      ? { "@type": "Person", name: c.authorName }
      : { "@type": "Organization", name: SITE_NAME };

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
            "@id": `${url}#article`,
            headline: c.title,
            description: aeo.answer || c.seoDescription || c.excerpt,
            url,
            mainEntityOfPage: url,
            datePublished: c.publishedAt?.toISOString(),
            dateModified: modified.toISOString(),
            ...(c.featured ? { image: `${SITE_URL}${c.featured.url}` } : {}),
            ...(c.tags.length ? { keywords: c.tags.join(", ") } : {}),
            inLanguage: "en-IN",
            author: authorLd,
            ...(minutes ? { timeRequired: `PT${minutes}M` } : {}),
            publisher: { "@id": `${SITE_URL}/#organization` },
          }}
        />
      )}
      {!isPost && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": c.schemaType || "WebPage",
            "@id": `${url}#webpage`,
            name: c.title,
            description: aeo.answer || c.seoDescription || c.excerpt || undefined,
            url,
            inLanguage: "en-IN",
            isPartOf: { "@id": `${SITE_URL}/#website` },
            dateModified: modified.toISOString(),
            ...(aeo.reviewedAt ? { lastReviewed: aeo.reviewedAt } : {}),
            ...(c.featured ? { primaryImageOfPage: `${SITE_URL}${c.featured.url}` } : {}),
            publisher: { "@id": `${SITE_URL}/#organization` },
          }}
        />
      )}

      {useSections && (
        <>
          {!hasHero && (
            <header className="border-b border-line px-gap pt-14 pb-10">
              <h1 className="mono text-display">{c.title}</h1>
            </header>
          )}
          <RenderSections layout={layout} path={path} preview={preview} extraFaqs={aeo.faqs} />
          {(aeo.answer || aeo.takeaways.length > 0 || aeo.faqs.length > 0) && (
            <div className="mx-auto grid max-w-3xl gap-12 px-gap py-14">
              <AnswerBox aeo={aeo} />
              <QuestionList faqs={aeo.faqs} />
            </div>
          )}
        </>
      )}

      {!useSections && (
      <article>
        <header className="grid grid-cols-12 gap-gap border-b border-line px-gap pt-14 pb-10">
          <div className="col-span-12 md:col-span-8">
            {isPost && (
              <nav className="mb-4 text-2xs text-muted" aria-label="Breadcrumb">
                <Link href="/blog/" className="hover:text-ink">
                  Blog
                </Link>
                {c.publishedAt && <span> · {fmt(c.publishedAt)}</span>}
                {c.authorName &&
                  (author ? (
                    <span>
                      {" · "}
                      <Link href={`/blog/author/${author.slug}/`} className="hover:text-ink">
                        {c.authorName}
                      </Link>
                    </span>
                  ) : (
                    <span> · {c.authorName}</span>
                  ))}
                <span> · {minutes} min read</span>
              </nav>
            )}
            <h1 className="mono text-display">{c.title}</h1>
          </div>
          {c.excerpt && isPost && <p className="col-span-12 self-end text-2xs leading-relaxed text-muted md:col-span-4">{c.excerpt}</p>}
        </header>

        {c.featured && (
          <Reveal zoom className="relative mx-gap mt-gap aspect-[21/9] overflow-hidden bg-paper-2">
            <img src={sized(c.featured.url, 1600)} srcSet={srcSet(c.featured.url)} sizes="100vw" alt={c.featured.alt} fetchPriority="high" className="absolute inset-0 size-full object-cover" />
          </Reveal>
        )}

        <div className="grid grid-cols-12 gap-gap px-gap py-14">
          <div className="col-span-12 grid gap-10 md:col-span-8 md:col-start-3 xl:col-span-6 xl:col-start-4">
            <AnswerBox aeo={aeo} />
            {article.toc.filter((t) => t.level === 2).length >= 3 && (
              <nav aria-label="In this article" className="border border-line bg-paper-2/60 p-5">
                <h2 className="mb-3 text-2xs font-semibold tracking-[0.06em] uppercase">In this article</h2>
                <ol className="grid gap-1.5 text-2xs">
                  {article.toc.map((t) => (
                    <li key={t.id} className={t.level === 3 ? "pl-4 text-muted" : ""}>
                      <a href={`#${t.id}`} className="hover:underline">
                        {t.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <ArticleBody html={article.html} />
            <QuestionList faqs={aeo.faqs} />
            {aeo.reviewedAt && <p className="text-2xs text-muted">Last reviewed {fmt(new Date(aeo.reviewedAt))}</p>}
            {author && (
              <aside aria-label="About the author" className="flex gap-4 border-t border-line pt-6">
                {author.photo && <img src={sized(author.photo, 320)} alt="" loading="lazy" className="size-16 shrink-0 rounded-full object-cover" />}
                <div className="min-w-0">
                  <div className="text-2xs text-muted">Written by</div>
                  <Link href={`/blog/author/${author.slug}/`} className="text-card hover:underline">
                    {author.name}
                  </Link>
                  {author.jobTitle && <div className="text-2xs text-muted">{author.jobTitle}</div>}
                  {author.bio && <p className="mt-2 text-2xs leading-relaxed text-ink-2">{author.bio}</p>}
                </div>
              </aside>
            )}
          </div>
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
      )}

      {/* Extra sections after an article (always rendered: it also emits the page's FAQ data for Google). */}
      {!useSections && <RenderSections layout={isPost ? layout : []} path={path} preview={preview} extraFaqs={aeo.faqs} />}

      {more.length > 0 && (
        <section className="px-gap pb-24">
          <div className="mb-10 flex items-baseline justify-between border-t border-line pt-3.5">
            <h2 className="mono text-title">{texts["blog.more"]}</h2>
            <Link href="/blog/" className="arrow-link">
              {texts["blog.all"]}
            </Link>
          </div>
          <div className="grid gap-gap md:grid-cols-3">
            {more.map((p) => (
              <Link key={p.id} href={p.path} className="group">
                <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
                  {p.featured ? (
                    <img src={sized(p.featured.url, 960)} srcSet={srcSet(p.featured.url)} sizes="(min-width: 768px) 33vw, 100vw" alt={p.featured.alt} loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-butter group-hover:scale-[1.03]" />
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
