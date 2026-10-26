"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import { searchLinkTargets, type LinkTarget, type PickerProduct } from "@/app/admin/(panel)/content/builder-actions";
import { COLLECTION_OPTIONS, emptyValue } from "@/sections/registry";
import type { Field, LinkValue, ProductsValue } from "@/sections/types";
import { parseVideo } from "@/sections/video";
import RichEditor from "../RichEditor";
import { btn, inputCls } from "../ui";
import { useBuilder } from "./context";

/* One editor per field kind. Every editor is controlled: value in, onChange out. */

type Props<T = unknown> = { field: Field; value: T; onChange: (v: T) => void; id: string };

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

function Label({ field, htmlFor, extra }: { field: Field; htmlFor?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-2xs font-medium">
        {field.label}
        {field.required && <span className="text-brand"> *</span>}
      </label>
      {extra}
    </div>
  );
}

function Count({ value, max }: { value: string; max?: number }) {
  if (!max) return null;
  const over = value.length > max * 0.9;
  return <span className={`text-2xs tabular-nums ${over ? "text-[#a0661f]" : "text-muted"}`}>{value.length} / {max}</span>;
}

/* ---------- Media ---------- */

function Thumb({ id, onRemove, onMoveLeft, onMoveRight }: { id: string; onRemove: () => void; onMoveLeft?: () => void; onMoveRight?: () => void }) {
  const { media } = useBuilder();
  const m = media.get(id);
  return (
    <div className="group relative aspect-[4/3] w-28 shrink-0 overflow-hidden border border-line bg-paper-2">
      {m?.mime.startsWith("image/") && m.available ? (
        <img src={m.url} alt={m.alt} className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-1 text-center text-2xs break-all text-muted">{m ? (m.available ? m.filename : "File not imported yet") : "Loading…"}</div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/70 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <div className="flex">
          {onMoveLeft && (
            <button type="button" onClick={onMoveLeft} className="px-2 py-1 text-2xs text-paper" aria-label="Move earlier">
              ←
            </button>
          )}
          {onMoveRight && (
            <button type="button" onClick={onMoveRight} className="px-2 py-1 text-2xs text-paper" aria-label="Move later">
              →
            </button>
          )}
        </div>
        <button type="button" onClick={onRemove} className="px-2 py-1 text-2xs text-paper" aria-label="Remove">
          Remove
        </button>
      </div>
    </div>
  );
}

function ImageField({ field, value, onChange }: Props<string | null>) {
  const { pick, media } = useBuilder();
  const m = value ? media.get(value) : undefined;
  const isFile = field.kind === "file";
  return (
    <div className="grid gap-1.5">
      <Label field={field} />
      <div className="flex flex-wrap items-center gap-3">
        {value && <Thumb id={value} onRemove={() => onChange(null)} />}
        <button
          type="button"
          className={btn.secondary}
          onClick={() => pick({ kind: isFile ? "all" : "image", title: field.label, onPick: (p) => onChange(p.id) })}
        >
          {value ? "Change" : isFile ? "Choose file" : "Choose photo"}
        </button>
        {m && !isFile && !m.alt && <span className="text-2xs text-[#a0661f]">This photo has no description (alt text). Add one in the media library.</span>}
        {m && isFile && <span className="min-w-0 truncate text-2xs text-muted">{m.filename}</span>}
      </div>
      {field.hint && <p className="text-2xs text-muted">{field.hint}</p>}
    </div>
  );
}

function ImagesField({ field, value, onChange }: Props<string[]>) {
  const { pick } = useBuilder();
  const list = Array.isArray(value) ? value : [];
  const max = field.kind === "images" ? (field.max ?? 60) : 60;
  const move = (i: number, d: number) => {
    const next = [...list];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div className="grid gap-1.5">
      <Label field={field} extra={<span className="text-2xs text-muted tabular-nums">{list.length} / {max}</span>} />
      <div className="flex flex-wrap gap-2">
        {list.map((id, i) => (
          <Thumb key={`${id}-${i}`} id={id} onRemove={() => onChange(list.filter((_, j) => j !== i))} onMoveLeft={i > 0 ? () => move(i, -1) : undefined} onMoveRight={i < list.length - 1 ? () => move(i, 1) : undefined} />
        ))}
        {list.length < max && (
          <button
            type="button"
            onClick={() => pick({ kind: "image", title: "Add a photo", onPick: (p) => onChange(list.includes(p.id) ? list : [...list, p.id]) })}
            className="grid aspect-[4/3] w-28 place-items-center border border-dashed border-line text-2xs text-muted hover:border-ink hover:text-ink"
          >
            + Add photo
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Links ---------- */

function LinkField({ field, value, onChange, id }: Props<LinkValue>) {
  const v = value && typeof value === "object" ? value : { label: "", href: "" };
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<LinkTarget[]>([]);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchLinkTargets(v.href.startsWith("http") ? "" : v.href.replace(/^\//, "")).then(setHits).catch(() => setHits([])), 200);
    return () => clearTimeout(t);
  }, [open, v.href]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (t: LinkTarget) => {
    onChange({ label: v.label || t.label, href: t.href });
    setOpen(false);
  };
  const bad = v.href && !/^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(v.href);

  return (
    <div className="grid gap-1.5">
      <Label field={field} />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <input aria-label={`${field.label}: label`} placeholder="Button text" value={v.label} maxLength={80} onChange={(e) => onChange({ ...v, label: e.target.value })} className={inputCls} />
        <div ref={box} className="relative min-w-0">
          <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={`${field.label}: address`}
            placeholder="Search pages, or paste https://…"
            value={v.href}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onChange({ ...v, href: e.target.value });
              setOpen(true);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (!open || !hits.length) return;
              if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, hits.length - 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              else if (e.key === "Enter") (e.preventDefault(), choose(hits[active]));
              else if (e.key === "Escape") setOpen(false);
            }}
            className={`${inputCls} font-mono text-2xs`}
          />
          {open && hits.length > 0 && (
            <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto border border-line bg-paper shadow-lg">
              {hits.map((t, i) => (
                <li
                  key={t.href}
                  role="option"
                  aria-selected={i === active}
                  onPointerDown={(e) => (e.preventDefault(), choose(t))}
                  onPointerEnter={() => setActive(i)}
                  className="flex min-w-0 cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-2xs aria-selected:bg-paper-2"
                >
                  <span className="min-w-0 truncate">
                    {t.label} <span className="font-mono text-muted">{t.href}</span>
                  </span>
                  <span className="shrink-0 text-muted">{t.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {bad && !open ? <p className="text-2xs text-brand">Use a site address starting with / or a full https:// link.</p> : field.hint && <p className="text-2xs text-muted">{field.hint}</p>}
    </div>
  );
}

/* ---------- Products ---------- */

function ProductsField({ field, value, onChange }: Props<ProductsValue>) {
  const { products } = useBuilder();
  const v: ProductsValue = value && typeof value === "object" ? value : (emptyValue(field) as ProductsValue);
  const [all, setAll] = useState<PickerProduct[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (v.mode !== "pick" || all) return;
    products().then((r) => {
      setAll(r.products);
      setError(r.error ?? "");
    });
  }, [v.mode, all, products]);

  const byId = useMemo(() => new Map((all ?? []).map((p) => [p.id, p])), [all]);
  const ids = v.ids ?? [];
  const results = (all ?? []).filter((p) => !ids.includes(p.id) && (!q || `${p.name} ${p.collection}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 30);
  const move = (i: number, d: number) => {
    const next = [...ids];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange({ ...v, ids: next });
  };

  return (
    <div className="grid gap-3">
      <Label field={field} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
        <Dropdown
          aria-label="Which products"
          value={v.mode}
          onChange={(mode) => onChange({ ...v, mode: mode as ProductsValue["mode"] })}
          options={[
            { value: "collection", label: "One collection", hint: "In the order set under Products → Arrange" },
            { value: "featured", label: "Featured products", hint: "Products marked featured" },
            { value: "pick", label: "Hand-picked", hint: "Choose products one by one" },
          ]}
        />
        {v.mode === "collection" ? <Dropdown aria-label="Collection" value={v.collection ?? COLLECTION_OPTIONS[0].value} onChange={(c) => onChange({ ...v, collection: c })} options={COLLECTION_OPTIONS} /> : <span />}
        <input
          type="number"
          min={1}
          max={48}
          aria-label="How many to show"
          title="How many to show"
          value={v.limit ?? 8}
          onChange={(e) => onChange({ ...v, limit: Math.max(1, Math.min(48, Number(e.target.value) || 1)) })}
          className={inputCls}
        />
      </div>
      {v.mode === "pick" && (
        <div className="grid gap-3 border border-line bg-white/40 p-3">
          {error && <p className="text-2xs text-brand">{error}</p>}
          {ids.length > 0 && (
            <ol className="grid gap-1">
              {ids.map((pid, i) => {
                const p = byId.get(pid);
                return (
                  <li key={pid} className="flex min-w-0 items-center gap-2 border border-line bg-paper px-2 py-1.5 text-2xs">
                    <span className="w-5 shrink-0 text-muted tabular-nums">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">
                      {p ? p.name : all ? "Product no longer in Twenty" : "Loading…"}
                      {p?.hidden && <span className="text-[#a0661f]"> · hidden on the site</span>}
                    </span>
                    <button type="button" className="px-1.5 text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" className="px-1.5 text-muted hover:text-ink disabled:opacity-30" disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                      ↓
                    </button>
                    <button type="button" className="px-1.5 text-muted hover:text-brand" onClick={() => onChange({ ...v, ids: ids.filter((x) => x !== pid) })}>
                      Remove
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <input placeholder={all ? `Search ${all.length} products…` : "Loading products from Twenty…"} value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} aria-label="Search products" disabled={!all} />
          {all && (q || ids.length === 0) && (
            <ul className="grid max-h-60 gap-px overflow-y-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onChange({ ...v, ids: [...ids, p.id].slice(0, 48) })} className="flex w-full min-w-0 items-center gap-3 px-2 py-1.5 text-left text-2xs hover:bg-paper-2">
                    <span className="relative size-8 shrink-0 overflow-hidden bg-paper-2">{p.image && <img src={p.image} alt="" className="absolute inset-0 size-full object-cover" />}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 text-muted">{p.collection}</span>
                  </button>
                </li>
              ))}
              {!results.length && <li className="px-2 py-2 text-2xs text-muted">No products match.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Repeatable items ---------- */

function ItemsField({ field: anyField, value, onChange }: Props<Record<string, unknown>[]>) {
  const list = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState<string | null>(list.length === 1 ? String(list[0]?.id) : null);
  if (anyField.kind !== "items") return null;
  const field = anyField;
  const max = field.max ?? 50;
  const add = () => {
    const item = { id: newId(), ...Object.fromEntries(field.fields.map((f) => [f.name, emptyValue(f)])) };
    onChange([...list, item]);
    setOpen(item.id);
  };
  const update = (i: number, k: string, v: unknown) => onChange(list.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const move = (i: number, d: number) => {
    const next = [...list];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  const titleOf = (it: Record<string, unknown>, i: number) => {
    const t = field.titleField ? it[field.titleField] : undefined;
    const sub = field.fields.find((f) => f.name === field.titleField);
    const label = sub?.kind === "select" ? sub.options.find((o) => o.value === t)?.label : typeof t === "string" ? t : "";
    return label || `${field.itemLabel} ${i + 1}`;
  };

  return (
    <div className="grid gap-2">
      <Label field={field} extra={<span className="text-2xs text-muted tabular-nums">{list.length} / {max}</span>} />
      <div className="grid gap-1.5">
        {list.map((it, i) => {
          const key = String(it.id ?? i);
          const isOpen = open === key;
          return (
            <div key={key} className="border border-line bg-white/50">
              <div className="flex min-w-0 items-center gap-1 px-2 py-1.5">
                <button type="button" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left text-2xs">
                  <span aria-hidden="true" className={`text-muted transition-transform ${isOpen ? "rotate-90" : ""}`}>
                    ▸
                  </span>
                  <span className="min-w-0 truncate">{titleOf(it, i)}</span>
                </button>
                <button type="button" className="px-1.5 text-2xs text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${field.itemLabel.toLowerCase()} up`}>
                  ↑
                </button>
                <button type="button" className="px-1.5 text-2xs text-muted hover:text-ink disabled:opacity-30" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${field.itemLabel.toLowerCase()} down`}>
                  ↓
                </button>
                <button
                  type="button"
                  className="px-1.5 text-2xs text-muted hover:text-ink disabled:opacity-30"
                  disabled={list.length >= max}
                  onClick={() => onChange([...list.slice(0, i + 1), { ...structuredClone(it), id: newId() }, ...list.slice(i + 1)])}
                >
                  Copy
                </button>
                <button type="button" className="px-1.5 text-2xs text-muted hover:text-brand" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              {isOpen && (
                <div className="grid gap-4 border-t border-line p-3">
                  {field.fields.map((sub) => (
                    <FieldEditor key={sub.name} field={sub} value={it[sub.name]} onChange={(v) => update(i, sub.name, v)} id={`${key}-${sub.name}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {list.length < max && (
        <button type="button" onClick={add} className={`${btn.secondary} w-fit`}>
          + Add {field.itemLabel.toLowerCase()}
        </button>
      )}
    </div>
  );
}

/* ---------- Everything else ---------- */

function ReusableField({ field, value, onChange }: Props<string | null>) {
  const { reusable } = useBuilder();
  if (!reusable.length) return <p className="text-2xs text-muted">No reusable sections yet. Save any section as reusable from its ⋯ menu.</p>;
  return (
    <div className="grid gap-1.5">
      <Label field={field} />
      <Dropdown aria-label={field.label} value={value ?? ""} placeholder="Choose a reusable section" onChange={(v) => onChange(v)} options={reusable.map((r) => ({ value: r.id, label: r.name, hint: r.type }))} />
      {value && (
        <a href={`/admin/reusable/${value}/`} target="_blank" className="text-2xs text-muted underline">
          Edit this reusable section (changes every page that uses it) ↗
        </a>
      )}
    </div>
  );
}

export default function FieldEditor({ field, value, onChange, id }: Props) {
  switch (field.kind) {
    case "text":
    case "textarea": {
      const v = typeof value === "string" ? value : "";
      const Tag = field.kind === "text" ? "input" : "textarea";
      return (
        <div className="grid gap-1.5">
          <Label field={field} htmlFor={id} extra={<Count value={v} max={field.max} />} />
          <Tag
            id={id}
            value={v}
            maxLength={field.max}
            rows={field.kind === "textarea" ? (field.rows ?? 3) : undefined}
            placeholder={field.kind === "text" ? field.placeholder : undefined}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
            className={`${inputCls} ${field.kind === "textarea" ? "h-auto py-2 leading-relaxed" : ""}`}
          />
          {field.hint && <p className="text-2xs text-muted">{field.hint}</p>}
        </div>
      );
    }
    case "richtext":
      return (
        <div className="grid gap-1.5">
          <Label field={field} />
          <RichEditor compact initialHtml={typeof value === "string" ? value : ""} onChange={(html) => onChange(html)} placeholder="Write here…" />
        </div>
      );
    case "image":
    case "file":
      return <ImageField field={field} value={(value as string | null) ?? null} onChange={onChange} id={id} />;
    case "images":
      return <ImagesField field={field} value={value as string[]} onChange={onChange} id={id} />;
    case "link":
      return <LinkField field={field} value={value as LinkValue} onChange={onChange} id={id} />;
    case "select":
      return (
        <div className="grid gap-1.5">
          <Label field={field} />
          <Dropdown id={id} aria-label={field.label} value={typeof value === "string" ? value : (field.default ?? field.options[0]?.value)} onChange={onChange} options={field.options} />
          {field.hint && <p className="text-2xs text-muted">{field.hint}</p>}
        </div>
      );
    case "toggle":
      return (
        <label className="flex items-center gap-2 text-2xs">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case "number":
      return (
        <div className="grid gap-1.5">
          <Label field={field} htmlFor={id} />
          <input id={id} type="number" min={field.min} max={field.max} value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={`${inputCls} w-40`} />
        </div>
      );
    case "video": {
      const v = typeof value === "string" ? value : "";
      const info = parseVideo(v);
      return (
        <div className="grid gap-1.5">
          <Label field={field} htmlFor={id} />
          <div className="flex min-w-0 items-center gap-3">
            {info?.thumbnail && <img src={info.thumbnail} alt="" className="h-12 w-20 shrink-0 object-cover" />}
            <input id={id} value={v} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => onChange(e.target.value)} className={`${inputCls} min-w-0 flex-1 font-mono text-2xs`} />
          </div>
          {v && !info ? <p className="text-2xs text-brand">Paste a YouTube or Vimeo link.</p> : field.hint && <p className="text-2xs text-muted">{field.hint}</p>}
        </div>
      );
    }
    case "products":
      return <ProductsField field={field} value={value as ProductsValue} onChange={onChange} id={id} />;
    case "reusable":
      return <ReusableField field={field} value={(value as string | null) ?? null} onChange={onChange} id={id} />;
    case "items":
      return <ItemsField field={field} value={value as Record<string, unknown>[]} onChange={onChange} id={id} />;
  }
}
