"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** The thin bar above the header (Admin → Site settings → Announcement bar). Visitors can close it. */
export default function AnnouncementBar({ text, link, tone, id }: { text: string; link: { label: string; href: string }; tone: "dark" | "brand" | "light"; id: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`sf_bar_${id}`) === "closed") setHidden(true);
    } catch {}
  }, [id]);
  if (hidden) return null;
  const cls = tone === "brand" ? "bg-brand text-white" : tone === "light" ? "bg-paper-2 text-ink" : "bg-ink text-paper";
  const hasLink = Boolean(link.label && link.href);
  return (
    <div role="region" aria-label="Announcement" className={`relative flex items-center justify-center gap-3 px-10 py-2 text-center text-2xs ${cls}`}>
      <span>
        {text}
        {hasLink && (
          <>
            {" "}
            {/^https?:/.test(link.href) ? (
              <a href={link.href} target="_blank" rel="noopener" className="underline underline-offset-2">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="underline underline-offset-2">
                {link.label}
              </Link>
            )}
          </>
        )}
      </span>
      <button
        type="button"
        aria-label="Close announcement"
        className="absolute top-1/2 right-3 -translate-y-1/2 px-1 opacity-70 hover:opacity-100"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(`sf_bar_${id}`, "closed");
          } catch {}
        }}
      >
        ✕
      </button>
    </div>
  );
}
