"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { mediaByIds, pickerProducts, type PickedMedia, type PickerProduct, type ReusableItem } from "@/app/admin/(panel)/content/builder-actions";
import MediaLibrary from "../MediaLibrary";
import { btn } from "../ui";
import type { MediaItem } from "@/app/admin/(panel)/media/actions";

/* Shared state for the page builder: chosen photos, the media picker, products and reusable sections. */

type PickOpts = { kind: "image" | "document" | "all"; title: string; onPick: (m: PickedMedia) => void };

type Builder = {
  media: Map<string, PickedMedia>;
  remember: (items: PickedMedia[]) => void;
  pick: (opts: PickOpts) => void;
  products: () => Promise<{ products: PickerProduct[]; error?: string }>;
  reusable: ReusableItem[];
  canReuse: boolean;
};

const Ctx = createContext<Builder | null>(null);

export function useBuilder() {
  const b = useContext(Ctx);
  if (!b) throw new Error("useBuilder outside BuilderProvider");
  return b;
}

const toPicked = (m: MediaItem): PickedMedia => ({ id: m.id, url: m.url, alt: m.alt, filename: m.filename, mime: m.mime, available: m.available, width: m.width, height: m.height });

/** Collects every media id inside a value (sections, items…), so their thumbnails can be loaded at once. */
export function collectIds(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) out.add(v);
  else if (Array.isArray(v)) for (const x of v) collectIds(x, out);
  else if (v && typeof v === "object") for (const x of Object.values(v)) collectIds(x, out);
  return out;
}

export function BuilderProvider({ children, initialValue, reusable, canReuse }: { children: ReactNode; initialValue: unknown; reusable: ReusableItem[]; canReuse: boolean }) {
  const [media, setMedia] = useState(() => new Map<string, PickedMedia>());
  const [picking, setPicking] = useState<PickOpts | null>(null);
  const productsPromise = useRef<Promise<{ products: PickerProduct[]; error?: string }> | null>(null);

  const remember = useCallback((items: PickedMedia[]) => {
    setMedia((prev) => {
      const next = new Map(prev);
      for (const m of items) next.set(m.id, m);
      return next;
    });
  }, []);

  // Thumbnails for everything already on the page (ids that aren't media are simply not found).
  useEffect(() => {
    const ids = [...collectIds(initialValue), ...collectIds(reusable.map((r) => r.data))];
    if (ids.length) mediaByIds(ids).then(remember).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<Builder>(
    () => ({
      media,
      remember,
      pick: setPicking,
      products: () => {
        productsPromise.current ??= pickerProducts().catch(() => ({ products: [], error: "Products couldn't be loaded." }));
        return productsPromise.current;
      },
      reusable,
      canReuse,
    }),
    [media, remember, reusable, canReuse],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {picking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-4 sm:p-6" onClick={() => setPicking(null)}>
          <div role="dialog" aria-modal="true" aria-label={picking.title} className="max-h-[88vh] w-full max-w-5xl overflow-y-auto bg-paper p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="mono text-title">{picking.title}</h2>
              <button type="button" className={btn.ghost} onClick={() => setPicking(null)}>
                Close
              </button>
            </div>
            <MediaLibrary
              picker
              initialKind={picking.kind}
              onPick={(m) => {
                const p = toPicked(m);
                remember([p]);
                picking.onPick(p);
                setPicking(null);
              }}
            />
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
