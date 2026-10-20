import Link from "next/link";
import { count, desc, eq, and, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { btn, Card, formatDate, PageHeader } from "@/components/admin/ui";

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

  const startOfDay = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30");
  const [[{ n: leadsToday }], [{ n: leadsNew }], [{ n: notInTwenty }]] = await Promise.all([
    db.select({ n: count() }).from(schema.leads).where(gte(schema.leads.createdAt, startOfDay)),
    db.select({ n: count() }).from(schema.leads).where(eq(schema.leads.status, "new")),
    db.select({ n: count() }).from(schema.leads).where(inArray(schema.leads.twentyStatus, ["pending", "failed"])),
  ]);

  const stats = [
    { label: "Form leads today", value: leadsToday, note: `${leadsNew} new in total`, href: "/admin/leads/?status=new" },
    { label: "Blog posts", value: postsLive, note: `${postsDraft} drafts`, href: "/admin/content/?type=post" },
    { label: "Pages", value: pagesLive, note: `${pagesDraft} drafts`, href: "/admin/content/?type=page" },
    { label: "Media files", value: mediaCount, href: "/admin/media/" },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Manage the Span Floors website."
        actions={
          <>
            <Link href="/admin/content/new/?type=post" className={btn.primary}>
              New blog post
            </Link>
            <Link href="/admin/content/new/?type=page" className={btn.secondary}>
              New page
            </Link>
          </>
        }
      />

      {denied && <p className="mb-6 border border-brand/40 bg-brand/5 px-4 py-3 text-2xs">That section needs an admin account.</p>}

      {notInTwenty > 0 && (
        <Link href="/admin/leads/" className="mb-6 block border border-[#a0661f]/40 bg-[#a0661f]/8 px-4 py-3 text-2xs">
          <strong className="font-medium">{notInTwenty} lead{notInTwenty === 1 ? "" : "s"} not in Twenty yet</strong> — saved here and retrying automatically. View leads →
        </Link>
      )}

      <div className="grid gap-6 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group border-l border-line pl-3">
            <div className="text-2xs text-muted">{s.label}</div>
            <div className="mt-1 text-display leading-none tabular-nums group-hover:underline">{s.value}</div>
            {s.note && <div className="mt-1.5 text-2xs text-muted">{s.note}</div>}
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card title="Recently edited">
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-2.5 text-2xs">
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
        <Card title="Activity">
          {activity.length ? (
            <ul className="divide-y divide-line">
              {activity.map((a, i) => (
                <li key={i} className="flex justify-between gap-4 py-2.5 text-2xs">
                  <span>
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
    </>
  );
}
