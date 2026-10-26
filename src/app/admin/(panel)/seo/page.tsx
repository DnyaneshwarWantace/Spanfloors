import Link from "next/link";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { normalizePath } from "@/server/html";
import { notFoundList, scanBrokenLinks, seoOverview } from "@/server/seo-audit";
import { NOINDEX_SITE } from "@/server/metadata";
import { EmptyState, formatDate, inputCls, Notice, PageHeader, btn } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Pages and scores" },
  { key: "404", label: "Not found (404)" },
  { key: "links", label: "Broken links" },
] as const;

async function redirect404(form: FormData) {
  "use server";
  const user = await requireUser("redirects");
  const from = normalizePath(String(form.get("from") ?? ""));
  const raw = String(form.get("to") ?? "").trim();
  const to = /^https?:\/\//.test(raw) ? raw : normalizePath(raw);
  if (from === "/" || !raw || from === to) redirect("/admin/seo/?tab=404&error=1");
  await db.insert(schema.redirects).values({ fromPath: from, toPath: to, note: "From the 404 log" }).onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: to } });
  await db.delete(schema.notFoundLog).where(eq(schema.notFoundLog.path, String(form.get("from"))));
  await logActivity(user.id, "create", "redirect", null, `Redirect ${from} → ${to} (from the 404 log)`);
  updateTag("redirects");
  redirect("/admin/seo/?tab=404&saved=1");
}

async function ignore404(form: FormData) {
  "use server";
  await requireUser("redirects");
  await db.update(schema.notFoundLog).set({ ignored: true }).where(eq(schema.notFoundLog.path, String(form.get("path"))));
  redirect("/admin/seo/?tab=404");
}

const scoreTone = (n: number) => (n >= 80 ? "text-[#2f6339]" : n >= 55 ? "text-[#a0661f]" : "text-brand");

export default async function SeoPage({ searchParams }: { searchParams: Promise<{ tab?: string; saved?: string; error?: string; filter?: string }> }) {
  await requireUser("content.all");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "overview";

  return (
    <>
      <PageHeader title="SEO" description="How every page does in search, the addresses visitors couldn't find, and links that point nowhere." />
      {NOINDEX_SITE && (
        <div className="mb-4">
          <Notice>This copy of the site isn’t on spanfloors.com, so search engines are told to stay out (staging). The live site is indexed normally.</Notice>
        </div>
      )}
      <nav className="mb-6 flex flex-wrap gap-1" aria-label="SEO sections">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/seo/?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined} className="border border-line px-3 py-1.5 text-2xs aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper">
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "overview" && <Overview filter={sp.filter} />}
      {tab === "404" && <NotFound saved={Boolean(sp.saved)} error={Boolean(sp.error)} />}
      {tab === "links" && <Links />}
    </>
  );
}

