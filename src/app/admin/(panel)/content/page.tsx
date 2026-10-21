import Link from "next/link";
import Dropdown from "@/components/ui/Dropdown";
import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { Badge, btn, EmptyState, formatDate, inputCls, Notice, PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "published", "draft", "scheduled", "archived"] as const;
const PER_PAGE = 30;

export default async function ContentList({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; page?: string; sort?: string; deleted?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const type = sp.type === "page" ? "page" : "post";
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof STATUSES)[number]) : "all";
  const q = sp.q?.trim() ?? "";
  const page = Math.max(Number(sp.page) || 1, 1);
  const sort = sp.sort === "title" ? "title" : "updated";

  const where: SQL[] = [eq(schema.content.type, type)];
  if (status !== "all") where.push(eq(schema.content.status, status));
  if (q) where.push(or(ilike(schema.content.title, `%${q}%`), ilike(schema.content.path, `%${q}%`))!);

  const [rows, [{ n: total }], counts] = await Promise.all([
    db
      .select({
        id: schema.content.id,
        title: schema.content.title,
        path: schema.content.path,
        status: schema.content.status,
        updatedAt: schema.content.updatedAt,
        publishedAt: schema.content.publishedAt,
        seoTitle: schema.content.seoTitle,
        seoDescription: schema.content.seoDescription,
        robots: schema.content.robots,
        legacy: schema.content.legacyWpId,
        author: schema.users.name,
      })
      .from(schema.content)
      .leftJoin(schema.users, eq(schema.users.id, schema.content.authorId))
      .where(and(...where))
      .orderBy(sort === "title" ? asc(schema.content.title) : desc(schema.content.updatedAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ n: count() }).from(schema.content).where(and(...where)),
    db
      .select({ status: schema.content.status, n: count() })
      .from(schema.content)
      .where(eq(schema.content.type, type))
      .groupBy(schema.content.status),
  ]);

  const countOf = (s: string) => (s === "all" ? counts.reduce((a, c) => a + c.n, 0) : (counts.find((c) => c.status === s)?.n ?? 0));
  const href = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams({ type, ...(status !== "all" ? { status } : {}), ...(q ? { q } : {}), ...(sort !== "updated" ? { sort } : {}) });
    for (const [k, v] of Object.entries(over)) v === undefined || v === "" ? p.delete(k) : p.set(k, String(v));
    return `/admin/content/?${p}`;
  };
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);
  const label = type === "post" ? "Blog posts" : "Pages";

  return (
    <>
      <PageHeader
        title={label}
        description={type === "post" ? "Articles shown on the blog." : "Standalone pages such as About, Projects, Dealers and region pages."}
        actions={
          <Link href={`/admin/content/new/?type=${type}`} className={btn.primary}>
            New {type === "post" ? "blog post" : "page"}
          </Link>
        }
      />
      {sp.deleted && (
        <div className="mb-4">
          <Notice tone="success">Deleted.</Notice>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={href({ status: s === "all" ? undefined : s, page: undefined })}
            aria-current={status === s ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent pb-2 text-2xs capitalize text-muted hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
          >
            {s} <span className="tabular-nums">({countOf(s)})</span>
          </Link>
        ))}
        <form className="ml-auto flex items-center gap-2 pb-2" action="/admin/content/">
          <input type="hidden" name="type" value={type} />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search title or URL…" className={`${inputCls} h-8 w-56 text-2xs`} aria-label="Search" />
          <Dropdown
            name="sort"
            defaultValue={sort}
            submitOnChange
            size="sm"
            className="w-40"
            aria-label="Sort"
            options={[
              { value: "updated", label: "Recently edited" },
              { value: "title", label: "Title A–Z" },
            ]}
          />
          <button className={`${btn.secondary} h-8`}>Apply</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={q ? `Nothing matches “${q}”.` : `No ${label.toLowerCase()} here yet.`}>
          <Link href={`/admin/content/new/?type=${type}`} className="underline">
            Create one
          </Link>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[56rem] text-left text-2xs">
            <thead className="bg-paper-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">SEO</th>
                <th className="px-4 py-2.5 font-medium">Author</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const seoOk = Boolean(r.seoTitle && r.seoDescription);
                return (
                  <tr key={r.id} className="border-t border-line hover:bg-paper-2/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/content/${r.id}/?type=${type}`} className="text-body hover:underline">
                        {r.title}
                      </Link>
                      <div className="mt-0.5 font-mono text-muted">{r.path}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={r.status} />
                      {r.status === "scheduled" && <div className="mt-1 text-muted">{formatDate(r.publishedAt, true)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {/noindex/.test(r.robots ?? "") ? (
                        <span className="text-muted">Hidden from search</span>
                      ) : seoOk ? (
                        <span>✓ Title &amp; description</span>
                      ) : (
                        <span className="text-[#a0661f]">{r.seoTitle ? "No description" : "No SEO title"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.author ?? (r.legacy ? "Imported" : "—")}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(r.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-2xs" aria-label="Pagination">
          <span className="text-muted">
            Page {page} of {pages} · {total} items
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className={btn.secondary}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className={btn.secondary}>
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
