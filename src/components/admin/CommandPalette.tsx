"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminSearch, type SearchHit } from "@/app/admin/(panel)/search-actions";
import { can, type Role } from "@/lib/permissions";
import { NAV_ITEMS } from "./AdminNav";

type Row = { group: string; title: string; sub: string; href: string };

/** Ctrl/Cmd-K: jump to any admin page, or find a page, post, product, photo or lead. */
export default function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("admin:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("admin:search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ("");
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      adminSearch(q)
        .then((h) => live && setHits(h))
        .catch(() => live && setHits([]))
        .finally(() => live && setLoading(false));
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const rows: Row[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pages = NAV_ITEMS
      .filter((i) => can(role, i.perm) && (!needle || i.label.toLowerCase().includes(needle)))
      .slice(0, needle ? 5 : 8)
      .map((i) => ({ group: "Go to", title: i.label, sub: "", href: i.href }));
    return [...pages, ...hits];
  }, [q, hits, role]);

  useEffect(() => setActive(0), [rows.length, q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const go = (r: Row | undefined) => {
    if (!r) return;
    setOpen(false);
    router.push(r.href);
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] grid items-start justify-items-center bg-ink/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Search the admin" className="w-full max-w-xl overflow-hidden bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(rows.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(rows[active]);
            }
          }}
          placeholder="Search pages, posts, products, photos, leads…"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="admin-search-results"
          aria-activedescendant={rows[active] ? `as-${active}` : undefined}
          className="h-14 w-full border-b border-line bg-transparent px-5 text-body outline-none"
        />
        <ul id="admin-search-results" ref={listRef} role="listbox" className="max-h-[55vh] overflow-y-auto py-2">
          {rows.map((r, i) => {
            const head = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <li key={`${r.group}-${r.href}-${i}`} role="presentation">
                {head && <div className="px-5 pt-3 pb-1 text-2xs tracking-[0.06em] text-muted uppercase">{head}</div>}
                <div
                  id={`as-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={`mx-2 cursor-pointer px-3 py-2 ${i === active ? "bg-paper-2" : ""}`}
                >
                  <div className="truncate text-2xs text-ink">{r.title}</div>
                  {r.sub && <div className="truncate text-2xs text-muted">{r.sub}</div>}
                </div>
              </li>
            );
          })}
          {q.trim().length >= 2 && !loading && hits.length === 0 && <li className="px-5 py-3 text-2xs text-muted">Nothing found for “{q.trim()}”.</li>}
          {loading && <li className="px-5 py-3 text-2xs text-muted">Searching…</li>}
        </ul>
        <div className="flex gap-4 border-t border-line px-5 py-2 text-2xs text-muted">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
