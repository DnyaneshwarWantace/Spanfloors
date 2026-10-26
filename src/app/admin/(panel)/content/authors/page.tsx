import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { btn, Notice, PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireUser("content.all");
  const sp = await searchParams;
  const [rows, counts] = await Promise.all([
    db.select().from(schema.authors).orderBy(asc(schema.authors.name)),
    db.execute<{ name: string; n: number }>(sql`select author_name as name, count(*)::int as n from content where type = 'post' and author_name is not null group by 1`).then((r) => r.rows),
  ]);
  const n = (name: string) => counts.find((c) => c.name === name)?.n ?? 0;
  const missing = counts.filter((c) => !rows.some((r) => r.name === c.name));
  return (
    <>
      <PageHeader
        title="Blog authors"
        description="A named author with a photo and short bio helps readers and Google trust the articles. Each author also gets a page listing their posts."
        actions={
          <Link href="/admin/content/authors/new/" className={btn.primary}>
            Add author
          </Link>
        }
      />
      {sp.saved && (
        <div className="mb-4">
          <Notice tone="success">Author saved.</Notice>
        </div>
      )}
      {missing.length > 0 && (
        <div className="mb-4">
          <Notice>Posts are signed by {missing.map((m) => `“${m.name}”`).join(", ")} without a profile. Add one with exactly that name.</Notice>
        </div>
      )}
      <ul className="grid gap-2">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-white/40 px-4 py-3">
            <div>
              <Link href={`/admin/content/authors/${a.id}/`} className="text-body hover:underline">
                {a.name}
              </Link>
              <div className="text-2xs text-muted">
                {a.jobTitle || "No job title yet"} · {n(a.name)} posts · /blog/author/{a.slug}/
              </div>
            </div>
            {!a.bio && <span className="text-2xs text-[#a0661f]">Add a bio and photo</span>}
          </li>
        ))}
      </ul>
    </>
  );
}
