import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { randomUUID } from "node:crypto";
import { listReusable } from "../builder-actions";
import { TEMPLATES, templateLayout } from "@/sections/templates";
import ContentForm from "@/components/admin/ContentForm";
import { PageHeader } from "@/components/admin/ui";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { can } from "@/lib/permissions";

export default async function NewContent({ searchParams }: { searchParams: Promise<{ type?: string; template?: string }> }) {
  const user = await requireUser("content");
  const sp = await searchParams;
  const type = sp.type === "page" ? "page" : "post";
  const template = type === "page" ? (TEMPLATES.find((t) => t.key === sp.template)?.key ?? null) : null;
  const reusable = await listReusable();
  if (type === "page" && !can(user.role, "content.all")) redirect("/admin/content/new/?type=post");
  return (
    <>
      <PageHeader
        title={type === "post" ? "New blog post" : "New page"}
        description={
          <Link href={`/admin/content/?type=${type}`} className="hover:underline">
            ← All {type === "post" ? "blog posts" : "pages"}
          </Link>
        }
      />
      {type === "page" && (
        <nav aria-label="Start from a template" className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {TEMPLATES.map((t) => (
            <Link
              key={t.key}
              href={`/admin/content/new/?type=page&template=${t.key}`}
              aria-current={(template ?? "blank") === t.key ? "true" : undefined}
              className="min-w-0 border border-line bg-white/40 p-3 hover:border-ink aria-[current=true]:border-ink aria-[current=true]:bg-white"
            >
              <span className="block text-body">{t.label}</span>
              <span className="mt-0.5 block text-2xs text-muted">{t.description}</span>
            </Link>
          ))}
        </nav>
      )}
      <ContentForm
        key={template ?? "blank"}
        reusable={reusable}
        canReuse={can(user.role, "content.all")}
        canPublish={can(user.role, "content.publish")}
        initial={{
          id: null,
          type,
          title: "",
          path: "",
          body: "",
          excerpt: "",
          status: "draft",
          publishedAt: null,
          featured: null,
          seoTitle: "",
          seoDescription: "",
          robots: "",
          canonicalUrl: "",
          tags: [],
          updatedAt: null,
          layout: template ? templateLayout(template, randomUUID) : [],
          authorName: null,
          authorChoices: type === "post" ? (await db.select({ name: schema.authors.name }).from(schema.authors).orderBy(asc(schema.authors.name))).map((a) => a.name) : [],
        }}
      />
    </>
  );
}
