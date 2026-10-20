import RefreshButton from "@/components/admin/RefreshButton";
import { requireUser } from "@/server/auth";
import AdminProducts, { type AdminRow } from "@/components/admin/AdminProducts";
import { CATEGORIES, getAdminProducts, legacyProductMap } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const FIELDS: { key: string; label: string; has: (p: AdminRow) => boolean }[] = [
  { key: "image", label: "Displayable image", has: (p) => p.images.length > 0 },
  { key: "imageId", label: "Image ID", has: (p) => Boolean(p.imageId) },
  { key: "dimensions", label: "Dimensions", has: (p) => Boolean(p.dimensions) },
  { key: "brand", label: "Brand", has: (p) => Boolean(p.brand) },
  { key: "collection", label: "Colour tone", has: (p) => Boolean(p.collection) },
  { key: "grade", label: "Grade", has: (p) => p.grade.length > 0 },
  { key: "construction", label: "Construction", has: (p) => p.construction.length > 0 },
  { key: "installation", label: "Installation", has: (p) => p.installation.length > 0 },
  { key: "box", label: "Coverage per box", has: (p) => p.areaPerBoxSqft != null },
  { key: "variants", label: "Linked sizes / formats", has: (p) => p.variants.length > 0 },
  { key: "spec", label: "Description", has: (p) => Boolean(p.specification) },
];

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="border-l border-line pl-3">
      <div className="text-2xs text-muted">{label}</div>
      <div className="mt-1 text-display leading-none tabular-nums">{value}</div>
      {note && <div className="mt-1.5 text-2xs text-muted">{note}</div>}
    </div>
  );
}

function Bars({ rows, total, unit }: { rows: { label: string; value: number }[]; total: number; unit: "count" | "percent" }) {
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => {
        const pct = total ? (r.value / total) * 100 : 0;
        const shown = unit === "percent" ? `${Math.round(pct)}%` : String(r.value);
        return (
          <li key={r.label} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3 text-2xs" title={`${r.label}: ${r.value} of ${total}`}>
            <span className="truncate">{r.label}</span>
            <span className="h-2 rounded-r-[4px] bg-paper-2">
              <span className="block h-full rounded-r-[4px] bg-ink-2" style={{ width: `${Math.max(pct, r.value ? 1 : 0)}%` }} />
            </span>
            <span className="text-right tabular-nums text-muted">{shown}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function AdminPage() {
  await requireUser();
  let rows: AdminRow[] = [];
  let urls: Awaited<ReturnType<typeof legacyProductMap>> = [];
  let error: string | null = null;
  try {
    [rows, urls] = await Promise.all([getAdminProducts(), legacyProductMap()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const live = rows.filter((r) => r.live);
  const hidden = rows.length - live.length;
  const withImage = live.filter((r) => r.images.length).length;
  const sameUrls = urls.filter((u) => u.outcome === "same").length;
  const redirected = urls.length - sameUrls;
  const now = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

  return (
    <div>
      <header className="sticky top-0 z-20 -mx-6 mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-paper/90 px-6 py-4 backdrop-blur lg:-mx-10 lg:px-10">
        <div>
          <h1 className="mono text-title">Products from Twenty</h1>
          <p className="mt-1 text-2xs text-muted">
            Workspace spanfloors.twenty.com · read {now} IST · site refreshes automatically every 5 minutes
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/products/arrange/" className="inline-flex h-9 items-center border border-ink px-4 text-2xs hover:bg-ink hover:text-paper">
            Arrange products
          </a>
          <RefreshButton />
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-8 border border-brand/40 bg-brand/5 p-4 text-body">
          <strong className="font-medium">Couldn’t read from Twenty.</strong> {error}
        </div>
      )}

      {/* Overview */}
      <section id="overview" className="scroll-mt-24">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
          <Stat label="Products in Twenty" value={rows.length} />
          <Stat label="Live on website" value={live.length} note="Have a category" />
          <Stat label="Hidden" value={hidden} note="No category set in Twenty" />
          <Stat label="With image" value={`${withImage}/${live.length}`} note={withImage ? undefined : "Showing logo placeholder"} />
          <Stat label="Old product URLs kept" value={`${urls.length}/${urls.length}`} note={`${sameUrls} same · ${redirected} redirected · 0 broken`} />
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="mono mb-1 text-body">Live products by category</h2>
            <p className="mb-4 text-2xs text-muted">Count of products on each category page</p>
            <Bars
              unit="count"
              total={Math.max(...CATEGORIES.map((c) => live.filter((r) => r.categoryTitle === c.title).length), 1)}
              rows={CATEGORIES.map((c) => ({ label: c.title, value: live.filter((r) => r.categoryTitle === c.title).length }))}
            />
          </div>
          <div>
            <h2 className="mono mb-1 text-body">Data completeness</h2>
            <p className="mb-4 text-2xs text-muted">Share of the {live.length} live products with each field filled in Twenty</p>
            <Bars unit="percent" total={live.length} rows={FIELDS.map((f) => ({ label: f.label, value: live.filter(f.has).length }))} />
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="mt-16 scroll-mt-24">
        <h2 className="mono mb-4 border-t border-line pt-3.5 text-title">All products</h2>
        <AdminProducts rows={rows} />
      </section>

      {/* Old URLs */}
      <section id="urls" className="mt-16 scroll-mt-24">
        <h2 className="mono border-t border-line pt-3.5 text-title">Old URLs &amp; SEO</h2>
        <p className="mt-2 mb-5 max-w-2xl text-2xs text-muted">
          Every product URL from the current spanfloors.com and where it lands on the new site. Redirects are permanent, so search rankings carry over.
          When a product is added in Twenty with a matching name, its old URL is used automatically.
        </p>
        <div className="max-h-[32rem] overflow-auto border border-line">
          <table className="w-full text-left text-2xs">
            <thead className="sticky top-0 bg-paper-2">
              <tr>
                <th className="px-3 py-2 font-medium">Old URL</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Lands on</th>
              </tr>
            </thead>
            <tbody>
              {urls.map((u) => (
                <tr key={u.path} className="border-t border-line">
                  <td className="px-3 py-1.5 font-mono">{u.path}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {u.outcome === "same" ? "✓ Same URL" : u.outcome === "product" ? "→ Product (301)" : "→ Category (301)"}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted">
                    <a href={u.target} target="_blank" className="hover:text-ink hover:underline">
                      {u.target}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
