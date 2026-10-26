import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import ReusableForm from "@/components/admin/builder/ReusableForm";
import { listReusable, reusableUsage } from "../../content/builder-actions";

export const dynamic = "force-dynamic";

export default async function EditReusable({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("content.all");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const item = (await listReusable()).find((r) => r.id === id);
  if (!item) notFound();
  const used = await reusableUsage(id);

  return (
    <>
      <PageHeader
        title={item.name}
        description={
          <Link href="/admin/reusable/" className="hover:underline">
            ← All reusable sections
          </Link>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ReusableForm item={item} usedOn={used.length} />
        <aside className="min-w-0 border border-line bg-white/40 p-4">
          <h2 className="mb-3 text-2xs font-semibold tracking-[0.06em] uppercase">Used on</h2>
          {used.length ? (
            <ul className="grid gap-2 text-2xs">
              {used.map((u) => (
                <li key={u.id} className="min-w-0">
                  <Link href={`/admin/content/${u.id}/?type=${u.type}`} className="block truncate hover:underline">
                    {u.title}
                  </Link>
                  <span className="block truncate font-mono text-muted">{u.path}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-muted">Not placed on any page yet.</p>
          )}
        </aside>
      </div>
    </>
  );
}
