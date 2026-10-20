"use client";

import Link from "next/link";
import { useState } from "react";

const LEFT = [
  { href: "/engineered-wood-flooring-collection/", label: "Wood Flooring" },
  { href: "/laminate-flooring-collection/", label: "Laminate" },
  { href: "/decking-collection/", label: "Decking" },
  { href: "/facades-collection/", label: "Facades" },
  { href: "/accessories/", label: "Accessories" },
];

const RIGHT = [
  { href: "/projects/", label: "Projects" },
  { href: "/about-spanfloors/", label: "About" },
  { href: "/dealer/", label: "Dealers" },
  { href: "/contact-us/", label: "Contact" },
];

const navLink = "transition-opacity hover:opacity-60";

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-50 grid h-header grid-cols-[1fr_auto_1fr] items-center bg-paper/95 px-gap text-2xs tracking-[0.02em] text-ink backdrop-blur">
        <nav className="hidden gap-[1.6rem] lg:flex" aria-label="Products">
          {LEFT.map((l) => (
            <Link key={l.href} href={l.href} className={navLink}>
              {l.label}
            </Link>
          ))}
        </nav>
        <button className="justify-self-start py-2 lg:hidden" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Close" : "Menu"}
        </button>
        <Link href="/" aria-label="Span Floors home">
          <img src="/brand/span-floors-logo-dark.png" alt="Span Floors" width={155} height={82} className="h-[calc(var(--spacing-header)-1.1rem)] w-auto" />
        </Link>
        <nav className="hidden justify-end gap-[1.6rem] lg:flex" aria-label="Company">
          {RIGHT.map((l) => (
            <Link key={l.href} href={l.href} className={navLink}>
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      {open && (
        <div
          className="fixed inset-x-0 bottom-0 top-header z-40 flex flex-col gap-4 bg-paper px-gap py-8 text-lead text-ink lg:hidden"
          onClick={() => setOpen(false)}
        >
          {[...LEFT, ...RIGHT].map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
