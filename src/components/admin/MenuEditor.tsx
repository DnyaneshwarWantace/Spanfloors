"use client";

import { useState, useTransition } from "react";
import { saveConfig } from "@/app/admin/(panel)/settings/config-actions";
import type { Config, MenuItem, MenuLink } from "@/server/site-config";
import FieldEditor from "./builder/FieldEditor";
import { btn, inputCls, Notice } from "./ui";

/* Admin → Menus: the header menu (with dropdowns and a button) and the footer columns. */

type Header = Config<"config.header">;
type Footer = Config<"config.footer">;

const move = <T,>(list: T[], i: number, d: number) => {
  const next = [...list];
  const [x] = next.splice(i, 1);
  next.splice(i + d, 0, x);
  return next;
};

function Row({ index, total, onMove, onRemove, children }: { index: number; total: number; onMove: (d: number) => void; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border border-line bg-paper p-3">
      <div className="min-w-0">{children}</div>
      <div className="flex flex-col items-end gap-1 pt-5 text-2xs">
        <div className="flex">
          <button type="button" className="px-1.5 text-muted hover:text-ink disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            ↑
          </button>
          <button type="button" className="px-1.5 text-muted hover:text-ink disabled:opacity-30" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">
            ↓
          </button>
        </div>
        <button type="button" className="text-muted hover:text-brand" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function LinkInput({ id, label, value, onChange }: { id: string; label: string; value: MenuLink; onChange: (v: MenuLink) => void }) {
  return <FieldEditor field={{ name: id, label, kind: "link" }} id={id} value={value} onChange={(v) => onChange(v as MenuLink)} />;
}

function MenuList({ title, hint, items, onChange, idPrefix }: { title: string; hint: string; items: MenuItem[]; onChange: (items: MenuItem[]) => void; idPrefix: string }) {
  const upd = (i: number, patch: Partial<MenuItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="grid gap-2">
      <div>
        <h3 className="text-2xs font-medium">{title}</h3>
        <p className="text-2xs text-muted">{hint}</p>
      </div>
      {items.map((item, i) => (
        <Row key={i} index={i} total={items.length} onMove={(d) => onChange(move(items, i, d))} onRemove={() => onChange(items.filter((_, j) => j !== i))}>
          <LinkInput id={`${idPrefix}-${i}`} label={`Item ${i + 1}`} value={item} onChange={(v) => upd(i, v)} />
          <div className="mt-3 grid gap-2 border-l-2 border-line pl-3">
            {item.children.map((c, ci) => (
              <Row key={ci} index={ci} total={item.children.length} onMove={(d) => upd(i, { children: move(item.children, ci, d) })} onRemove={() => upd(i, { children: item.children.filter((_, j) => j !== ci) })}>
                <LinkInput id={`${idPrefix}-${i}-${ci}`} label={`Dropdown link ${ci + 1}`} value={c} onChange={(v) => upd(i, { children: item.children.map((x, j) => (j === ci ? v : x)) })} />
              </Row>
            ))}
            {item.children.length < 12 && (
              <button type="button" className={`${btn.ghost} w-fit px-0`} onClick={() => upd(i, { children: [...item.children, { label: "", href: "" }] })}>
                + Add a dropdown link under “{item.label || `Item ${i + 1}`}”
              </button>
            )}
          </div>
        </Row>
      ))}
      {items.length < 10 && (
        <button type="button" className={`${btn.secondary} w-fit`} onClick={() => onChange([...items, { label: "", href: "", children: [] }])}>
          + Add a menu item
        </button>
      )}
    </div>
  );
}

function SaveBar({ onSave }: { onSave: () => Promise<{ ok?: boolean; error?: string }> }) {
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={btn.primary}
        disabled={pending}
        onClick={() => start(async () => {
          const r = await onSave();
          setMsg(r.error ? { tone: "error", text: r.error } : { tone: "success", text: "Saved. Empty items were left out." });
        })}
      >
        {pending ? "Saving…" : "Save menu"}
      </button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

export default function MenuEditor({ header: initialHeader, footer: initialFooter }: { header: Header; footer: Footer }) {
  const [header, setHeader] = useState(initialHeader);
  const [footer, setFooter] = useState(initialFooter);
  const updCol = (i: number, patch: Partial<Footer["columns"][number]>) => setFooter((f) => ({ ...f, columns: f.columns.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-8">
      <section className="grid gap-5 border border-line bg-white/40 p-5">
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Header</h2>
        <MenuList title="Left of the logo" hint="Usually the product collections." items={header.left} onChange={(left) => setHeader((h) => ({ ...h, left }))} idPrefix="hl" />
        <MenuList title="Right of the logo" hint="Company pages: projects, about, dealers, contact." items={header.right} onChange={(right) => setHeader((h) => ({ ...h, right }))} idPrefix="hr" />
        <LinkInput id="header-button" label="Header button (optional), e.g. “Order free samples”" value={header.button} onChange={(button) => setHeader((h) => ({ ...h, button }))} />
        <SaveBar onSave={() => saveConfig("config.header", header)} />
      </section>

      <section className="grid gap-5 border border-line bg-white/40 p-5">
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Footer</h2>
        {footer.columns.map((col, i) => (
          <Row key={i} index={i} total={footer.columns.length} onMove={(d) => setFooter((f) => ({ ...f, columns: move(f.columns, i, d) }))} onRemove={() => setFooter((f) => ({ ...f, columns: f.columns.filter((_, j) => j !== i) }))}>
            <label className="grid gap-1.5 text-2xs font-medium">
              Column title
              <input value={col.title} maxLength={40} onChange={(e) => updCol(i, { title: e.target.value })} className={inputCls} />
            </label>
            <div className="mt-3 grid gap-2 border-l-2 border-line pl-3">
              {col.links.map((l, li) => (
                <Row key={li} index={li} total={col.links.length} onMove={(d) => updCol(i, { links: move(col.links, li, d) })} onRemove={() => updCol(i, { links: col.links.filter((_, j) => j !== li) })}>
                  <LinkInput id={`fc-${i}-${li}`} label={`Link ${li + 1}`} value={l} onChange={(v) => updCol(i, { links: col.links.map((x, j) => (j === li ? v : x)) })} />
                </Row>
              ))}
              {col.links.length < 15 && (
                <button type="button" className={`${btn.ghost} w-fit px-0`} onClick={() => updCol(i, { links: [...col.links, { label: "", href: "" }] })}>
                  + Add a link
                </button>
              )}
            </div>
          </Row>
        ))}
        {footer.columns.length < 8 && (
          <button type="button" className={`${btn.secondary} w-fit`} onClick={() => setFooter((f) => ({ ...f, columns: [...f.columns, { title: "", links: [] }] }))}>
            + Add a column
          </button>
        )}
        <div className="grid gap-2">
          <h3 className="text-2xs font-medium">Legal links (bottom row)</h3>
          {footer.legal.map((l, i) => (
            <Row key={i} index={i} total={footer.legal.length} onMove={(d) => setFooter((f) => ({ ...f, legal: move(f.legal, i, d) }))} onRemove={() => setFooter((f) => ({ ...f, legal: f.legal.filter((_, j) => j !== i) }))}>
              <LinkInput id={`fl-${i}`} label={`Legal link ${i + 1}`} value={l} onChange={(v) => setFooter((f) => ({ ...f, legal: f.legal.map((x, j) => (j === i ? v : x)) }))} />
            </Row>
          ))}
          {footer.legal.length < 8 && (
            <button type="button" className={`${btn.ghost} w-fit px-0`} onClick={() => setFooter((f) => ({ ...f, legal: [...f.legal, { label: "", href: "" }] }))}>
              + Add a legal link
            </button>
          )}
        </div>
        <label className="grid gap-1.5 text-2xs font-medium">
          Copyright line ({"{year}"} becomes the current year)
          <input value={footer.copyright} maxLength={120} onChange={(e) => setFooter((f) => ({ ...f, copyright: e.target.value }))} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 text-2xs">
          <input type="checkbox" checked={footer.showSubscribe} onChange={(e) => setFooter((f) => ({ ...f, showSubscribe: e.target.checked }))} />
          Show the newsletter sign-up in the footer
        </label>
        <p className="text-2xs text-muted">Social links in the footer come from Site settings → Contact details.</p>
        <SaveBar onSave={() => saveConfig("config.footer", footer)} />
      </section>
    </div>
  );
}
