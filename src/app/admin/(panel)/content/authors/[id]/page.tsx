import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { mediaUrl } from "@/server/storage";
import { Notice, PageHeader } from "@/components/admin/ui";
import AuthorForm from "@/components/admin/AuthorForm";

export const dynamic = "force-dynamic";

export default async function EditAuthor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireUser("content.all");
  const { id } = await params;
  const { error } = await searchParams;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [a] = isNew ? [null] : await db.select().from(schema.authors).where(eq(schema.authors.id, id));
  if (!isNew && !a) notFound();
  const [photo] = a?.photoMediaId ? await db.select({ path: schema.media.path }).from(schema.media).where(eq(schema.media.id, a.photoMediaId)) : [];
  return (
    <>
      <PageHeader
        title={a ? a.name : "New author"}
        description={
          <Link href="/admin/content/authors/" className="hover:underline">
            ← All authors
          </Link>
        }
      />
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error === "taken" ? "Another author already has that name or address." : "Add a name."}</Notice>
        </div>
      )}
      <AuthorForm
        initial={{
          id: a?.id ?? "",
          name: a?.name ?? "",
          slug: a?.slug ?? "",
          jobTitle: a?.jobTitle ?? "",
          bio: a?.bio ?? "",
          links: a?.links.join("\n") ?? "",
          photo: a?.photoMediaId && photo ? { id: a.photoMediaId, url: mediaUrl(photo.path) } : null,
        }}
      />
    </>
  );
}