async function Overview({ filter }: { filter?: string }) {
  const rows = await seoOverview();
  const problem = (id: string) => rows.filter((r) => r.report.checks.some((c) => c.id === id && c.status !== "good")).length;
  const summary = [
    { id: "description", label: "No or weak meta description" },
    { id: "title", label: "Title too short or long" },
    { id: "dup-title", label: "Duplicate search title" },
    { id: "dup-desc", label: "Duplicate description" },
    { id: "alt", label: "Photos without description" },
    { id: "noindex", label: "Hidden from Google" },
  ];
  const shown = filter ? rows.filter((r) => r.report.checks.some((c) => c.id === filter && c.status !== "good")) : rows;
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.report.score, 0) / rows.length) : 0;
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="border-l border-line pl-3">
          <div className="text-2xs text-muted">Average score</div>
          <div className={`mt-1 text-display leading-none tabular-nums ${scoreTone(avg)}`}>{avg}</div>
          <div className="mt-1 text-2xs text-muted">{rows.length} live pages and posts</div>
        </div>
        {summary.slice(0, 3).map((s) => (
          <Link key={s.id} href={`/admin/seo/?tab=overview&filter=${s.id}`} className="group border-l border-line pl-3">
            <div className="text-2xs text-muted">{s.label}</div>
            <div className="mt-1 text-display leading-none tabular-nums group-hover:underline">{problem(s.id)}</div>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 text-2xs">
        <span className="py-1.5 text-muted">Show only:</span>
        {summary.map((s) => (
          <Link key={s.id} href={filter === s.id ? "/admin/seo/?tab=overview" : `/admin/seo/?tab=overview&filter=${s.id}`} aria-current={filter === s.id ? "true" : undefined} className="border border-line px-2.5 py-1 aria-[current=true]:border-ink aria-[current=true]:bg-ink aria-[current=true]:text-paper">
            {s.label} ({problem(s.id)})
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[46rem] text-left text-2xs">
          <thead className="bg-paper-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 font-medium">Page</th>
              <th className="px-4 py-2.5 font-medium">Most important fix</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const top = r.report.checks.find((c) => c.status !== "good");
              return (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className={`px-4 py-3 text-body tabular-nums ${scoreTone(r.report.score)}`}>{r.report.score}</td>
                  <td className="max-w-80 px-4 py-3">
                    <Link href={`/admin/content/${r.id}/?type=${r.type}`} className="block truncate text-body hover:underline">
                      {r.title}
                    </Link>
                    <span className="block truncate font-mono text-muted">{r.path}</span>
                  </td>
                  <td className="px-4 py-3">{top ? top.text : <span className="text-muted">Nothing to fix.</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function NotFound({ saved, error }: { saved: boolean; error: boolean }) {
  const rows = await notFoundList();
  return (
    <div className="grid gap-4">
      {saved && <Notice tone="success">Redirect added. Visitors to that address now reach the new page.</Notice>}
      {error && <Notice tone="error">Enter where that address should go.</Notice>}
      <p className="text-2xs text-muted">Addresses on this site that visitors or search engines asked for and didn’t find. Send each one to the right page with a redirect, or ignore it. Hit counts are approximate.</p>
      {rows.length === 0 ? (
        <EmptyState title="No missing pages logged">Addresses that return “not found” appear here.</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[52rem] text-left text-2xs">
            <thead className="bg-paper-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Address</th>
                <th className="px-4 py-2.5 font-medium">Hits</th>
                <th className="px-4 py-2.5 font-medium">Last seen</th>
                <th className="px-4 py-2.5 font-medium">Send to</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path} className="border-t border-line align-top">
                  <td className="max-w-72 px-4 py-3 font-mono break-all">{r.path}</td>
                  <td className="px-4 py-3 tabular-nums">{r.hits}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(r.lastSeen, true)}</td>
                  <td className="px-4 py-3">
                    <form action={redirect404} className="flex gap-2">
                      <input type="hidden" name="from" value={r.path} />
                      <input name="to" required placeholder="/new-page/" aria-label={`Redirect ${r.path} to`} className={`${inputCls} h-8 min-w-0 font-mono text-2xs`} />
                      <button className={`${btn.secondary} h-8`}>Redirect</button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form action={ignore404}>
                      <input type="hidden" name="path" value={r.path} />
                      <button className={btn.ghost}>Ignore</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function Links() {
  const rows = await scanBrokenLinks();
  const missing = rows.filter((r) => r.problem === "missing");
  return (
    <div className="grid gap-4">
      <p className="text-2xs text-muted">
        Links inside live pages and posts that point to a page or file that doesn’t exist ({missing.length}), or to an old address that redirects ({rows.length - missing.length}). Fix them in the page so visitors and Google go straight to the right place.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No broken links found" />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[46rem] text-left text-2xs">
            <thead className="bg-paper-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">On page</th>
                <th className="px-4 py-2.5 font-medium">Link</th>
                <th className="px-4 py-2.5 font-medium">Problem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.pageId}-${r.href}-${i}`} className="border-t border-line align-top">
                  <td className="max-w-64 px-4 py-3">
                    <Link href={`/admin/content/${r.pageId}/?type=${r.pageType}`} className="block truncate hover:underline">
                      {r.pageTitle}
                    </Link>
                  </td>
                  <td className="max-w-80 px-4 py-3 font-mono break-all">{r.href}</td>
                  <td className="px-4 py-3">{r.problem === "missing" ? <span className="text-brand">Page or file not found</span> : <span className="text-[#a0661f]">Redirects to {r.target}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
