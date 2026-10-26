"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import { saveAsReusable, type ReusableItem } from "@/app/admin/(panel)/content/builder-actions";
import { emptyData, sectionDef, sectionsFor } from "@/sections/registry";
import type { Section, SectionDef, SectionGroup, SectionKind } from "@/sections/types";
import { btn, inputCls } from "../ui";
import { BuilderProvider, useBuilder } from "./context";
import FieldEditor from "./FieldEditor";

/* The page builder: an ordered list of sections the editor adds, reorders, hides, copies and fills in. */

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

const GROUPS: SectionGroup[] = ["Intro", "Content", "Products", "Media", "Trust", "Action", "Other"];

export function Sketch({ def, className = "" }: { def: SectionDef; className?: string }) {
  return (
    <svg viewBox="0 0 100 60" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="99" height="59" fill="none" stroke="currentColor" strokeOpacity="0.15" />
      {def.sketch.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill="currentColor"
          fillOpacity={b.tone === "fill" ? 0.12 : b.tone === "accent" ? 0.55 : b.tone === "line" ? 0 : 0.25}
          stroke={b.tone === "line" ? "currentColor" : "none"}
          strokeOpacity={0.5}
        />
      ))}
    </svg>
  );
}

/** Add-section window: every section type with a drawing and one line on what it's for. */
function Picker({ kind, existing, onPick, onClose }: { kind: SectionKind; existing: Section[]; onPick: (def: SectionDef) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const defs = sectionsFor(kind).filter((d) => !q || `${d.label} ${d.description}`.toLowerCase().includes(q.toLowerCase()));
  const used = new Set(existing.filter((s) => !s.hidden).map((s) => s.type));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Add a section" className="max-h-[88vh] w-full max-w-4xl overflow-y-auto bg-paper p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="mono text-title">Add a section</h2>
          <div className="flex min-w-0 flex-1 justify-end gap-2">
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sections" aria-label="Search sections" className={`${inputCls} max-w-64`} />
            <button type="button" className={btn.ghost} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {GROUPS.map((g) => {
          const list = defs.filter((d) => d.group === g);
          if (!list.length) return null;
          return (
            <div key={g} className="mb-5">
              <h3 className="mb-2 text-2xs tracking-[0.06em] text-muted uppercase">{g}</h3>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((d) => {
                  const blocked = d.oncePerPage && used.has(d.type);
                  return (
                    <button
                      key={d.type}
                      type="button"
                      disabled={blocked}
                      onClick={() => onPick(d)}
                      className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 border border-line bg-white/50 p-3 text-left transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Sketch def={d} className="w-full text-ink" />
                      <span className="min-w-0">
                        <span className="block text-body">{d.label}</span>
                        <span className="mt-0.5 block text-2xs leading-snug text-muted">{blocked ? `This page already has a ${d.label.toLowerCase()}.` : d.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!defs.length && <p className="text-2xs text-muted">No section matches “{q}”.</p>}
      </div>
    </div>
  );
}

const THEMES = [
  { value: "default", label: "Page background" },
  { value: "muted", label: "Light tint" },
  { value: "dark", label: "Dark" },
];
const SPACINGS = [
  { value: "compact", label: "Tight" },
  { value: "normal", label: "Normal" },
  { value: "spacious", label: "Roomy" },
];

/** Short summary for a collapsed section: its heading, or the first text it has. */
function summaryOf(s: Section, reusable: ReusableItem[]) {
  if (s.type === "reusable") return reusable.find((r) => r.id === s.data.ref)?.name ?? "Not chosen yet";
  const d = s.data;
  for (const k of ["heading", "title", "note", "kicker"]) if (typeof d[k] === "string" && d[k]) return d[k] as string;
  // Otherwise the first text the editor wrote (never a layout choice or a photo id).
  for (const f of sectionDef(s.type)?.fields ?? []) {
    const v = d[f.name];
    if (f.kind === "text" || f.kind === "textarea") {
      if (typeof v === "string" && v) return v.slice(0, 80);
    } else if (f.kind === "richtext" && typeof v === "string" && v) {
      const plain = v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (plain) return plain.slice(0, 80);
    }
  }
  return "";
}

function SectionCard({
  section,
  index,
  total,
  open,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onInsertAfter,
  dragHandlers,
  dragOver,
}: {
  section: Section;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  onChange: (s: Section) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onInsertAfter: () => void;
  dragHandlers: { onDragStart: () => void; onDragEnd: () => void };
  dragOver: boolean;
}) {
  const { reusable, canReuse } = useBuilder();
  const def = sectionDef(section.type);
  const [menu, setMenu] = useState(false);
  const [options, setOptions] = useState(false);
  const [reuseName, setReuseName] = useState<string | null>(null);
  const [reuseError, setReuseError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  if (!def) return null;
  const summary = summaryOf(section, reusable);
  const saved = section.type === "reusable" ? reusable.find((r) => r.id === section.data.ref) : undefined;

  const doReuse = async () => {
    const res = await saveAsReusable(reuseName ?? "", section);
    if (res.error || !res.id) return setReuseError(res.error ?? "Couldn't save.");
    // The page now places the saved section; edits to it happen in one place.
    onChange({ id: section.id, type: "reusable", hidden: section.hidden, anchor: section.anchor, theme: section.theme, spacing: section.spacing, data: { ref: res.id } });
    setReuseName(null);
    window.dispatchEvent(new CustomEvent("sf:reusable-added", { detail: { id: res.id, name: reuseName, type: section.type, data: section.data } }));
  };

  return (
    <div
      className={`min-w-0 border bg-white/50 transition-colors ${dragOver ? "border-ink" : "border-line"} ${section.hidden ? "opacity-70" : ""}`}
      data-section-card={section.id}
    >
      <div className="flex min-w-0 items-center gap-1 px-2 py-2">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", section.id);
            dragHandlers.onDragStart();
          }}
          onDragEnd={dragHandlers.onDragEnd}
          className="cursor-grab px-1.5 text-muted select-none active:cursor-grabbing"
          title="Drag to reorder"
          aria-hidden="true"
        >
          ⠿
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Sketch def={def} className="hidden w-12 shrink-0 text-ink sm:block" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-2 text-body">
              {section.name || def.label}
              {section.name && <span className="text-2xs text-muted">{def.label}</span>}
              {section.hidden && <span className="bg-ink/8 px-1.5 text-2xs text-muted">Hidden</span>}
            </span>
            {summary && <span className="block truncate text-2xs text-muted">{summary}</span>}
          </span>
        </button>
        <button type="button" className="px-1.5 text-2xs text-muted hover:text-ink disabled:opacity-30" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move section up">
          ↑
        </button>
        <button type="button" className="px-1.5 text-2xs text-muted hover:text-ink disabled:opacity-30" disabled={index === total - 1} onClick={() => onMove(index + 1)} aria-label="Move section down">
          ↓
        </button>
        <button
          type="button"
          className="px-1.5 text-2xs text-muted hover:text-ink"
          onClick={() => onChange({ ...section, hidden: !section.hidden || undefined })}
          aria-label={section.hidden ? "Show section on the site" : "Hide section from visitors"}
          title={section.hidden ? "Show on the site" : "Hide from visitors"}
        >
          {section.hidden ? "Show" : "Hide"}
        </button>
        <div ref={menuRef} className="relative">
          <button type="button" className="px-2 text-body text-muted hover:text-ink" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label="More actions">
            ⋯
          </button>
          {menu && (
            <div role="menu" className="absolute top-full right-0 z-30 mt-1 grid w-56 border border-line bg-paper py-1 shadow-lg">
              {[
                { label: "Add a section below", run: onInsertAfter },
                { label: "Duplicate", run: onDuplicate },
                { label: options ? "Hide section options" : "Section options (name, colour, spacing)", run: () => (setOptions((o) => !o), !open && onToggle()) },
                ...(canReuse && section.type !== "reusable" ? [{ label: "Save as reusable…", run: () => (setReuseName(section.name || summary || def.label), !open && onToggle()) }] : []),
                ...(saved ? [{ label: "Detach (edit only on this page)", run: () => onChange({ ...section, type: saved.type, data: structuredClone(saved.data) }) }] : []),
                { label: "Remove", run: onRemove, danger: true },
              ].map((a) => (
                <button
                  key={a.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    a.run();
                  }}
                  className={`px-3 py-2 text-left text-2xs hover:bg-paper-2 ${"danger" in a && a.danger ? "text-brand" : ""}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="grid gap-5 border-t border-line p-4">
          {reuseName !== null && (
            <div className="grid gap-2 border border-ink/30 bg-paper-2/60 p-3">
              <label htmlFor={`reuse-${section.id}`} className="text-2xs font-medium">
                Name for the reusable section
              </label>
              <div className="flex flex-wrap gap-2">
                <input id={`reuse-${section.id}`} value={reuseName} onChange={(e) => setReuseName(e.target.value)} maxLength={80} className={`${inputCls} min-w-0 flex-1`} />
                <button type="button" className={btn.primary} onClick={doReuse}>
                  Save as reusable
                </button>
                <button type="button" className={btn.ghost} onClick={() => setReuseName(null)}>
                  Cancel
                </button>
              </div>
              <p className="text-2xs text-muted">It can then be placed on other pages. Editing it updates every page that uses it.</p>
              {reuseError && <p className="text-2xs text-brand">{reuseError}</p>}
            </div>
          )}

          {options && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 border-b border-line pb-5 sm:grid-cols-2">
              <label className="grid gap-1.5 text-2xs font-medium">
                Name in the admin (optional)
                <input value={section.name ?? ""} maxLength={80} onChange={(e) => onChange({ ...section, name: e.target.value || undefined })} placeholder={def.label} className={inputCls} />
              </label>
              <label className="grid gap-1.5 text-2xs font-medium">
                Link anchor (optional)
                <input value={section.anchor ?? ""} maxLength={60} onChange={(e) => onChange({ ...section, anchor: e.target.value || undefined })} placeholder="e.g. samples → /page/#samples" className={`${inputCls} font-mono text-2xs`} />
              </label>
              <div className="grid gap-1.5 text-2xs font-medium">
                Background
                <Dropdown aria-label="Background" value={section.theme ?? "default"} onChange={(v) => onChange({ ...section, theme: v === "default" ? undefined : (v as Section["theme"]) })} options={THEMES} />
              </div>
              <div className="grid gap-1.5 text-2xs font-medium">
                Spacing
                <Dropdown aria-label="Spacing" value={section.spacing ?? "normal"} onChange={(v) => onChange({ ...section, spacing: v === "normal" ? undefined : (v as Section["spacing"]) })} options={SPACINGS} />
              </div>
            </div>
          )}

          {saved && <p className="text-2xs text-muted">This is a reusable section. Its content is edited in one place and shown on every page that uses it.</p>}
          {def.fields.map((f) => (
            <FieldEditor key={f.name} field={f} id={`${section.id}-${f.name}`} value={section.data[f.name]} onChange={(v) => onChange({ ...section, data: { ...section.data, [f.name]: v } })} />
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({ initial, kind, name, onChange }: { initial: Section[]; kind: SectionKind; name: string; onChange?: (sections: Section[]) => void }) {
  const [sections, setSections] = useState<Section[]>(initial);
  const [open, setOpen] = useState<string | null>(initial.length === 1 ? initial[0].id : null);
  const [picker, setPicker] = useState<number | null>(null); // insert position
  const [removed, setRemoved] = useState<{ section: Section; index: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange?.(sections);
  }, [sections]); // eslint-disable-line react-hooks/exhaustive-deps

  // The "Section removed. Undo" notice closes by itself after a while.
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 12_000);
    return () => clearTimeout(t);
  }, [removed]);

  const json = useMemo(() => JSON.stringify(sections), [sections]);
  const update = (i: number, s: Section) => setSections((list) => list.map((x, j) => (j === i ? s : x)));
  const move = (from: number, to: number) =>
    setSections((list) => {
      if (to < 0 || to >= list.length || from === to) return list;
      const next = [...list];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  const add = (def: SectionDef) => {
    const s: Section = { id: newId(), type: def.type, data: emptyData(def) };
    const at = picker ?? sections.length;
    setSections((list) => [...list.slice(0, at), s, ...list.slice(at)]);
    setOpen(s.id);
    setPicker(null);
    requestAnimationFrame(() => document.querySelector(`[data-section-card="${s.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <div className="grid min-w-0 gap-2">
      <input type="hidden" name={name} value={json} />
      {sections.length === 0 && (
        <div className="grid place-items-center gap-3 border border-dashed border-line px-6 py-12 text-center">
          <p className="text-body">No sections yet.</p>
          <p className="max-w-md text-2xs text-muted">Build the page from sections: a hero at the top, then text, photos, products, questions and a form. Drag to reorder them any time.</p>
          <button type="button" className={btn.primary} onClick={() => setPicker(0)}>
            Add the first section
          </button>
        </div>
      )}
      {sections.map((s, i) => (
        <div
          key={s.id}
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            setOver(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const from = sections.findIndex((x) => x.id === dragging);
            if (from >= 0) move(from, i);
            setDragging(null);
            setOver(null);
          }}
        >
          <SectionCard
            section={s}
            index={i}
            total={sections.length}
            open={open === s.id}
            onToggle={() => setOpen(open === s.id ? null : s.id)}
            onChange={(next) => update(i, next)}
            onMove={(to) => move(i, to)}
            onDuplicate={() => {
              const copy = { ...structuredClone(s), id: newId(), name: s.name ? `${s.name} (copy)` : undefined };
              setSections((list) => [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]);
              setOpen(copy.id);
            }}
            onRemove={() => {
              setRemoved({ section: s, index: i });
              setSections((list) => list.filter((x) => x.id !== s.id));
            }}
            onInsertAfter={() => setPicker(i + 1)}
            dragHandlers={{ onDragStart: () => setDragging(s.id), onDragEnd: () => (setDragging(null), setOver(null)) }}
            dragOver={over === i && dragging !== s.id}
          />
        </div>
      ))}
      {sections.length > 0 && (
        <button type="button" onClick={() => setPicker(sections.length)} className="border border-dashed border-line py-3 text-2xs text-muted transition-colors hover:border-ink hover:text-ink">
          + Add section
        </button>
      )}

      {removed && (
        <div role="status" className="fixed right-4 bottom-4 z-40 flex items-center gap-3 bg-ink px-4 py-3 text-2xs text-paper shadow-lg">
          Section removed.
          <button
            type="button"
            className="underline"
            onClick={() => {
              setSections((list) => [...list.slice(0, removed.index), removed.section, ...list.slice(removed.index)]);
              setRemoved(null);
            }}
          >
            Undo
          </button>
          <button type="button" className="text-paper/60" onClick={() => setRemoved(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {picker !== null && <Picker kind={kind} existing={sections} onPick={add} onClose={() => setPicker(null)} />}
    </div>
  );
}

/** Page sections editor. Submits the sections as JSON in a hidden input named `name`. */
export default function SectionsEditor({
  initial,
  kind,
  name = "layout",
  reusable,
  canReuse,
  onChange,
}: {
  initial: Section[];
  kind: SectionKind;
  name?: string;
  reusable: ReusableItem[];
  canReuse: boolean;
  onChange?: (sections: Section[]) => void;
}) {
  const [saved, setSaved] = useState(reusable);
  useEffect(() => {
    const add = (e: Event) => setSaved((list) => [...list, (e as CustomEvent).detail as ReusableItem]);
    window.addEventListener("sf:reusable-added", add);
    return () => window.removeEventListener("sf:reusable-added", add);
  }, []);
  return (
    <BuilderProvider initialValue={initial} reusable={saved} canReuse={canReuse}>
      <Editor initial={initial} kind={kind} name={name} onChange={onChange} />
    </BuilderProvider>
  );
}
