"use client";

import { useEffect, useMemo, useState } from "react";
import ProductMedia from "@/components/ProductMedia";
import { label, TONE_COLORS } from "@/lib/labels";
import type { getAdminProducts } from "@/lib/catalog";

export type AdminRow = Awaited<ReturnType<typeof getAdminProducts>>[number];

type Status = "all" | "live" | "hidden";
type Issue = "none" | "image" | "tone" | "dimensions" | "grade" | "variants";

const ISSUES: [Issue, string, (r: AdminRow) => boolean][] = [
  ["none", "Any data", () => true],
  ["image", "Missing image", (r) => r.images.length === 0],
  ["tone", "Missing colour tone", (r) => !r.collection],
  ["dimensions", "Missing dimensions", (r) => !r.dimensions],
  ["grade", "Missing grade", (r) => r.grade.length === 0],
  ["variants", "No linked sizes", (r) => r.variants.length === 0],
];

const CHECKS: [string, (r: AdminRow) => boolean][] = [
  ["Image", (r) => r.images.length > 0],
  ["Category", (r) => r.live],
  ["Tone", (r) => Boolean(r.collection)],
  ["Dimensions", (r) => Boolean(r.dimensions)],
  ["Brand", (r) => Boolean(r.brand)],
  ["Grade", (r) => r.grade.length > 0],
  ["Construction", (r) => r.construction.length > 0],
  ["Installation", (r) => r.installation.length > 0],
  ["Box coverage", (r) => r.areaPerBoxSqft != null],
  ["Sizes", (r) => r.variants.length > 0],
];

const select = "h-9 border border-line bg-paper px-2 text-2xs outline-none focus:border-ink";

function StatusPill({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 text-2xs">
      <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
        <circle cx="5" cy="5" r="4" fill="#3d7a4a" />
      </svg>
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted">
      <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
        <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      Hidden
    </span>
  );
}

function Score({ r }: { r: AdminRow }) {
  const ok = CHECKS.filter(([, f]) => f(r)).length;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums" title={`${ok} of ${CHECKS.length} key fields filled`}>
      <span className="h-1.5 w-12 rounded-full bg-paper-2">
        <span className="block h-full rounded-full bg-ink-2" style={{ width: `${(ok / CHECKS.length) * 100}%` }} />
      </span>
      <span className="text-muted">
        {ok}/{CHECKS.length}
      </span>
    </span>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
  return (
    <div className="contents">
      <dt className="text-muted">{k}</dt>
      <dd className={empty ? "text-brand/80" : ""}>{empty ? "Not set" : v}</dd>
    </div>
  );
}

