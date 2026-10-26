"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* The site header. Menu items, dropdowns and the button come from Admin → Menus. */

export type NavLink = { label: string; href: string };
export type NavItem = NavLink & { children: NavLink[] };

const navLink = "transition-opacity hover:opacity-60";
const isExternal = (href: string) => /^(https?:|mailto:|tel:)/.test(href);

function A({ l, className, onClick }: { l: NavLink; className?: string; onClick?: () => void }) {
  return isExternal(l.href) ? (
    <a href={l.href} className={className} onClick={onClick} {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>
      {l.label}
    </a>
  ) : (
    <Link href={l.href} className={className} onClick={onClick}>
      {l.label}
    </Link>
  );
}

/** A top-level item; with children it opens a dropdown on hover, focus or click. */
function Item({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (!item.children.length) return <A l={item} className={navLink} />;
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className={`${navLink} inline-flex items-center gap-1`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {item.label}
        <span aria-hidden="true" className={`text-[0.6rem] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 pt-3">
          <ul className="grid min-w-52 gap-0.5 border border-line bg-paper p-2 shadow-lg">
            <li>
              <A l={{ label: `All ${item.label.toLowerCase()}`, href: item.href }} className="block px-3 py-2 hover:bg-paper-2" onClick={() => setOpen(false)} />
            </li>
            {item.children.map((c) => (
              <li key={c.href + c.label}>
                <A l={c} className="block px-3 py-2 hover:bg-paper-2" onClick={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Header({ left, right, button, logo }: { left: NavItem[]; right: NavItem[]; button: NavLink; logo: string | null }) {
  const [open, setOpen] = useState(false);
  const all = [...left, ...right];
  const hasButton = Boolean(button.label && button.href);
  return (
    <>
      <header className="sticky top-0 z-50 grid h-header grid-cols-[1fr_auto_1fr] items-center bg-paper/95 px-gap text-2xs tracking-[0.02em] text-ink backdrop-blur">
        <nav className="hidden items-center gap-[1.6rem] lg:flex" aria-label="Products">
          {left.map((l) => (
            <Item key={l.href + l.label} item={l} />
          ))}
        </nav>
        <button className="justify-self-start py-2 lg:hidden" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Close" : "Menu"}
        </button>
        <Link href="/" aria-label="Span Floors home">
          <img src={logo ?? "/brand/span-floors-logo-dark.png"} alt="Span Floors" width={155} height={82} className="h-[calc(var(--spacing-header)-1.1rem)] w-auto" />
        </Link>
        <nav className="hidden items-center justify-end gap-[1.6rem] lg:flex" aria-label="Company">
          {right.map((l) => (
            <Item key={l.href + l.label} item={l} />
          ))}
          {hasButton && <A l={button} className="border border-ink bg-ink px-3 py-1.5 text-paper transition-colors hover:bg-transparent hover:text-ink" />}
        </nav>
        {hasButton && <A l={button} className="justify-self-end border border-ink px-2.5 py-1.5 lg:hidden" />}
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-header z-40 flex flex-col gap-4 overflow-y-auto bg-paper px-gap py-8 text-lead text-ink lg:hidden">
          {all.map((l) => (
            <div key={l.href + l.label} className="grid gap-2">
              <A l={l} onClick={() => setOpen(false)} />
              {l.children.length > 0 && (
                <div className="grid gap-2 pl-4 text-body text-ink-2">
                  {l.children.map((c) => (
                    <A key={c.href + c.label} l={c} onClick={() => setOpen(false)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
