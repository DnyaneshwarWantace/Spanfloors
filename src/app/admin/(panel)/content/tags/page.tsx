import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { btn, EmptyState, inputCls, Notice, PageHeader } from "@/components/admin/ui";
import { removeTag, renameTag } from "../blog-actions";

export const dynamic = "force-dynamic";

export default async function TagsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireUser("content.all");
  const sp = await searchParams;
  const rows = (
    await db.execute<{ tag: string; n: number }>(sql`select t as tag, count(*)::int as n from content, unnest(tags) t where type = 'post' group by t order by count(*) desc, t`)
  ).rows;
  return (
    <>
      <PageHeader title="Blog tags" description="Topics on blog posts. Rename a tag to fix it everywhere; rename it to an existing tag to merge the two." />
      <div className="mb-4 grid gap-2">
        {sp.done && <Notice tone="success">{sp.done}</Notice>}
        {sp.error && <Notice tone="error">Enter a different new name.</Notice>}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No tags yet" />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[42rem] text-left text-2xs">
            <thead className="bg-paper-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Tag</th>
                <th className="px-4 py-2.5 font-medium">Posts</th>
                <th className="px-4 py-2.5 font-medium">Rename or merge into</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tag} className="border-t border-line align-top">
                  <td className="px-4 py-3 text-body">
                    <a href={`/blog/?tag=${encodeURIComponent(r.tag)}`} target="_blank" className="hover:underline">
                      {r.tag}
                    </a>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.n}</td>
                  <td className="px-4 py-3">
                    <form action={renameTag} className="flex gap-2">
                      <input type="hidden" name="from" value={r.tag} />
                      <input name="to" required maxLength={60} placeholder="New name" aria-label={`Rename ${r.tag}`} className={`${inputCls} h-8 min-w-0`} />
                      <button className={`${btn.secondary} h-8`}>Rename</button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={removeTag}>
                      <input type="hidden" name="tag" value={r.tag} />
                      <button className="text-muted hover:text-brand">Remove from posts</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
