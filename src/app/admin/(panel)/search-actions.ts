"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { getAdminProducts } from "@/lib/catalog";

export type SearchHit = { group: "Pages & posts" | "Products" | "Media" | "Leads"; title: string; sub: string; href: string };

/** Ctrl/Cmd-K search: pages, posts, products, media and leads — only what this person may open. */
export async function adminSearch(raw: string): Promise<SearchHit[]> {
  const user = await requireUser();
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const jobs: Promise<SearchHit[]>[] = [];

  if (can(user.role, "content")) {
    const mine = can(user.role, "content.all") ? undefined : eq(schema.content.authorId, user.id);
    jobs.push(
      db
        .select({ id: schema.content.id, title: schema.content.title, path: schema.content.path, type: schema.content.type, status: schema.content.status })
        .from(schema.content)
        .where(and(or(ilike(schema.content.title, like), ilike(schema.content.path, like)), mine))
        .orderBy(sql`${schema.content.status} = 'archived'`, desc(schema.content.updatedAt))
        .limit(8)
        .then((rows) => rows.map((r) => ({ group: "Pages & posts" as const, title: r.title || "(untitled)", sub: `${r.type === "post" ? "Post" : "Page"} · ${r.status} · ${r.path}`, href: `/admin/content/${r.id}/` }))),
    );
  }
  if (can(user.role, "products")) {
    const needle = q.toLowerCase();
    jobs.push(
      getAdminProducts()
        .then((all) =>
          all
            .filter((p) => [p.displayName, p.name, p.collection, p.categoryTitle].some((v) => typeof v === "string" && v.toLowerCase().includes(needle)))
            .slice(0, 8)
            .map((p) => ({ group: "Products" as const, title: p.displayName, sub: `${p.categoryTitle ?? "No category"}${p.live ? "" : " · not on site"}`, href: `/admin/products/${p.id}/` })),
        )
        .catch(() => []),
    );
  }
  if (can(user.role, "media")) {
    jobs.push(
      db
        .select({ filename: schema.media.filename, alt: schema.media.alt, folder: schema.media.folder })
        .from(schema.media)
        .where(or(ilike(schema.media.filename, like), ilike(schema.media.alt, like)))
        .orderBy(desc(schema.media.createdAt))
        .limit(6)
        .then((rows) => rows.map((m) => ({ group: "Media" as const, title: m.filename, sub: [m.folder, m.alt].filter(Boolean).join(" · "), href: `/admin/media/?q=${encodeURIComponent(m.filename)}` }))),
    );
  }
  if (can(user.role, "leads")) {
    jobs.push(
      db
        .select({ id: schema.leads.id, name: schema.leads.name, email: schema.leads.email, phone: schema.leads.phone, type: schema.leads.type, createdAt: schema.leads.createdAt })
        .from(schema.leads)
        .where(or(ilike(schema.leads.name, like), ilike(schema.leads.email, like), ilike(schema.leads.phone, like), ilike(schema.leads.city, like)))
        .orderBy(desc(schema.leads.createdAt))
        .limit(6)
        .then((rows) => rows.map((l) => ({ group: "Leads" as const, title: l.name, sub: [l.type.replace("_", " "), l.email, l.phone, l.createdAt.toLocaleDateString("en-IN")].filter(Boolean).join(" · "), href: `/admin/leads/${l.id}/` }))),
    );
  }
  return (await Promise.all(jobs)).flat();
}
