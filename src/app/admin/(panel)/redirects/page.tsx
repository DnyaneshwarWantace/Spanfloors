import { updateTag } from "next/cache";
import Dropdown from "@/components/ui/Dropdown";
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
  const user = await requireUser("redirects");
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
  const user = await requireUser("redirects");
  const id = String(form.get("id"));
  const [r] = await db.delete(schema.redirects).where(eq(schema.redirects.id, id)).returning();
  if (r) await logActivity(user.id, "delete", "redirect", id, `Removed redirect ${r.fromPath}`);
  updateTag("redirects");
  redirect("/admin/redirects/");
}

/** Bulk import: one redirect per line, "old,new" (CSV with or without a header row; tab also works). */
async function importRedirects(form: FormData) {
  "use server";
  const user = await requireUser("redirects");
  const file = form.get("file");
  const text = (file instanceof File && file.size ? await file.text() : String(form.get("csv") ?? "")).slice(0, 500_000);
  let added = 0;
  let skipped = 0;
  for (const line of text.split(/\r?\n/).slice(0, 5000)) {
    const [a, b] = line.split(/[,\t;]/).map((x) => x?.trim().replace(/^"|"$/g, "") ?? "");
    if (!a || !b || /^(from|old|source)/i.test(a)) continue;
    const from = normalizePath(a.replace(/^https?:\/\/[^/]+/i, ""));
    const to = cleanTarget(/^https?:\/\/(www\.)?spanfloors\.com/i.test(b) ? b.replace(/^https?:\/\/[^/]+/i, "") : b);
    if (from === "/" || !to || from === to) {
      skipped++;
      continue;
    }
    await db.insert(schema.redirects).values({ fromPath: from, toPath: to, note: "Imported" }).onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: to } });
    added++;
  }
  await logActivity(user.id, "create", "redirect", null, `Imported ${added} redirects`);
  updateTag("redirects");
  redirect(`/admin/redirects/?imported=${added}&skipped=${skipped}`);
}

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; imported?: string; skipped?: string }> }) {
  await requireUser("redirects");
  const sp = await searchParams;
  const rows = await db.select().from(schema.redirects).orderBy(desc(schema.redirects.createdAt));
  // Chains (A → B → C) slow visitors down and waste search-engine crawls; loops never arrive anywhere.
  const byFrom = new Map(rows.map((r) => [r.fromPath, r.toPath]));
  const problemOf = (from: string): { kind: "chain" | "loop"; end: string } | null => {
    let to = byFrom.get(from);
    const seen = new Set([from]);
    let hops = 0;
    while (to && byFrom.has(to)) {
      if (seen.has(to)) return { kind: "loop", end: to };
      seen.add(to);
      to = byFrom.get(to);
      hops++;
      if (hops > 10) return { kind: "loop", end: to ?? from };
    }
    return hops > 0 && to ? { kind: "chain", end: to } : null;
  };
  const problems = rows.map((r) => ({ id: r.id, p: problemOf(r.fromPath) })).filter((x) => x.p);
  const problemById = new Map(problems.map((x) => [x.id, x.p!]));

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Send an old URL to a new one, so links and search rankings keep working. Changing a page’s URL adds one automatically."
      />
      <div className="mb-4 grid gap-3">
        {sp.saved && <Notice tone="success">Redirect saved.</Notice>}
        {sp.error && <Notice tone="error">Enter an old URL and a different destination.</Notice>}
        {sp.imported && (
          <Notice tone="success">
            Imported {sp.imported} redirects{Number(sp.skipped) ? `; ${sp.skipped} lines were skipped (empty, or pointing to themselves)` : ""}.
          </Notice>
        )}
        {problems.length > 0 && (
          <Notice tone="error">
            {problems.length} redirect{problems.length === 1 ? " goes" : "s go"} through another redirect (or in a circle). Point each straight at its final page; they’re marked below.
          </Notice>
        )}
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
          <Dropdown
            name="permanent"
            defaultValue="permanent"
            aria-label="Redirect type"
            options={[
              { value: "permanent", label: "Permanent (301)", hint: "Moves rankings to the new URL" },
              { value: "temporary", label: "Temporary (302)", hint: "Short-term, keeps the old URL indexed" },
            ]}
          />
        </label>
        <button className={btn.primary}>Add redirect</button>
      </form>

      <details className="mb-8 border border-line bg-white/40 p-4">
        <summary className="cursor-pointer text-2xs font-medium">Import many redirects (CSV)</summary>
        <form action={importRedirects} className="mt-3 grid gap-3">
          <p className="text-2xs text-muted">One per line: old address, new address. For example: /old-page/,/new-page/. A header row and full https://www.spanfloors.com addresses are fine.</p>
          <textarea name="csv" rows={5} className={`${inputCls} h-auto py-2 font-mono text-2xs`} placeholder={"/old-page/,/new-page/\n/old-product/,/decking-collection/"} aria-label="Redirects, one per line" />
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".csv,text/csv,text/plain" className="text-2xs" aria-label="Or choose a CSV file" />
            <button className={btn.secondary}>Import</button>
          </div>
        </form>
      </details>

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
                  <td className="px-4 py-2.5 font-mono">
                    {r.toPath}
                    {problemById.get(r.id) && (
                      <div className="mt-1 font-sans text-brand">
                        {problemById.get(r.id)!.kind === "loop" ? "Goes round in a circle" : `Goes on to ${problemById.get(r.id)!.end}`}
                      </div>
                    )}
                  </td>
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
