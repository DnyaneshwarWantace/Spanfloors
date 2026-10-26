import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import ContentForm from "@/components/admin/ContentForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { btn, Notice, PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { mediaUrl, resolveStored } from "@/server/storage";
import { existsSync } from "node:fs";
import { deleteContent, duplicateContent } from "../actions";
import { listReusable } from "../builder-actions";
import type { Section } from "@/sections/types";
import { cleanAeo } from "@/server/aeo";

export default async function EditContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser("content");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db.select().from(schema.content).where(eq(schema.content.id, id));
  if (!row) notFound();
  // Authors only open their own blog posts.
  if (!can(user.role, "content.all") && (row.type !== "post" || row.authorId !== user.id || row.systemKey)) notFound();
  const [ogImg] = row.ogImageMediaId
    ? await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(eq(schema.media.id, row.ogImageMediaId))
    : [];
  const [featured] = row.featuredMediaId
    ? await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(eq(schema.media.id, row.featuredMediaId))
    : [];
  const { created } = await searchParams;
  const reusable = await listReusable();
  const authorChoices = row.type === "post" ? (await db.select({ name: schema.authors.name }).from(schema.authors).orderBy(asc(schema.authors.name))).map((a) => a.name) : [];
  const relatedRows = row.relatedIds.length ? await db.select({ id: schema.content.id, title: schema.content.title }).from(schema.content).where(inArray(schema.content.id, row.relatedIds)) : [];
  const related = row.relatedIds.flatMap((rid) => relatedRows.filter((r) => r.id === rid));
  // Images in the body whose files haven't been imported yet (the editor shows a placeholder instead).
  const missingImages = [...new Set([...row.body.matchAll(/src="(\/media\/[^"]+)"/g)].map((m) => m[1]))].filter((src) => {
    const full = resolveStored(decodeURIComponent(src.replace(/^\/media\//, "")));
    return !full || !existsSync(full);
  });
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
          !row.systemKey && (
          <>
            <form action={duplicateContent}>
              <input type="hidden" name="id" value={row.id} />
              <button className={btn.ghost}>Duplicate</button>
            </form>
            <ConfirmButton action={deleteContent} id={row.id} label="Delete" confirmLabel={`Delete this ${label}?`} />
          </>
          )
        }
      />
      {created && (
        <div className="mb-5">
          <Notice tone="success">Created. Set the status to Published when it’s ready to go live.</Notice>
        </div>
      )}
      {row.status === "archived" && row.legacyWpId && !row.systemKey && (
        <div className="mb-5">
          <Notice>
            Imported from the old website and archived: this URL is now served by the live product catalogue (Twenty), so this copy isn’t shown.
          </Notice>
        </div>
      )}
      <ContentForm
        canPublish={can(user.role, "content.publish")}
        reusable={reusable}
        canReuse={can(user.role, "content.all")}
        missingImages={missingImages}
        initial={{
          id: row.id,
          type: row.type,
          title: row.title,
          path: row.path,
          body: row.body,
          excerpt: row.excerpt,
          status: row.status,
          publishedAt: row.publishedAt?.toISOString() ?? null,
          unpublishAt: row.unpublishAt?.toISOString() ?? null,
          featured: featured
            ? {
                id: featured.id,
                url: mediaUrl(featured.path),
                available: (() => {
                  const full = resolveStored(featured.path);
                  return Boolean(full && existsSync(full));
                })(),
              }
            : null,
          seoTitle: row.seoTitle ?? "",
          seoDescription: row.seoDescription ?? "",
          robots: row.robots ?? "",
          canonicalUrl: row.canonicalUrl ?? "",
          tags: row.tags,
          updatedAt: row.updatedAt.toISOString(),
          layout: (Array.isArray(row.layout) ? row.layout : []) as Section[],
          focusKeyword: row.focusKeyword ?? "",
          ogTitle: row.ogTitle ?? "",
          ogDescription: row.ogDescription ?? "",
          ogImage: ogImg ? { id: ogImg.id, url: mediaUrl(ogImg.path) } : null,
          schemaType: row.schemaType ?? "",
          aeo: cleanAeo(row.aeo),
          systemKey: row.systemKey,
          authorName: row.authorName,
          authorChoices,
          related,
        }}
      />
    </>
  );
}
