import Link from "next/link";
import { count, desc, eq, and, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { btn, Card, formatDate, PageHeader } from "@/components/admin/ui";
import { can } from "@/lib/permissions";
import { siteHealth } from "@/server/seo-audit";
import { adminTodos, type Todo } from "@/server/todos";

export const dynamic = "force-dynamic";

async function countWhere(type: "post" | "page", status: "published" | "draft") {
  const [r] = await db
    .select({ n: count() })
    .from(schema.content)
    .where(and(eq(schema.content.type, type), eq(schema.content.status, status)));
  return r.n;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const [postsLive, postsDraft, pagesLive, pagesDraft, [{ n: mediaCount }], recent, activity] = await Promise.all([
    countWhere("post", "published"),
    countWhere("post", "draft"),
    countWhere("page", "published"),
    countWhere("page", "draft"),
    db.select({ n: count() }).from(schema.media),
    db
      .select({ id: schema.content.id, title: schema.content.title, type: schema.content.type, status: schema.content.status, updatedAt: schema.content.updatedAt })
      .from(schema.content)
      .orderBy(desc(schema.content.updatedAt))
      .limit(6),
    db
      .select({ summary: schema.activity.summary, createdAt: schema.activity.createdAt, name: schema.users.name })
      .from(schema.activity)
      .leftJoin(schema.users, eq(schema.users.id, schema.activity.userId))
      .orderBy(desc(schema.activity.createdAt))
      .limit(8),
  ]);

  const seeLeads = can(user.role, "leads");
  const seeContent = can(user.role, "content");
  const seeAll = can(user.role, "content.all");
  const startOfDay = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30");
  const [[{ n: leadsToday }], [{ n: leadsNew }]] = await Promise.all([
    db.select({ n: count() }).from(schema.leads).where(gte(schema.leads.createdAt, startOfDay)),
    db.select({ n: count() }).from(schema.leads).where(eq(schema.leads.status, "new")),
  ]);

  const [todos, health] = await Promise.all([adminTodos(user), seeAll ? siteHealth().catch(() => null) : Promise.resolve(null)]);
  const KIND: Record<Todo["kind"], { label: string; dot: string }> = {
    now: { label: "Waiting", dot: "bg-brand" },
    fix: { label: "Fix", dot: "bg-[#a0661f]" },
    setup: { label: "Set up", dot: "bg-[#3b5f8a]" },
    tidy: { label: "When you have time", dot: "bg-muted" },
  };

  type Stat = { label: string; value: number | string; note?: string; href: string };
  const stats = ([
    seeLeads && { label: "Form leads today", value: leadsToday, note: `${leadsNew} new in total`, href: "/admin/leads/?status=new" },
    seeContent && { label: "Blog posts", value: postsLive, note: `${postsDraft} drafts`, href: "/admin/content/?type=post" },
    seeAll && { label: "Pages", value: pagesLive, note: `${pagesDraft} drafts`, href: "/admin/content/?type=page" },
    can(user.role, "media") && { label: "Media files", value: mediaCount, href: "/admin/media/" },
    health && { label: "Google score", value: `${health.seoAverage}/100`, note: `average of ${health.pages} pages`, href: "/admin/seo/" },
  ] as (Stat | false | null)[]).filter((x): x is Stat => Boolean(x));

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Here is what needs doing on the website today."
        actions={
          seeContent && (
            <>
              <Link href="/admin/content/new/?type=post" className={btn.primary}>
                New blog post
              </Link>
              {seeAll && (
                <Link href="/admin/content/new/?type=page" className={btn.secondary}>
                  New page
                </Link>
              )}
            </>
          )
        }
      />

      {denied && <p className="mb-6 border border-brand/40 bg-brand/5 px-4 py-3 text-2xs">Your account doesn’t have access to that section. Ask an admin if you need it.</p>}

      <section className="mb-10" aria-labelledby="todo-h">
        <h2 id="todo-h" className="mb-3 text-title">To do</h2>
        {todos.length === 0 ? (
          <p className="border border-line bg-white/40 px-4 py-5 text-body">All done. Nothing needs your attention right now. ✓</p>
        ) : (
          <ul className="divide-y divide-line border border-line bg-white/40">
            {todos.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${KIND[t.kind].dot}`} />
                  <div className="min-w-0">
                    <div className="text-body">
                      <span className="sr-only">{KIND[t.kind].label}: </span>
                      {t.title}
                    </div>
                    {t.detail && <div className="mt-0.5 text-2xs text-muted">{t.detail}</div>}
                  </div>
                </div>
                <Link href={t.href} className={`${t.kind === "now" ? btn.primary : btn.secondary} shrink-0 self-start sm:self-center`}>
                  {t.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group border-l border-line pl-3">
            <div className="text-2xs text-muted">{s.label}</div>
            <div className="mt-1 text-display leading-none tabular-nums group-hover:underline">{s.value}</div>
            {s.note && <div className="mt-1.5 text-2xs text-muted">{s.note}</div>}
          </Link>
        ))}
      </div>

      {seeAll && (
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card title="Recently edited">
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id} className="flex min-w-0 flex-col gap-0.5 py-2.5 text-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <Link href={`/admin/content/${r.id}/?type=${r.type}`} className="min-w-0 truncate text-body hover:underline">
                  {r.title}
                </Link>
                <span className="shrink-0 text-muted">
                  {r.type === "post" ? "Post" : "Page"} · {r.status} · {formatDate(r.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Activity" actions={can(user.role, "users") ? <Link href="/admin/activity/" className="text-2xs underline">See all</Link> : undefined}>
          {activity.length ? (
            <ul className="divide-y divide-line">
              {activity.map((a, i) => (
                <li key={i} className="flex min-w-0 flex-col gap-0.5 py-2.5 text-2xs sm:flex-row sm:justify-between sm:gap-4">

                  <span className="min-w-0 break-words">
                    {a.name && <strong className="font-medium">{a.name}: </strong>}
                    {a.summary}
                  </span>
                  <span className="shrink-0 text-muted">{formatDate(a.createdAt, true)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-muted">No activity yet.</p>
          )}
        </Card>
      </div>
      )}
    </>
  );
}
