import type { Metadata } from "next";
import Link from "next/link";
import { listPosts } from "@/server/content";
import { breadcrumbLd, JsonLd, pageMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata: Metadata = pageMetadata("/blog/", {
  title: "Blog | Wood Flooring Guides & News | Span Floors",
  description: "Guides, care advice and news on engineered wood flooring, laminate, decking and facades from Span Floors.",
});

const PER_PAGE = 12;
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");

export default async function BlogIndex({ searchParams }: { searchParams: Promise<{ page?: string; tag?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);
  const tag = sp.tag?.trim() || undefined;
  const { posts, total } = await listPosts({ limit: PER_PAGE, offset: (page - 1) * PER_PAGE, tag });
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);
  const [lead, ...rest] = posts;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog/" }])} />
      <section className="grid grid-cols-12 gap-gap border-b border-line px-gap pt-14 pb-10">
        <h1 className="mono col-span-12 text-display md:col-span-6">{tag ? `Blog: ${tag}` : "Blog"}</h1>
        <p className="col-span-12 self-end text-2xs leading-relaxed md:col-span-4 md:col-start-9">
          Guides, care advice and news on wood flooring, decking and facades.
          {tag && (
            <>
              {" "}
              <Link href="/blog/" className="underline">
                Show all articles
              </Link>
            </>
          )}
        </p>
      </section>

      {posts.length === 0 ? (
        <p className="px-gap py-24 text-muted">No articles yet.</p>
      ) : (
        <div className="px-gap pt-10 pb-24">
          {lead && page === 1 && (
            <Link href={lead.path} className="group mb-14 grid gap-gap border-b border-line pb-14 md:grid-cols-12">
              <div className="relative aspect-[16/10] overflow-hidden bg-paper-2 md:col-span-7">
                {lead.featured ? (
                  <img src={lead.featured.url} alt={lead.featured.alt} className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-butter group-hover:scale-[1.03]" />
                ) : (
                  <div className="wood" style={{ ["--tone" as string]: "#6f5a44", ["--boards" as string]: 4 }} />
                )}
              </div>
              <div className="self-end md:col-span-4 md:col-start-9">
                <div className="text-2xs text-muted">{fmt(lead.publishedAt)}</div>
                <h2 className="mt-2 text-lead group-hover:underline">{lead.title}</h2>
                {lead.excerpt && <p className="mt-3 line-clamp-4 text-2xs leading-relaxed text-muted">{lead.excerpt}</p>}
                <span className="arrow-link mt-5">Read article</span>
              </div>
            </Link>
          )}

          <div className="grid gap-x-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {(page === 1 ? rest : posts).map((p) => (
              <Link key={p.id} href={p.path} className="group">
                <div className="relative aspect-[5/6] overflow-hidden bg-paper-2">
                  {p.featured ? (
                    <img src={p.featured.url} alt={p.featured.alt} loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-butter group-hover:scale-[1.03]" />
                  ) : (
                    <div className="wood" style={{ ["--tone" as string]: "#8a6a4a", ["--boards" as string]: 3 }} />
                  )}
                </div>
                <div className="mt-3 text-2xs text-muted">{fmt(p.publishedAt)}</div>
                <div className="mt-1 text-card group-hover:underline">{p.title}</div>
              </Link>
            ))}
          </div>

          {pages > 1 && (
            <nav className="mt-14 flex justify-between border-t border-line pt-4 text-2xs" aria-label="Pagination">
              {page > 1 ? <Link href={`/blog/?${new URLSearchParams({ ...(tag ? { tag } : {}), page: String(page - 1) })}`}>← Newer</Link> : <span />}
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              {page < pages ? <Link href={`/blog/?${new URLSearchParams({ ...(tag ? { tag } : {}), page: String(page + 1) })}`}>Older →</Link> : <span />}
            </nav>
          )}
        </div>
      )}
    </>
  );
}
