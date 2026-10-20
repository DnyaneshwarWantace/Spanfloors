"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Item = { href: string; label: string; icon: string; adminOnly?: boolean };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Content",
    items: [
      { href: "/admin/", label: "Dashboard", icon: "M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z" },
      { href: "/admin/leads/", label: "Leads", icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
      { href: "/admin/content/?type=post", label: "Blog posts", icon: "M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" },
      { href: "/admin/content/?type=page", label: "Pages", icon: "M6 3h9l4 4v14H6zM14 3v5h5" },
      { href: "/admin/media/", label: "Media library", icon: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M15 9h.01" },
      { href: "/admin/products/", label: "Products (Twenty)", icon: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/settings/site/", label: "Site settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7 5 11l2 1v0l-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z" },
      { href: "/admin/settings/integrations/", label: "Integrations & API keys", icon: "M15 7a4 4 0 1 1-3.5 6H9v3H6v-3H3v-3h8.5A4 4 0 0 1 15 7z", adminOnly: true },
      { href: "/admin/settings/forms/", label: "Forms & bookings", icon: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h4" },
      { href: "/admin/redirects/", label: "Redirects", icon: "M4 12h13M13 6l6 6-6 6" },
      { href: "/admin/users/", label: "Users", icon: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", adminOnly: true },
    ],
  },
];

export default function AdminNav({ role }: { role: "admin" | "editor" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const currentType = params.get("type") ?? "post";
  const isActive = (href: string) => {
    const [base, query] = href.split("?");
    if (base === "/admin/") return pathname === "/admin/" || pathname === "/admin";
    if (!pathname.startsWith(base)) return false;
    return query ? new URLSearchParams(query).get("type") === currentType : true;
  };

  return (
    <nav className="grid gap-6" aria-label="Admin">
      {SECTIONS.map((s) => (
        <div key={s.title}>
          <div className="mb-2 px-2 text-2xs tracking-[0.08em] text-paper/40 uppercase">{s.title}</div>
          <ul className="grid gap-0.5">
            {s.items
              .filter((i) => !i.adminOnly || role === "admin")
              .map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={isActive(i.href) ? "page" : undefined}
                    className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-body text-paper/70 transition-colors hover:bg-white/5 hover:text-paper aria-[current=page]:bg-white/10 aria-[current=page]:text-paper"
                  >
                    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
                      <path d={i.icon} />
                    </svg>
                    {i.label}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
