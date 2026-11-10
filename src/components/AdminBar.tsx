"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Info = { name: string; edit: string | null; what: string };

/**
 * A small "Edit this page" bar for people signed in to the admin. Visitors never see it: it only asks the
 * server when the sign-in marker cookie is present, and the server checks the real session.
 */
export default function AdminBar() {
  const path = usePathname();
  const [info, setInfo] = useState<Info | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!/(?:^|;\s*)sf_admin=1/.test(document.cookie) || window.self !== window.top) return;
    try {
      if (sessionStorage.getItem("sf_admin_bar") === "off") return setHidden(true);
    } catch {}
    let live = true;
    fetch(`/api/admin-bar/?path=${encodeURIComponent(path)}`, { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.status === 200 ? r.json() : null))
      .then((j: Info | null) => live && setInfo(j))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [path]);

  if (!info || hidden) return null;
  return (
    <div role="region" aria-label="Admin" className="fixed bottom-4 left-4 z-[70] flex items-center gap-1 rounded-full bg-ink p-1 text-2xs text-paper shadow-lg">
      {info.edit ? (
        <a href={info.edit} className="rounded-full bg-paper px-3.5 py-1.5 font-medium text-ink hover:bg-paper/90">
          Edit {info.what}
        </a>
      ) : (
        <span className="px-3 py-1.5 text-paper/70">This page is edited in Products or Settings</span>
      )}
      <a href="/admin/" className="rounded-full px-3 py-1.5 hover:bg-white/10">
        Admin
      </a>
      <button
        type="button"
        aria-label="Hide the admin bar"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem("sf_admin_bar", "off");
          } catch {}
        }}
        className="grid size-7 place-items-center rounded-full hover:bg-white/10"
      >
        ×
      </button>
    </div>
  );
}
