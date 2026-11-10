import "server-only";
import { existsSync } from "node:fs";
import { unstable_cache } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATEGORIES, getFullCatalog } from "@/lib/catalog";
import { checkSeo, type SeoReport } from "./seo-check";
import { resolveStored } from "./storage";
import type { Section } from "@/sections/types";

/* SEO overview, the 404 log and the broken-link scan (Admin → SEO). */

/** Bot probes and noise that shouldn't fill the 404 log. */
const NOISE = /(\.php|\.env|\.git|wp-login|xmlrpc|wp-admin|wp-includes|\.asp|\.cgi|cgi-bin|\/\.well-known\/|\.sql|\.bak|\.zip|\.tar|phpmyadmin|\/vendor\/|\/node_modules\/)/i;

/** Records a page visitors asked for that doesn't exist (fire-and-forget). */
export function logNotFound(path: string, referrer: string | null) {
  if (path.length > 500 || NOISE.test(path) || path.startsWith("/admin") || path.startsWith("/_next")) return;
  const ref = referrer && !referrer.includes("/admin/") ? referrer.slice(0, 500) : null;
  void db
    .insert(schema.notFoundLog)
    .values({ path, referrer: ref })
    .onConflictDoUpdate({
      target: schema.notFoundLog.path,
      set: { hits: sql`${schema.notFoundLog.hits} + 1`, lastSeen: new Date(), ignored: false, ...(ref ? { referrer: ref } : {}) },
    })
    .catch(() => undefined);
}

/* ---------- Broken internal links ---------- */

export type BrokenLink = { pageId: string; pageTitle: string; pageType: string; href: string; problem: "missing" | "redirect"; target?: string };

const SITE_HOST = /^https?:\/\/(www\.)?spanfloors\.com/i;

function linksOf(body: string, layout: unknown): string[] {
  const out = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.href === "string") out.push(o.href);
      for (const x of Object.values(o)) if (typeof x === "string" && x.includes("href=")) out.push(...[...x.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
      Object.values(o).forEach(walk);
    }
  };
  walk(layout);
  return out;
}

/** Every internal link inside live pages and posts that points at nothing (or at a redirect). */
export async function scanBrokenLinks(): Promise<BrokenLink[]> {
  const [rows, catalog, redirects] = await Promise.all([
    db
      .select({ id: schema.content.id, title: schema.content.title, type: schema.content.type, path: schema.content.path, body: schema.content.body, layout: schema.content.layout, status: schema.content.status })
      .from(schema.content),
    getFullCatalog().catch(() => []),
    db.select({ from: schema.redirects.fromPath, to: schema.redirects.toPath }).from(schema.redirects),
  ]);
  const live = new Set(rows.filter((r) => r.status === "published" || r.status === "scheduled" || r.status === "archived").map((r) => r.path));
  for (const c of CATEGORIES) live.add(`/${c.slug}/`);
  for (const p of catalog) if (!p.hidden) live.add(p.href);
  live.add("/");
  live.add("/blog/");
  const redirectTo = new Map(redirects.map((r) => [r.from, r.to]));

  const out: BrokenLink[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.status !== "published" && r.status !== "scheduled") continue;
    for (let href of linksOf(r.body, r.layout)) {
      href = href.trim().replace(SITE_HOST, "");
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const path = decodeURI(href.split(/[?#]/)[0]);
      if (!path || path === "/") continue;
      const key = `${r.id}|${path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (path.startsWith("/media/")) {
        const full = resolveStored(decodeURIComponent(path.slice(7)));
        if (!full || !existsSync(full)) out.push({ pageId: r.id, pageTitle: r.title, pageType: r.type, href, problem: "missing" });
        continue;
      }
      const withSlash = /\.[a-z0-9]{2,5}$/i.test(path) || path.endsWith("/") ? path : `${path}/`;
      if (live.has(withSlash)) continue;
      // Old product addresses are redirected to the closest product by the catalogue routes.
      if (CATEGORIES.some((c) => withSlash.startsWith(`/${c.slug}/`))) continue;
      const to = redirectTo.get(withSlash);
      out.push(to ? { pageId: r.id, pageTitle: r.title, pageType: r.type, href, problem: "redirect", target: to } : { pageId: r.id, pageTitle: r.title, pageType: r.type, href, problem: "missing" });
    }
  }
  return out.sort((a, b) => (a.problem === b.problem ? a.pageTitle.localeCompare(b.pageTitle) : a.problem === "missing" ? -1 : 1));
}

/* ---------- Overview ---------- */

export type OverviewRow = { id: string; title: string; type: string; path: string; report: SeoReport };

/** SEO checks for every live page and post (worst first). */
export async function seoOverview(): Promise<OverviewRow[]> {
  const rows = await db
    .select()
    .from(schema.content)
    .where(and(inArray(schema.content.status, ["published", "scheduled"]), isNull(schema.content.systemKey)));
  const out: OverviewRow[] = [];
  // In small batches: each check runs two quick queries.
  for (let i = 0; i < rows.length; i += 20) {
    const batch = await Promise.all(
      rows.slice(i, i + 20).map(async (r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        path: r.path,
        report: await checkSeo({
          id: r.id,
          type: r.type,
          title: r.title,
          path: r.path,
          body: r.body,
          layout: (Array.isArray(r.layout) ? r.layout : []) as Section[],
          excerpt: r.excerpt,
          seoTitle: r.seoTitle ?? "",
          seoDescription: r.seoDescription ?? "",
          focusKeyword: r.focusKeyword ?? "",
          robots: r.robots ?? "",
          ogImageMediaId: r.ogImageMediaId,
          aeo: r.aeo as { answer?: string },
        }),
      })),
    );
    out.push(...batch);
  }
  return out.sort((a, b) => a.report.score - b.report.score);
}

export async function notFoundList(includeIgnored = false) {
  return db
    .select()
    .from(schema.notFoundLog)
    .where(includeIgnored ? undefined : eq(schema.notFoundLog.ignored, false))
    .orderBy(sql`${schema.notFoundLog.hits} desc, ${schema.notFoundLog.lastSeen} desc`)
    .limit(300);
}

/**
 * Website health numbers for the dashboard. Checking every page takes a few seconds, so the result is kept
 * for 10 minutes (and refreshed sooner when content changes).
 */
export const siteHealth = unstable_cache(
  async () => {
    const [overview, broken, [photos], [missing]] = await Promise.all([
      seoOverview(),
      scanBrokenLinks(),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.media)
        .where(and(sql`${schema.media.mime} like 'image/%'`, eq(schema.media.placeholder, false), sql`trim(${schema.media.alt}) = ''`)),
      db
        .select({ n: sql<number>`count(*)::int`, hits: sql<number>`coalesce(sum(${schema.notFoundLog.hits}), 0)::int` })
        .from(schema.notFoundLog)
        .where(and(eq(schema.notFoundLog.ignored, false), sql`${schema.notFoundLog.lastSeen} > now() - interval '7 days'`)),
    ]);
    const scores = overview.map((o) => o.report.score);
    return {
      pages: overview.length,
      seoAverage: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      seoWeak: scores.filter((s) => s < 60).length,
      brokenLinks: broken.filter((b) => b.problem === "missing").length,
      linksViaRedirect: broken.filter((b) => b.problem === "redirect").length,
      photosWithoutDescription: photos.n,
      notFound7d: missing.n,
      notFoundHits7d: missing.hits,
      checkedAt: new Date().toISOString(),
    };
  },
  ["site-health"],
  { tags: ["content", "media"], revalidate: 600 },
);
