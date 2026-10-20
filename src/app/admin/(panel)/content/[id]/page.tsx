import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import ContentForm from "@/components/admin/ContentForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { btn, Notice, PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { mediaUrl } from "@/server/storage";
import { deleteContent, duplicateContent } from "../actions";

export default async function EditContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, id));
  if (!row) notFound();
  const [featured] = row.featuredMediaId
    ? await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(eq(schema.media.id, row.featuredMediaId))
    : [];
  const { created } = await searchParams;
  const label = row.type === "post" ? "blog post" : "page";

  return (
    <>
      <PageHeader
        title={`Edit ${label}`}
        description={
          <Link href={`/admin/content/?type=${row.type}`} className="hover:underline">
            ← All {row.type === "post" ? "blog posts" : "pages"}
          </Link>
        }
        actions={
          <>
            <form action={duplicateContent}>
              <input type="hidden" name="id" value={row.id} />
              <button className={btn.ghost}>Duplicate</button>
            </form>
            <ConfirmButton action={deleteContent} id={row.id} label="Delete" confirmLabel={`Delete this ${label}?`} />
          </>
        }
      />
      {created && (
        <div className="mb-5">
          <Notice tone="success">Created. Set the status to Published when it’s ready to go live.</Notice>
        </div>
      )}
      {row.status === "archived" && row.legacyWpId && (
        <div className="mb-5">
          <Notice>
            Imported from the old website and archived: this URL is now served by the live product catalogue (Twenty), so this copy isn’t shown.
          </Notice>
        </div>
      )}
      <ContentForm
        initial={{
          id: row.id,
          type: row.type,
          title: row.title,
          path: row.path,
          body: row.body,
          excerpt: row.excerpt,
          status: row.status,
          publishedAt: row.publishedAt?.toISOString() ?? null,
          featured: featured ? { id: featured.id, url: mediaUrl(featured.path) } : null,
          seoTitle: row.seoTitle ?? "",
          seoDescription: row.seoDescription ?? "",
          robots: row.robots ?? "",
          canonicalUrl: row.canonicalUrl ?? "",
          tags: row.tags,
          updatedAt: row.updatedAt.toISOString(),
        }}
      />
    </>
  );
}
