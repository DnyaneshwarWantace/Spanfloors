import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { normalizePath } from "@/server/html";
import { btn, EmptyState, formatDate, inputCls, Notice, PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

function cleanTarget(v: string) {
  const t = v.trim();
  return /^https?:\/\//.test(t) ? t : normalizePath(t);
}

async function addRedirect(form: FormData) {
  "use server";
  const user = await requireUser();
  const from = normalizePath(String(form.get("from") ?? ""));
  const to = cleanTarget(String(form.get("to") ?? ""));
  if (from === "/" || !to || from === to) redirect("/admin/redirects/?error=invalid");
  await db
    .insert(schema.redirects)
    .values({ fromPath: from, toPath: to, permanent: form.get("permanent") !== "temporary", note: String(form.get("note") ?? "").slice(0, 200) })
    .onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: to, permanent: form.get("permanent") !== "temporary" } });
  await logActivity(user.id, "create", "redirect", null, `Redirect ${from} → ${to}`);
  updateTag("redirects");
  redirect("/admin/redirects/?saved=1");
}

async function removeRedirect(form: FormData) {
  "use server";
  const user = await requireUser();
  const id = String(form.get("id"));
  const [r] = await db.delete(schema.redirects).where(eq(schema.redirects.id, id)).returning();
  if (r) await logActivity(user.id, "delete", "redirect", id, `Removed redirect ${r.fromPath}`);
  updateTag("redirects");
  redirect("/admin/redirects/");
}

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const rows = await db.select().from(schema.redirects).orderBy(desc(schema.redirects.createdAt));

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Send an old URL to a new one, so links and search rankings keep working. Changing a page’s URL adds one automatically."
      />
      <div className="mb-4 grid gap-3">
        {sp.saved && <Notice tone="success">Redirect saved.</Notice>}
        {sp.error && <Notice tone="error">Enter an old URL and a different destination.</Notice>}
      </div>

      <form action={addRedirect} className="mb-8 grid items-end gap-3 border border-line bg-white/40 p-4 md:grid-cols-[1fr_1fr_9rem_auto]">
        <label className="grid gap-1.5 text-2xs font-medium">
          Old URL
          <input name="from" required placeholder="/old-page/" className={`${inputCls} font-mono`} />
        </label>
        <label className="grid gap-1.5 text-2xs font-medium">
          Send visitors to
          <input name="to" required placeholder="/new-page/ or https://…" className={`${inputCls} font-mono`} />
        </label>
        <label className="grid gap-1.5 text-2xs font-medium">
          Type
          <select name="permanent" className={inputCls}>
            <option value="permanent">Permanent (301)</option>
            <option value="temporary">Temporary (302)</option>
          </select>
        </label>
        <button className={btn.primary}>Add redirect</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No redirects yet." />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[48rem] text-left text-2xs">
            <thead className="bg-paper-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">From</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Hits</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-mono">{r.fromPath}</td>
                  <td className="px-4 py-2.5 font-mono">{r.toPath}</td>
                  <td className="px-4 py-2.5">{r.permanent ? "301" : "302"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.hits}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {formatDate(r.createdAt)}
                    {r.note && <div>{r.note}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={removeRedirect}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-muted hover:text-brand">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
