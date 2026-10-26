"use client";

import { useActionState, useState, useTransition } from "react";
import RichEditor from "./RichEditor";
import MediaLibrary from "./MediaLibrary";
import { BADGES } from "@/lib/badges";
import { btn, Field, inputCls, Notice } from "./ui";
import { saveProductExtras, testExternalImage, type ProductSaveState } from "@/app/admin/(panel)/products/actions";

export type ProductExtras = {
  twentyId: string;
  hidden: boolean;
  featured: boolean;
  sortOrder: number;
  slug: string;
  displayName: string;
  descriptionHtml: string;
  gallery: { id: string; url: string; alt: string }[];
  externalImageIds: string[];
  useExternalImages: boolean;
  seoTitle: string;
  seoDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: { id: string; url: string } | null;
  badges: string[];
  relatedIds: string[];
};

type TestResult = { ok: boolean; url?: string; message: string };

function ExternalIdRow({ id, onRemove, primary }: { id: string; onRemove?: () => void; primary?: boolean }) {
  const [result, setResult] = useState<TestResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className="grid gap-2 border-b border-line py-2.5 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-2xs">{id}</code>
        {primary && <span className="text-2xs text-muted">from Twenty</span>}
        <button type="button" className={btn.secondary} disabled={pending} onClick={() => start(async () => setResult(await testExternalImage(id)))}>
          {pending ? "Testing…" : "Test"}
        </button>
        {onRemove && (
          <button type="button" className={btn.ghost} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      {result && (
        <div className="flex items-center gap-3">
          {result.ok && result.url && <img src={result.url} alt="" className="size-14 border border-line object-cover" />}
          <span className={`text-2xs ${result.ok ? "text-[#2f6339]" : "text-brand"}`}>{result.message}</span>
        </div>
      )}
    </li>
  );
}

/** Hand-picked related products and accessories, in order. */
function RelatedPicker({ options, value, onChange }: { options: { id: string; name: string; collection: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const byId = new Map(options.map((o) => [o.id, o]));
  const hits = q ? options.filter((o) => !value.includes(o.id) && `${o.name} ${o.collection}`.toLowerCase().includes(q.toLowerCase())).slice(0, 12) : [];
  const move = (i: number, d: number) => {
    const n = [...value];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <ol className="grid gap-1">
          {value.map((id, i) => (
            <li key={id} className="flex min-w-0 items-center gap-2 border border-line bg-paper px-2 py-1.5 text-2xs">
              <span className="w-5 shrink-0 text-muted tabular-nums">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">
                {byId.get(id)?.name ?? "Product no longer live"} <span className="text-muted">· {byId.get(id)?.collection}</span>
              </span>
              <button type="button" className="px-1.5 text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                ↑
              </button>
              <button type="button" className="px-1.5 text-muted hover:text-ink disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                ↓
              </button>
              <button type="button" className="px-1.5 text-muted hover:text-brand" onClick={() => onChange(value.filter((x) => x !== id))}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
      {value.length < 12 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products and accessories to add…" className={inputCls} aria-label="Search related products" />}
      {hits.length > 0 && (
        <ul className="grid max-h-56 gap-px overflow-y-auto border border-line">
          {hits.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex w-full min-w-0 justify-between gap-3 px-2 py-1.5 text-left text-2xs hover:bg-paper-2"
                onClick={() => {
                  onChange([...value, o.id]);
                  setQ("");
                }}
              >
                <span className="min-w-0 truncate">{o.name}</span>
                <span className="shrink-0 text-muted">{o.collection}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProductExtrasForm({
  initial,
  twentyImageId,
  defaultName,
  productOptions = [],
}: {
  initial: ProductExtras;
  twentyImageId: string | null;
  defaultName: string;
  productOptions?: { id: string; name: string; collection: string }[];
}) {
  const [state, action, pending] = useActionState<ProductSaveState, FormData>(saveProductExtras, {});
  const [gallery, setGallery] = useState(initial.gallery);
  const [extIds, setExtIds] = useState(initial.externalImageIds);
  const [newId, setNewId] = useState("");
  const [picking, setPicking] = useState(false);
  const [shareImage, setShareImage] = useState(initial.ogImage);
  const [related, setRelated] = useState(initial.relatedIds);
  const [pickingShare, setPickingShare] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const moveTo = (from: number, to: number) =>
    setGallery((g) => {
      if (to < 0 || to >= g.length || from === to) return g;
      const n = [...g];
      const [x] = n.splice(from, 1);
      n.splice(to, 0, x);
      return n;
    });
  const move = (i: number, d: -1 | 1) => moveTo(i, i + d);

  return (
    <form action={action} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <input type="hidden" name="twentyId" value={initial.twentyId} />
      <input type="hidden" name="mediaIds" value={gallery.map((g) => g.id).join(",")} />
      <input type="hidden" name="externalImageIds" value={extIds.join(",")} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="success">Saved. The website updates within a minute.</Notice>}

      <section className="border border-line bg-white/40 p-4">
        <h2 className="mb-3 text-2xs font-semibold tracking-[0.06em] uppercase">Visibility</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-2xs">
            <input type="checkbox" name="hidden" defaultChecked={initial.hidden} /> Hide from the website
          </label>
          <label className="flex items-center gap-2 text-2xs">
            <input type="checkbox" name="featured" defaultChecked={initial.featured} /> Featured (shown first)
          </label>
          <label className="flex items-center gap-2 text-2xs">
            Position
            <input name="sortOrder" type="number" min={0} defaultValue={initial.sortOrder} className={`${inputCls} h-8 w-20`} />
            <a href="/admin/products/arrange/" className="text-muted underline">arrange visually</a>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-2xs">
          <span className="font-medium">Badges</span>
          {BADGES.map((b) => (
            <label key={b.key} className="flex items-center gap-1.5">
              <input type="checkbox" name="badges" value={b.key} defaultChecked={initial.badges.includes(b.key)} /> {b.label}
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-3 border border-line bg-white/40 p-4">
        <div>
          <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Goes well with</h2>
          <p className="mt-1 text-2xs text-muted">Related products or accessories (skirting, underlay, care kits) shown first on this product’s page. Similar products fill the rest.</p>
        </div>
        <input type="hidden" name="relatedIds" value={related.join(",")} />
        <RelatedPicker options={productOptions.filter((o) => o.id !== initial.twentyId)} value={related} onChange={setRelated} />
      </section>

      <section className="border border-line bg-white/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Image gallery</h2>
          <button type="button" className={btn.secondary} onClick={() => setPicking(true)}>
            Add images
          </button>
        </div>
        <p className="mb-3 text-2xs text-muted">Drag to reorder. The first image is the main one shown on product cards. Uploaded photos show before Allsy.io images.</p>
        {gallery.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {gallery.map((g, i) => (
              <li
                key={g.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null) moveTo(dragIdx, i);
                  setDragIdx(null);
                }}
                onDragEnd={() => setDragIdx(null)}
                className={`grid cursor-grab gap-1.5 active:cursor-grabbing ${dragIdx === i ? "opacity-40" : ""}`}
              >
                <div className="relative aspect-[5/6] overflow-hidden bg-paper-2">
                  <img src={g.url} alt={g.alt} className="absolute inset-0 size-full object-cover" />
                  {i === 0 && <span className="absolute top-1.5 left-1.5 bg-ink px-1.5 py-0.5 text-2xs text-paper">Main</span>}
                </div>
                <div className="flex justify-between text-2xs">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30" aria-label="Move left">
                    ←
                  </button>
                  {i > 0 ? (
                    <button type="button" onClick={() => moveTo(i, 0)} className="text-muted hover:text-ink">
                      Make main
                    </button>
                  ) : (
                    <span className="text-muted">Main</span>
                  )}
                  <button type="button" onClick={() => setGallery((x) => x.filter((y) => y.id !== g.id))} className="text-muted hover:text-brand">
                    Remove
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === gallery.length - 1} className="px-1 disabled:opacity-30" aria-label="Move right">
                    →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-line py-8 text-center text-2xs text-muted">No uploaded images. Add from the media library.</p>
        )}
      </section>

      <section className="border border-line bg-white/40 p-4">
        <h2 className="mb-1 text-2xs font-semibold tracking-[0.06em] uppercase">Image service</h2>
        <p className="mb-3 text-2xs text-muted">Images fetched by ID from the client’s image service (set up under Integrations). Test any ID to preview it.</p>
        <label className="mb-3 flex items-center gap-2 text-2xs">
          <input type="checkbox" name="useExternalImages" defaultChecked={initial.useExternalImages} /> Show images from the image service for this product
        </label>
        <ul className="mb-3">
          {twentyImageId && <ExternalIdRow id={twentyImageId} primary />}
          {extIds.map((id) => (
            <ExternalIdRow key={id} id={id} onRemove={() => setExtIds((x) => x.filter((y) => y !== id))} />
          ))}
          {!twentyImageId && !extIds.length && <li className="py-2 text-2xs text-muted">No image IDs yet (Twenty has none for this product).</li>}
        </ul>
        <div className="flex gap-2">
          <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="Add another image ID" className={`${inputCls} h-9 font-mono text-2xs`} />
          <button
            type="button"
            className={btn.secondary}
            onClick={() => {
              const v = newId.trim();
              if (v && !extIds.includes(v) && v !== twentyImageId) setExtIds((x) => [...x, v]);
              setNewId("");
            }}
          >
            Add ID
          </button>
        </div>
      </section>

      <section className="grid gap-4 border border-line bg-white/40 p-4">
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Website details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor="displayName" hint={`Leave empty to use “${defaultName}”.`}>
            <input id="displayName" name="displayName" defaultValue={initial.displayName} className={inputCls} />
          </Field>
          <Field label="URL slug" htmlFor="slug" hint="Leave empty to keep the automatic (SEO-matched) URL.">
            <input id="slug" name="slug" defaultValue={initial.slug} className={`${inputCls} font-mono`} />
          </Field>
        </div>
        <Field label="Description" hint="Shown on the product page. Supports headings, lists, links, images and YouTube videos.">
          <RichEditor name="descriptionHtml" initialHtml={initial.descriptionHtml} placeholder="Describe the product…" />
        </Field>
      </section>

      <section className="grid gap-4 border border-line bg-white/40 p-4">
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">SEO</h2>
        <Field label="SEO title" htmlFor="seoTitle" hint="Leave empty to keep the current title (matches the old site where it existed).">
          <input id="seoTitle" name="seoTitle" defaultValue={initial.seoTitle} maxLength={120} className={inputCls} />
        </Field>
        <Field label="Meta description" htmlFor="seoDescription">
          <textarea id="seoDescription" name="seoDescription" defaultValue={initial.seoDescription} maxLength={320} rows={3} className={`${inputCls} h-auto py-2`} />
        </Field>
      </section>

      <section className="grid gap-4 border border-line bg-white/40 p-4">
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Sharing (WhatsApp, Telegram, social)</h2>
        <input type="hidden" name="ogImageMediaId" value={shareImage?.id ?? ""} />
        <div className="flex flex-wrap items-center gap-3">
          {shareImage && <img src={shareImage.url} alt="" className="h-16 w-28 object-cover" />}
          <button type="button" className={btn.secondary} onClick={() => setPickingShare(true)}>
            {shareImage ? "Change share image" : "Choose share image"}
          </button>
          {shareImage && (
            <button type="button" className={btn.ghost} onClick={() => setShareImage(null)}>
              Use the automatic card
            </button>
          )}
        </div>
        <p className="text-2xs text-muted">Without a share image, a branded card with the product name and its first photo is used. Best at 1200 × 630 pixels.</p>
        <Field label="Share title (optional)" htmlFor="ogTitle">
          <input id="ogTitle" name="ogTitle" defaultValue={initial.ogTitle} maxLength={120} className={inputCls} />
        </Field>
        <Field label="Share description (optional)" htmlFor="ogDescription">
          <textarea id="ogDescription" name="ogDescription" defaultValue={initial.ogDescription} maxLength={300} rows={2} className={`${inputCls} h-auto py-2`} />
        </Field>
      </section>

      {pickingShare && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => setPickingShare(false)}>
          <div role="dialog" aria-modal="true" aria-label="Share image" className="max-h-[85vh] w-full max-w-5xl overflow-y-auto bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono text-title">Share image</h2>
              <button type="button" className={btn.ghost} onClick={() => setPickingShare(false)}>
                Close
              </button>
            </div>
            <MediaLibrary
              picker
              initialKind="image"
              onPick={(m) => {
                setShareImage({ id: m.id, url: m.url });
                setPickingShare(false);
              }}
            />
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap sm:-mx-6 items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6 lg:-mx-10 lg:px-10">
        <button className={btn.primary} disabled={pending}>
          {pending ? "Saving…" : "Save product"}
        </button>
        <span className="text-2xs text-muted">Changes are stored on the website only. Twenty is never modified.</span>
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => setPicking(false)}>
          <div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono text-title">Add images</h2>
              <button type="button" className={btn.ghost} onClick={() => setPicking(false)}>
                Done
              </button>
            </div>
            <MediaLibrary
              picker
              initialKind="image"
              onPick={(m) => setGallery((g) => (g.some((x) => x.id === m.id) ? g : [...g, { id: m.id, url: m.url, alt: m.alt }]))}
            />
          </div>
        </div>
      )}
    </form>
  );
}
