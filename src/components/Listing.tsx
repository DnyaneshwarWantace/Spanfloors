"use client";

import { useMemo, useState } from "react";
import ProductCard, { type CardProduct } from "./ProductCard";

export type ListingItem = CardProduct & {
  facets: Record<string, string[]>;
  createdAt: string;
};

type Facet = { key: string; label: string };
type Order = "recommended" | "az" | "za" | "new";

const ORDERS: [Order, string][] = [
  ["recommended", "Recommended"],
  ["az", "Alphabetical"],
  ["za", "Alphabetical (Z–A)"],
  ["new", "Newest"],
];

const groupLabel = "mb-2 block bg-paper-2 px-1.5 py-1.5 text-2xs font-semibold tracking-[0.06em] uppercase";
const option =
  "flex w-full items-center gap-2 px-1.5 py-1 text-left text-ink-2 before:size-1 before:shrink-0 before:rounded-full before:content-[''] aria-pressed:before:bg-ink";

export default function Listing({ items, facets, labels }: { items: ListingItem[]; facets: Facet[]; labels: Record<string, string> }) {
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [order, setOrder] = useState<Order>("recommended");
  const [panelOpen, setPanelOpen] = useState(false);

  const options = useMemo(() => {
    const out: Record<string, [string, number][]> = {};
    for (const f of facets) {
      const counts = new Map<string, number>();
      for (const it of items) for (const v of it.facets[f.key] ?? []) counts.set(v, (counts.get(v) ?? 0) + 1);
      out[f.key] = [...counts.entries()].sort((a, b) => (labels[a[0]] ?? a[0]).localeCompare(labels[b[0]] ?? b[0]));
    }
    return out;
  }, [items, facets, labels]);

  const visible = useMemo(() => {
    const active = Object.entries(selected).filter(([, s]) => s.size);
    const list = items.filter((it) => active.every(([k, s]) => (it.facets[k] ?? []).some((v) => s.has(v))));
    if (order === "recommended") return list; // server order = admin arrangement
    return [...list].sort((a, b) =>
      order === "new" ? b.createdAt.localeCompare(a.createdAt) : order === "za" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
    );
  }, [items, selected, order]);

  const toggle = (key: string, v: string) =>
    setSelected((prev) => {
      const s = new Set(prev[key] ?? []);
      if (s.has(v)) s.delete(v);
      else s.add(v);
      return { ...prev, [key]: s };
    });

  const anyActive = Object.values(selected).some((s) => s.size);

  return (
    <div className="grid items-start gap-x-gap gap-y-12 px-gap pt-10 pb-24 md:grid-cols-4 xl:grid-cols-5">
      <aside className="text-2xs md:sticky md:top-[calc(var(--spacing-header)+1rem)] md:max-h-[calc(100vh-var(--spacing-header)-2rem)] md:overflow-auto md:pr-2" aria-label="Filter products">
        <button
          className="h-11 w-full border border-ink text-2xs md:hidden"
          onClick={() => setPanelOpen(!panelOpen)}
          aria-expanded={panelOpen}
        >
          {panelOpen ? "Hide filters" : "Filter & sort"}
        </button>
        <div className={`${panelOpen ? "block" : "hidden"} mt-4 md:mt-0 md:block`}>
          <span className={groupLabel}>Order by</span>
          {ORDERS.map(([v, l]) => (
            <button key={v} className={option} aria-pressed={order === v} onClick={() => setOrder(v)}>
              {l}
            </button>
          ))}

          <span className={`${groupLabel} mt-6`}>Filter</span>
          {facets
            .filter((f) => options[f.key]?.length)
            .map((f) => (
              <details key={f.key} className="border-b border-line">
                <summary className="chev px-1.5 py-2">{f.label}</summary>
                <div className="pb-2">
                  {options[f.key].map(([v, n]) => (
                    <button key={v} className={option} aria-pressed={selected[f.key]?.has(v) ?? false} onClick={() => toggle(f.key, v)}>
                      {labels[v] ?? v}
                      <span className="ml-auto text-muted">{n}</span>
                    </button>
                  ))}
                </div>
              </details>
            ))}
          {anyActive && (
            <button className="mt-4 px-1.5 py-1 text-muted underline" onClick={() => setSelected({})}>
              Clear filters
            </button>
          )}
        </div>
      </aside>

      <div className="grid grid-cols-2 gap-x-gap gap-y-8 md:col-span-3 md:grid-cols-3 md:gap-y-[3.5rem] xl:col-span-4 xl:grid-cols-4">
        {visible.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
        {!visible.length && <p className="col-span-full py-16 text-muted">No products match these filters.</p>}
      </div>
    </div>
  );
}
