"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { can, type Permission, type Role } from "@/lib/permissions";

type Item = { href: string; label: string; icon?: string; perm: Permission };
type Group = { label: string; icon: string; href?: string; perm?: Permission; items?: Item[] };

const ICON = {
  home: "M3 11l9-8 9 8M5 9.5V21h14V9.5",
  leads: "M4 6h16v12H4zM4 7l8 6 8-6",
  website: "M3 5h18v14H3zM3 9h18M7 7h.01M10 7h.01",
  media: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M15 9h.01",
  look: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.5-.3-.9-.3-1.4 0-.8.6-1.4 1.4-1.4H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 12h.01M10 8h.01M14 8h.01",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7 5 11l2 1v0l-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z",
};

/** Six places, grouped by what you are trying to do. Rarely used tools sit inside a group. */
export const NAV: Group[] = [
  { label: "Home", icon: ICON.home, href: "/admin/", perm: "dashboard" },
  { label: "Leads", icon: ICON.leads, href: "/admin/leads/", perm: "leads" },
  {
    label: "Website",
    icon: ICON.website,
    items: [
      { href: "/admin/content/?type=page", label: "Pages", perm: "content.all" },
      { href: "/admin/content/?type=post", label: "Blog posts", perm: "content" },
      { href: "/admin/products/", label: "Products", perm: "products" },
      { href: "/admin/content/tags/", label: "Blog tags", perm: "content.all" },
      { href: "/admin/content/authors/", label: "Blog authors", perm: "content.all" },
      { href: "/admin/reusable/", label: "Reusable sections", perm: "content.all" },
      { href: "/admin/seo/", label: "SEO health", perm: "content.all" },
      { href: "/admin/redirects/", label: "Redirects", perm: "redirects" },
      { href: "/preview/components/", label: "Section guide", perm: "content" },
    ],
  },
  { label: "Photos & files", icon: ICON.media, href: "/admin/media/", perm: "media" },
  {
    label: "Look & menus",
    icon: ICON.look,
    items: [
      { href: "/admin/settings/site/", label: "Logo, contact & studios", perm: "settings.site" },
      { href: "/admin/settings/menus/", label: "Header & footer menus", perm: "settings.site" },
      { href: "/admin/settings/texts/", label: "Words used everywhere", perm: "settings.site" },
      { href: "/admin/settings/forms/", label: "Forms & bookings", perm: "settings.forms" },
    ],
  },
  {
    label: "Settings",
    icon: ICON.settings,
    items: [
      { href: "/admin/settings/integrations/", label: "Connections & keys", perm: "settings.integrations" },
      { href: "/admin/users/", label: "Users", perm: "users" },
      { href: "/admin/activity/", label: "Activity log", perm: "users" },
      { href: "/admin/settings/backups/", label: "Backups", perm: "settings.integrations" },
    ],
  },
];

/** Every page in the menu, flat (for the Ctrl/Cmd-K search). */
export const NAV_ITEMS: Item[] = NAV.flatMap((g) => (g.items ? g.items : [{ href: g.href!, label: g.label, perm: g.perm! }]));

const linkCls =
  "flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-body text-paper/70 transition-colors hover:bg-white/5 hover:text-paper aria-[current=page]:bg-white/10 aria-[current=page]:text-paper";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const currentType = params.get("type") ?? "post";
  const groups = NAV.map((g) => ({ ...g, items: g.items?.filter((i) => can(role, i.perm)) })).filter((g) => (g.items ? g.items.length > 0 : can(role, g.perm!)));

  // The one menu entry for this page: the longest matching address wins (Blog tags over Blog posts).
  const matches = (href: string) => {
    const [base, query] = href.split("?");
    if (base === "/admin/") return pathname === "/admin/" || pathname === "/admin";
    if (!pathname.startsWith(base)) return false;
    return query ? new URLSearchParams(query).get("type") === currentType : true;
  };
  const active = NAV_ITEMS.filter((i) => matches(i.href)).sort((a, b) => b.href.split("?")[0].length - a.href.split("?")[0].length)[0]?.href;
  const activeGroup = groups.find((g) => (g.items ? g.items.some((i) => i.href === active) : g.href === active))?.label;
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setOpen(null), [pathname]);

  return (
    <nav aria-label="Admin">
      <ul className="grid gap-0.5">
        {groups.map((g) => {
          if (!g.items) {
            return (
              <li key={g.label}>
                <Link href={g.href!} aria-current={active === g.href ? "page" : undefined} className={linkCls}>
                  <Icon d={g.icon} />
                  {g.label}
                </Link>
              </li>
            );
          }
          const expanded = open === g.label || (open === null && activeGroup === g.label);
          return (
            <li key={g.label}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? "" : g.label)}
                className={`${linkCls} w-full ${activeGroup === g.label ? "text-paper" : ""}`}
              >
                <Icon d={g.icon} />
                <span className="flex-1 text-left">{g.label}</span>
                <svg viewBox="0 0 24 24" className={`size-3.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              {expanded && (
                <ul className="mt-0.5 mb-1.5 ml-[1.15rem] grid gap-0.5 border-l border-line-light pl-2.5">
                  {g.items.map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} aria-current={active === i.href ? "page" : undefined} className={`${linkCls} py-1 text-2xs`}>
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
