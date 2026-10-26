import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { getPreview, previewView } from "@/server/previews";
import ContentView from "@/views/ContentView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ frame?: string }> };

export const metadata: Metadata = {
  title: { absolute: "Preview · Span Floors" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * A page or post as it will look, from unsaved changes or an old version. Signed-in editors can open any
 * preview; a shared preview link opens for anyone until it expires. Never indexed.
 */
export default async function PreviewPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { frame } = await searchParams;
  const row = await getPreview(token);
  if (!row) notFound();
  if (!row.shared) {
    const user = await currentUser();
    if (!user || !can(user.role, "content")) notFound();
  }
  const { c, path } = await previewView(row.data);
  return (
    <>
      {frame !== "1" && (
        <div role="status" className="sticky top-[var(--spacing-header)] z-40 flex flex-wrap items-center justify-between gap-2 bg-sand px-gap py-2 text-2xs text-ink">
          <span>
            <b>Preview</b>, not live yet · {path}
          </span>
          <span className="opacity-75">
            Link expires {row.expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
          </span>
        </div>
      )}
      <ContentView c={c} path={path} preview />
    </>
  );
}
