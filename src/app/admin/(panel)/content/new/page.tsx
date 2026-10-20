import Link from "next/link";
import ContentForm from "@/components/admin/ContentForm";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";

export default async function NewContent({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireUser();
  const type = (await searchParams).type === "page" ? "page" : "post";
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
      <ContentForm
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
        }}
      />
    </>
  );
}
