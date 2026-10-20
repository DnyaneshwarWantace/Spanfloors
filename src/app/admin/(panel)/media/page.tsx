import MediaLibrary from "@/components/admin/MediaLibrary";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";

export default async function MediaPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Media library" description="Images, PDFs and videos used across the site. Imported files from the current website are included." />
      <MediaLibrary />
    </>
  );
}
