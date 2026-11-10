import MediaLibrary from "@/components/admin/MediaLibrary";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  await requireUser("media");
  const { q, filter } = await searchParams;
  const initialFilter = (["unused", "missing", "noalt", "placeholder"] as const).find((f) => f === filter) ?? "all";
  return (
    <>
      <PageHeader title="Media library" description="Images, PDFs and videos used across the site. Imported files from the current website are included." />
      <MediaLibrary key={`${q ?? ""}|${initialFilter}`} initialQuery={q?.slice(0, 120) ?? ""} initialFilter={initialFilter} />
    </>
  );
}
