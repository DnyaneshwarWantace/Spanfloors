"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { can, type Permission, type Role } from "@/lib/permissions";

type Item = { href: string; label: string; icon: string; perm: Permission };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Content",
    items: [
      { href: "/admin/", label: "Dashboard", perm: "dashboard", icon: "M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z" },
      { href: "/admin/leads/", label: "Leads", perm: "leads", icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
      { href: "/admin/content/?type=post", label: "Blog posts", perm: "content", icon: "M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" },
      { href: "/admin/content/tags/", label: "Blog tags", perm: "content.all", icon: "M3 12l9-9h9v9l-9 9zM16 8h.01" },
      { href: "/admin/content/authors/", label: "Blog authors", perm: "content.all", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
      { href: "/admin/content/?type=page", label: "Pages", perm: "content.all", icon: "M6 3h9l4 4v14H6zM14 3v5h5" },
      { href: "/admin/reusable/", label: "Reusable sections", perm: "content.all", icon: "M4 4h10v10H4zM10 10h10v10H10z" },
      { href: "/admin/media/", label: "Media library", perm: "media", icon: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M15 9h.01" },
      { href: "/admin/products/", label: "Products (Twenty)", perm: "products", icon: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/settings/site/", label: "Site settings", perm: "settings.site", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7 5 11l2 1v0l-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z" },
      { href: "/admin/settings/menus/", label: "Menus", perm: "settings.site", icon: "M4 6h16M4 12h16M4 18h10" },
      { href: "/admin/settings/texts/", label: "Shared texts", perm: "settings.site", icon: "M5 6h14M12 6v13M8 19h8" },
      { href: "/admin/settings/integrations/", label: "Integrations & API keys", perm: "settings.integrations", icon: "M15 7a4 4 0 1 1-3.5 6H9v3H6v-3H3v-3h8.5A4 4 0 0 1 15 7z" },
      { href: "/admin/settings/forms/", label: "Forms & bookings", perm: "settings.forms", icon: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h4" },
      { href: "/admin/seo/", label: "SEO", perm: "content.all", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" },
      { href: "/admin/redirects/", label: "Redirects", perm: "redirects", icon: "M4 12h13M13 6l6 6-6 6" },
      { href: "/admin/users/", label: "Users", perm: "users", icon: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
    ],
  },
];

export default function AdminNav({ role }: { role: Role }) {
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
      {SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => can(role, i.perm)) }))
        .filter((s) => s.items.length > 0)
        .map((s) => (
        <div key={s.title}>
          <div className="mb-2 px-2 text-2xs tracking-[0.08em] text-paper/40 uppercase">{s.title}</div>
          <ul className="grid gap-0.5">
            {s.items.map((i) => (
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
