import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { createPreview } from "@/server/previews";
import { diffVersions } from "@/server/revision-diff";
import { PageHeader } from "@/components/admin/ui";
import CompareView from "@/components/admin/CompareView";

export const dynamic = "force-dynamic";

const when = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Two saved versions side by side as real screens, with what changed between them. */
export default async function ComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string; type?: string }> }) {
  const user = await requireUser("content");
  const { id } = await params;
  const { a, b } = await searchParams;
  const uuid = /^[0-9a-f-]{36}$/;
  if (!uuid.test(id) || !a || !b || !uuid.test(a) || !uuid.test(b)) notFound();
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, id));
  if (!row) notFound();
  if (!can(user.role, "content.all") && (row.type !== "post" || row.authorId !== user.id)) notFound();

  const revs = await db
    .select()
    .from(schema.contentRevisions)
    .where(and(eq(schema.contentRevisions.contentId, id), inArray(schema.contentRevisions.id, [a, b])));
  const ra = revs.find((r) => r.id === a);
  const rb = revs.find((r) => r.id === b);
  if (!ra || !rb) notFound();
  // Older on the left, newer on the right.
  const [older, newer] = ra.createdAt <= rb.createdAt ? [ra, rb] : [rb, ra];
  const { fields, sections } = diffVersions(older.snapshot, newer.snapshot);
  const [po, pn] = await Promise.all(
    [older, newer].map((r) => createPreview({ contentId: id, data: { ...r.snapshot, type: row.type, updatedAt: r.createdAt.toISOString() }, userId: user.id })),
  );

  return (
    <>
      <PageHeader
        title="Compare versions"
        description={
          <Link href={`/admin/content/${id}/?type=${row.type}`} className="hover:underline">
            ← Back to “{row.title}”
          </Link>
        }
      />
      <CompareView
        contentId={id}
        type={row.type}
        older={{ revisionId: older.id, label: `Older: ${when(older.createdAt)}`, previewId: po.id }}
        newer={{ label: `Newer: ${when(newer.createdAt)}`, previewId: pn.id }}
        fields={fields}
        sections={sections}
      />
    </>
  );
}
