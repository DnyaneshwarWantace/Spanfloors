"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Phone/tablet admin header: logo + menu button that slides the sidebar in. Hidden on large screens. */
export default function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();

  // Close after navigating.
  useEffect(() => setOpen(false), [pathname, params]);

  // Esc closes; lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-ink px-4 text-paper lg:hidden">
        <Link href="/admin/" className="flex items-center gap-2.5">
          <img src="/brand/span-floors-logo.png" alt="Span Floors" width={155} height={82} className="h-8 w-auto" />
          <span className="mono text-2xs text-paper/60">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          className="flex h-10 items-center gap-2 rounded-sm border border-line-light px-3 text-2xs"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
          Menu
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div id="admin-mobile-menu" className="absolute inset-y-0 left-0 flex w-[86vw] max-w-[20rem] flex-col gap-8 overflow-y-auto bg-ink px-4 py-5 text-paper shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 grid size-9 place-items-center rounded-sm border border-line-light text-paper/80"
              aria-label="Close menu"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
