import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { EmptyState, formatDate, PageHeader } from "@/components/admin/ui";
import { sectionDef } from "@/sections/registry";
import { listReusable } from "../content/builder-actions";

export const dynamic = "force-dynamic";

export default async function ReusableList() {
  await requireUser("content.all");
  const items = await listReusable();
  // How many pages place each reusable section (one query for all of them).
  const usage = new Map<string, number>();
  if (items.length) {
    const rows = await db.execute<{ ref: string; n: number }>(sql`
      select s->'data'->>'ref' as ref, count(distinct c.id)::int as n
      from content c, jsonb_array_elements(c.layout) s
      where s->>'type' = 'reusable'
      group by 1`);
    for (const r of rows.rows) usage.set(r.ref, r.n);
  }

  return (
    <>
      <PageHeader title="Reusable sections" description="Sections saved once and placed on many pages. Change one here and every page that uses it updates." />
      {items.length === 0 ? (
        <EmptyState title="No reusable sections yet">Open any page, choose ⋯ on a section, then “Save as reusable”.</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[36rem] text-left text-2xs">
            <thead className="bg-paper-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Section type</th>
                <th className="px-4 py-2.5 font-medium">Used on</th>
                <th className="px-4 py-2.5 font-medium">Last changed</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/admin/reusable/${r.id}/`} className="text-body hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{sectionDef(r.type)?.label ?? r.type}</td>
                  <td className="px-4 py-3 tabular-nums">{usage.get(r.id) ?? 0} {(usage.get(r.id) ?? 0) === 1 ? "page" : "pages"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