function Drawer({ r, onClose }: { r: AdminRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={r.displayName}
        className="h-full w-full max-w-[34rem] overflow-y-auto bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <ProductMedia src={r.images[0]} alt={r.displayName} tone={r.collection} boards={5} />
          <button onClick={onClose} className="absolute top-3 right-3 z-10 grid size-8 place-items-center bg-ink/80 text-paper" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xs text-muted">{r.categoryTitle ?? "No category — hidden"}</div>
              <h3 className="mono mt-1 text-title">{r.displayName}</h3>
              <div className="mt-1 text-2xs text-muted">Name in Twenty: {r.name}</div>
            </div>
            <StatusPill live={r.live} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {r.href && (
              <a href={r.href} target="_blank" className="inline-flex h-8 items-center border border-ink bg-ink px-3 text-2xs text-paper">
                View on website ↗
              </a>
            )}
            <a href={`/admin/products/${r.id}/`} className="inline-flex h-8 items-center border border-ink px-3 text-2xs">
              Edit images &amp; details
            </a>
            <a
              href={`https://spanfloors.twenty.com/object/masterProduct/${r.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-8 items-center border border-ink px-3 text-2xs"
            >
              Edit in Twenty ↗
            </a>
          </div>

          <h4 className="mono mt-8 mb-3 border-t border-line pt-3 text-2xs">Website</h4>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-2xs">
            <Field k="URL" v={r.href && <span className="font-mono">{r.href}</span>} />
            <Field k="Old site URL" v={r.live ? (r.legacyUrl ? "Same URL as spanfloors.com" : "New URL") : null} />
            <Field k="Image" v={r.images[0] ? <span className="break-all">{r.images[0]}</span> : null} />
            <Field k="Image ID" v={r.imageId && <span className="font-mono">{r.imageId}</span>} />
          </dl>

          <h4 className="mono mt-8 mb-3 border-t border-line pt-3 text-2xs">Product data</h4>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-2xs">
            <Field k="Category (Twenty)" v={r.category && label(r.category)} />
            <Field k="Brand" v={r.brand} />
            <Field k="Format" v={r.format} />
            <Field
              k="Colour tone"
              v={
                r.collection && (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-3 border border-line" style={{ background: TONE_COLORS[r.collection] }} />
                    {label(r.collection)}
                  </span>
                )
              }
            />
            <Field k="Grade" v={r.grade.map(label).join(", ")} />
            <Field k="Construction" v={r.construction.map(label).join(", ")} />
            <Field k="Installation" v={r.installation.map(label).join(", ")} />
            <Field k="Dimensions" v={r.dimensions} />
            <Field k="Length" v={r.range} />
            <Field k="Width / note" v={r.differentiator} />
            <Field k="Planks per box" v={r.planksPerBox} />
            <Field k="Coverage per box" v={r.areaPerBoxSqft != null ? `${r.areaPerBoxSqft} sq ft` : null} />
            <Field k="List price" v={r.listPricePerSqftInr != null ? `₹${r.listPricePerSqftInr.toLocaleString("en-IN")} / sq ft (not shown on site)` : null} />
            <Field k="Description" v={r.specification} />
            <Field k="Added" v={new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} />
            <Field k="Updated" v={new Date(r.updatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} />
          </dl>

          <h4 className="mono mt-8 mb-3 border-t border-line pt-3 text-2xs">Sizes &amp; formats ({r.variants.length})</h4>
          {r.variants.length ? (
            <table className="w-full text-left text-2xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1.5 font-normal">Format</th>
                  <th className="py-1.5 font-normal">Size</th>
                  <th className="py-1.5 font-normal">Species</th>
                  <th className="py-1.5 font-normal">Per box</th>
                </tr>
              </thead>
              <tbody>
                {r.variants.map((v) => (
                  <tr key={v.id} className="border-t border-line">
                    <td className="py-1.5">{v.format ?? "—"}</td>
                    <td className="py-1.5">{v.dimensions ?? "—"}</td>
                    <td className="py-1.5">{v.species ?? "—"}</td>
                    <td className="py-1.5">{v.sqftBox ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-2xs text-muted">No Product Stocks linked to this product (Header field in Twenty).</p>
          )}

          <h4 className="mono mt-8 mb-3 border-t border-line pt-3 text-2xs">Checklist</h4>
          <ul className="grid grid-cols-2 gap-1.5 text-2xs">
            {CHECKS.map(([name, f]) => (
              <li key={name} className={f(r) ? "" : "text-brand/80"}>
                {f(r) ? "✓" : "✕"} {name}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default function AdminProducts({ rows }: { rows: AdminRow[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [issue, setIssue] = useState<Issue>("none");
  const [open, setOpen] = useState<AdminRow | null>(null);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.categoryTitle ?? "Hidden (no category)"))].sort(), [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const test = ISSUES.find(([k]) => k === issue)![2];
    return rows
      .filter((r) => (status === "all" ? true : status === "live" ? r.live : !r.live))
      .filter((r) => cat === "all" || (r.categoryTitle ?? "Hidden (no category)") === cat)
      .filter(test)
      .filter((r) => !needle || [r.name, r.displayName, r.brand, r.dimensions].some((s) => s?.toLowerCase().includes(needle)))
      .sort((a, b) => Number(b.live) - Number(a.live) || a.displayName.localeCompare(b.displayName));
  }, [rows, q, cat, status, issue]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, brand, size…"
          className="h-9 w-64 border border-line bg-paper px-3 text-2xs outline-none focus:border-ink"
          aria-label="Search products"
        />
        <select className={select} value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="hidden">Hidden</option>
        </select>
        <select className={select} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className={select} value={issue} onChange={(e) => setIssue(e.target.value as Issue)} aria-label="Data issues">
          {ISSUES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <span className="ml-auto text-2xs text-muted tabular-nums">
          {visible.length} of {rows.length} products
        </span>
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[60rem] text-left text-2xs">
          <thead className="bg-paper-2">
            <tr>
              <th className="w-14 px-3 py-2.5 font-medium" />
              <th className="px-3 py-2.5 font-medium">Product</th>
              <th className="px-3 py-2.5 font-medium">Category</th>
              <th className="px-3 py-2.5 font-medium">Tone</th>
              <th className="px-3 py-2.5 font-medium">Format · Size</th>
              <th className="px-3 py-2.5 font-medium">Grade</th>
              <th className="px-3 py-2.5 font-medium">Sizes</th>
              <th className="px-3 py-2.5 font-medium">Data</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => setOpen(r)}
                onKeyDown={(e) => e.key === "Enter" && setOpen(r)}
                className="cursor-pointer border-t border-line transition-colors hover:bg-paper-2/70 focus:bg-paper-2 focus:outline-none"
              >
                <td className="px-3 py-2">
                  <div className="relative size-10 overflow-hidden">
                    <ProductMedia src={r.images[0]} alt={r.displayName} tone={r.collection} boards={3} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-body">{r.displayName}</div>
                  <div className="text-muted">{r.brand ?? "No brand"}</div>
                </td>
                <td className="px-3 py-2">{r.categoryTitle ?? <span className="text-muted">—</span>}</td>
                <td className="px-3 py-2">
                  {r.collection ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="size-3 shrink-0 border border-line" style={{ background: TONE_COLORS[r.collection] }} />
                      {label(r.collection)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div>{r.format ?? <span className="text-muted">—</span>}</div>
                  <div className="text-muted">{r.dimensions ?? ""}</div>
                </td>
                <td className="px-3 py-2">{r.grade.length ? r.grade.map(label).join(", ") : <span className="text-muted">—</span>}</td>
                <td className="px-3 py-2 tabular-nums">{r.variants.length || <span className="text-muted">0</span>}</td>
                <td className="px-3 py-2">
                  <Score r={r} />
                </td>
                <td className="px-3 py-2">
                  <StatusPill live={r.live} />
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted">
                  No products match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <Drawer r={open} onClose={() => setOpen(null)} />}
    </>
  );
}
