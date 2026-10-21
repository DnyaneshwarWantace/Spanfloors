"use client";

import { useState, useTransition } from "react";
import ProductMedia from "@/components/ProductMedia";
import { saveArrangement } from "@/app/admin/(panel)/products/actions";
import { btn, Notice } from "./ui";

export type ArrangeItem = { id: string; name: string; subtitle: string; image: string | null; tone: string | null; hidden: boolean; featured: boolean; editHref: string };

/** Drag products into the order the website shows them. Keyboard: focus a card and use ← → to move it. */
export default function ArrangeProducts({ initial, categoryTitle }: { initial: ArrangeItem[]; categoryTitle: string }) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (next: ArrangeItem[]) => {
    setItems(next);
    setDirty(true);
    setSaved(null);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    update(next);
  };
  const toggle = (id: string, key: "hidden" | "featured") => update(items.map((i) => (i.id === id ? { ...i, [key]: !i[key] } : i)));

  return (
    <>
      <div className="sticky top-14 z-10 -mx-4 sm:-mx-6 lg:top-[5.4rem] mb-5 flex flex-wrap items-center gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6 lg:-mx-10 lg:px-10">
        <button className={btn.primary} disabled={!dirty || pending} onClick={() => start(async () => {
          const r = await saveArrangement(items.map(({ id, hidden, featured }) => ({ id, hidden, featured })), categoryTitle);
          if (r.ok) { setDirty(false); setSaved("Order saved. The website updates within a minute."); } else setSaved(r.error ?? "Couldn’t save");
        })}>
          {pending ? "Saving…" : "Save order"}
        </button>
        <button className={btn.ghost} disabled={!dirty || pending} onClick={() => { setItems(initial); setDirty(false); }}>
          Undo changes
        </button>
        <button className={btn.ghost} disabled={pending} onClick={() => update([...items].sort((a, b) => a.name.localeCompare(b.name)))}>
          Sort A–Z
        </button>
        <span className="text-2xs text-muted">
          Drag cards to reorder. Position 1 shows first on the website. {items.filter((i) => i.hidden).length} hidden · {items.filter((i) => i.featured).length} featured
        </span>
      </div>
      {saved && <div className="mb-4"><Notice tone={saved.startsWith("Order saved") ? "success" : "error"}>{saved}</Notice></div>}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {items.map((p, i) => (
          <li
            key={p.id}
            draggable
            tabIndex={0}
            aria-label={`${p.name}, position ${i + 1} of ${items.length}`}
            onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
            onDragLeave={() => setOverId((o) => (o === p.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); if (dragId) move(items.findIndex((x) => x.id === dragId), i); setDragId(null); setOverId(null); }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onKeyDown={(e) => { if (e.key === "ArrowLeft") move(i, i - 1); if (e.key === "ArrowRight") move(i, i + 1); }}
            className={`group relative cursor-grab border bg-white/50 p-2 transition active:cursor-grabbing focus:outline-2 focus:outline-ink ${dragId === p.id ? "opacity-40" : ""} ${overId === p.id && dragId !== p.id ? "border-ink" : "border-line"} ${p.hidden ? "opacity-55" : ""}`}
          >
            <div className="relative aspect-[5/6] overflow-hidden bg-paper-2">
              <ProductMedia src={p.image} alt={p.name} tone={p.tone} boards={3} />
              <span className="absolute top-1.5 left-1.5 z-10 bg-ink px-1.5 py-0.5 text-2xs text-paper tabular-nums">{i + 1}</span>
              {p.featured && <span className="absolute top-1.5 right-1.5 z-10 bg-[#a08a62] px-1.5 py-0.5 text-2xs text-white">Featured</span>}
              {p.hidden && <span className="absolute inset-x-0 bottom-0 z-10 bg-ink/80 py-1 text-center text-2xs text-paper">Hidden</span>}
            </div>
            <div className="mt-2 line-clamp-2 min-h-[2.4em] text-2xs font-medium">{p.name}</div>
            <div className="truncate text-2xs text-muted">{p.subtitle}</div>
            <div className="mt-2 flex items-center justify-between gap-1 text-2xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={p.featured} onChange={() => toggle(p.id, "featured")} /> Featured</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={p.hidden} onChange={() => toggle(p.id, "hidden")} /> Hide</label>
            </div>
            <div className="mt-1.5 flex justify-between text-2xs text-muted">
              <button type="button" onClick={() => move(i, 0)} className="hover:text-ink" disabled={i === 0}>To top</button>
              <a href={p.editHref} className="hover:text-ink">Edit →</a>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
