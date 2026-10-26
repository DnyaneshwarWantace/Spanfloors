import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sized, srcSet } from "@/lib/img";
import { authorBySlug, postsByAuthor } from "@/server/content";
import { buildMetadata } from "@/server/metadata";
import { breadcrumbLd, JsonLd, SITE_URL } from "@/lib/seo";

export const revalidate = 300;

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await authorBySlug((await params).slug);
  if (!a) return {};
  return buildMetadata({
    path: `/blog/author/${a.slug}/`,
    title: a.name,
    fallbackTitle: `${a.name}${a.jobTitle ? `, ${a.jobTitle}` : ""} | Span Floors Blog`,
    description: a.bio || `Articles by ${a.name} on the Span Floors blog.`,
    photo: a.photo,
    kicker: "Author",
  });
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const a = await authorBySlug((await params).slug);
  if (!a) notFound();
  const posts = await postsByAuthor(a.name);
  const url = `${SITE_URL}/blog/author/${a.slug}/`;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog/" }, { name: a.name, path: `/blog/author/${a.slug}/` }])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          "@id": `${url}#page`,
          url,
          mainEntity: {
            "@type": "Person",
            name: a.name,
            url,
            ...(a.jobTitle ? { jobTitle: a.jobTitle } : {}),
            ...(a.bio ? { description: a.bio } : {}),
            ...(a.photo ? { image: `${SITE_URL}${a.photo}` } : {}),
            ...(a.links.length ? { sameAs: a.links } : {}),
            worksFor: { "@id": `${SITE_URL}/#organization` },
          },
        }}
      />
      <section className="grid grid-cols-12 gap-gap border-b border-line px-gap pt-14 pb-10">
        <div className="col-span-12 md:col-span-7">
          <nav className="mb-4 text-2xs text-muted" aria-label="Breadcrumb">
            <Link href="/blog/" className="hover:text-ink">
              Blog
            </Link>
            <span> · Author</span>
          </nav>
          <div className="flex items-center gap-5">
            {a.photo && <img src={sized(a.photo, 320)} alt="" className="size-20 shrink-0 rounded-full object-cover" />}
            <div className="min-w-0">
              <h1 className="mono text-display">{a.name}</h1>
              {a.jobTitle && <div className="mt-1 text-2xs text-muted">{a.jobTitle}</div>}
            </div>
          </div>
        </div>
        <div className="col-span-12 self-end text-2xs leading-relaxed md:col-span-4 md:col-start-9">
          {a.bio && <p>{a.bio}</p>}
          {a.links.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-3">
              {a.links.map((l) => (
                <li key={l}>
                  <a href={l} target="_blank" rel="noopener me" className="underline">
                    {(() => {
                      try {
                        return new URL(l).hostname.replace(/^www\./, "");
                      } catch {
                        return l;
                      }
                    })()}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="px-gap pt-10 pb-24">
        <h2 className="mb-8 text-2xs text-muted">
          {posts.length} {posts.length === 1 ? "article" : "articles"}
        </h2>
        <div className="grid gap-x-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((p) => (
            <Link key={p.id} href={p.path} className="group">
              <div className="relative aspect-[5/6] overflow-hidden bg-paper-2">
                {p.featured ? (
                  <img src={sized(p.featured.url, 960)} srcSet={srcSet(p.featured.url)} sizes="(min-width: 640px) 25vw, 100vw" alt={p.featured.alt} loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-butter group-hover:scale-[1.03]" />
                ) : (
                  <div className="wood" style={{ ["--tone" as string]: "#8a6a4a", ["--boards" as string]: 3 }} />
                )}
              </div>
              <div className="mt-3 text-2xs text-muted">{fmt(p.publishedAt)}</div>
              <div className="mt-1 text-card group-hover:underline">{p.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
