import Link from "next/link";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import Dropdown from "@/components/ui/Dropdown";
import { EmptyState, inputCls, PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

const AREAS = [
  { value: "", label: "Everything" },
  { value: "content", label: "Pages & posts", entities: ["page", "post", "preview", "tag", "author", "reusable"] },
  { value: "media", label: "Media", entities: ["media"] },
  { value: "product", label: "Products", entities: ["product"] },
  { value: "lead", label: "Leads", entities: ["lead"] },
  { value: "settings", label: "Settings & menus", entities: ["settings"] },
  { value: "redirect", label: "Redirects", entities: ["redirect"] },
  { value: "user", label: "Sign-ins & users", entities: ["user"] },
];

/** Where an activity row's item can be opened, if it still has a page in the admin. */
function itemHref(entity: string, id: string | null) {
  if (!id) return null;
  if (entity === "page" || entity === "post") return `/admin/content/${id}/`;
  if (entity === "product") return `/admin/products/${id}/`;
  if (entity === "lead") return `/admin/leads/${id}/`;
  if (entity === "reusable") return `/admin/reusable/${id}/`;
  if (entity === "author") return `/admin/content/authors/${id}/`;
  return null;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("users");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: SQL[] = [];
  const area = AREAS.find((a) => a.value === sp.area && a.value);
  if (area?.entities) where.push(inArray(schema.activity.entity, area.entities));
  if (sp.user && /^[0-9a-f-]{36}$/.test(sp.user)) where.push(eq(schema.activity.userId, sp.user));
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+05:30`) : null);
  const from = day(sp.from);
  const to = day(sp.to);
  if (from) where.push(gte(schema.activity.createdAt, from));
  if (to) where.push(lt(schema.activity.createdAt, new Date(to.getTime() + 86_400_000)));
  const q = sp.q?.trim().slice(0, 80);
  if (q) where.push(ilike(schema.activity.summary, `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`));
  const cond = where.length ? and(...where) : undefined;

  const [rows, [{ n }], people] = await Promise.all([
    db
      .select({ id: schema.activity.id, action: schema.activity.action, entity: schema.activity.entity, entityId: schema.activity.entityId, summary: schema.activity.summary, createdAt: schema.activity.createdAt, name: schema.users.name })
      .from(schema.activity)
      .leftJoin(schema.users, eq(schema.users.id, schema.activity.userId))
      .where(cond)
      .orderBy(desc(schema.activity.createdAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ n: count() }).from(schema.activity).where(cond),
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).orderBy(asc(schema.users.name)),
  ]);
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  const link = (p: number) => `/admin/activity/?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")), page: String(p) } as Record<string, string>)}`;

  return (
    <>
      <PageHeader title="Activity log" description="Who changed what in the admin, newest first. Kept for reference; nothing here can be undone from this page (use a page’s version history for that)." />
      <form className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[12rem_12rem_9.5rem_9.5rem_minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-1 text-2xs">
          Area
          <Dropdown name="area" size="sm" defaultValue={sp.area ?? ""} options={AREAS.map(({ value, label }) => ({ value, label }))} aria-label="Area" />
        </label>
        <label className="grid gap-1 text-2xs">
          Person
          <Dropdown name="user" size="sm" defaultValue={sp.user ?? ""} options={[{ value: "", label: "Everyone" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} aria-label="Person" />
        </label>
        <label className="grid gap-1 text-2xs">
          From
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={`${inputCls} h-8`} />
        </label>
        <label className="grid gap-1 text-2xs">
          To
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={`${inputCls} h-8`} />
        </label>
        <label className="grid gap-1 text-2xs">
          Contains
          <input name="q" defaultValue={q ?? ""} placeholder="e.g. Contact" className={`${inputCls} h-8`} />
        </label>
        <div className="flex gap-3">
          <button className="h-8 border border-ink px-4 text-2xs">Filter</button>
          {Object.values(sp).some(Boolean) && (
            <Link href="/admin/activity/" className="self-center text-2xs underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Nothing matches these filters" />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((r) => {
            const href = itemHref(r.entity, r.entityId);
            return (
              <li key={r.id} className="flex min-w-0 flex-col gap-0.5 py-2.5 text-2xs sm:flex-row sm:justify-between sm:gap-4">
                <span className="min-w-0 break-words">
                  <strong className="font-medium">{r.name ?? "System"}: </strong>
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {r.summary}
                    </Link>
                  ) : (
                    r.summary
                  )}
                </span>
                <span className="shrink-0 text-muted tabular-nums">{r.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-2xs" aria-label="Pagination">
          {page > 1 ? <Link href={link(page - 1)}>← Newer</Link> : <span />}
          <span className="text-muted">
            Page {page} of {pages} · {n} entries
          </span>
          {page < pages ? <Link href={link(page + 1)}>Older →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
