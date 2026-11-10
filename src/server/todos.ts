import "server-only";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { can } from "@/lib/permissions";
import { CATEGORIES, getAdminProducts } from "@/lib/catalog";
import type { SessionUser } from "./auth";
import { listLivePaths } from "./content";
import { newProducts } from "./product-watch";
import { siteHealth } from "./seo-audit";
import { getSettings } from "./settings";
import { getConfig } from "./site-config";

/**
 * The dashboard's to-do list: what needs doing on the website right now, each with the button that does it.
 * Items disappear once done. Only what the signed-in person can act on is shown.
 */

export type Todo = {
  id: string;
  /** "now": people are waiting (leads) · "fix": something visitors see is wrong · "setup": first-time set-up · "tidy": nice to finish. */
  kind: "now" | "fix" | "setup" | "tidy";
  title: string;
  detail?: string;
  action: string;
  href: string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** Menu links (header and footer) that point to a page that isn't live on the new site. */
async function deadMenuLinks() {
  const [header, footer, live, redirects] = await Promise.all([
    getConfig("config.header"),
    getConfig("config.footer"),
    listLivePaths(),
    db.select({ from: schema.redirects.fromPath }).from(schema.redirects),
  ]);
  const ok = new Set<string>(["/", "/blog/", "/accessories/", ...CATEGORIES.map((c) => `/${c.slug}/`), ...live.map((l) => l.path), ...redirects.map((r) => r.from)]);
  const links = [
    ...[...header.left, ...header.right].flatMap((i) => [i, ...i.children]),
    header.button,
    ...footer.columns.flatMap((c) => c.links),
    ...footer.legal,
  ].filter((l) => l.href.startsWith("/") && !l.href.startsWith("//"));
  const seen = new Set<string>();
  return links.filter((l) => {
    const path = l.href.split(/[?#]/)[0].replace(/\/?$/, "/");
    if (ok.has(path) || seen.has(path) || path.startsWith("/blog/author/") || path.startsWith("/media/")) return false;
    seen.add(path);
    return true;
  });
}

export async function adminTodos(user: SessionUser): Promise<Todo[]> {
  const out: Todo[] = [];
  const jobs: Promise<void>[] = [];
  const role = user.role;

  if (can(role, "leads")) {
    jobs.push(
      (async () => {
        const [[{ n: fresh }], [{ n: stuck }]] = await Promise.all([
          db.select({ n: count() }).from(schema.leads).where(eq(schema.leads.status, "new")),
          db.select({ n: count() }).from(schema.leads).where(and(eq(schema.leads.twentyStatus, "failed"), gt(schema.leads.twentyAttempts, 2))),
        ]);
        if (fresh) out.push({ id: "leads", kind: "now", title: `${plural(fresh, "new lead")} waiting for a reply`, action: "Open leads", href: "/admin/leads/?status=new" });
        if (stuck) out.push({ id: "twenty", kind: "fix", title: `${plural(stuck, "lead")} couldn’t be copied to Twenty yet`, detail: "They are safe here and keep retrying. Check the Twenty key if this stays.", action: "See leads", href: "/admin/leads/" });
      })(),
    );
  }

  if (can(role, "content.publish")) {
    jobs.push(
      (async () => {
        const [{ n }] = await db.select({ n: count() }).from(schema.content).where(eq(schema.content.status, "review"));
        if (n) out.push({ id: "review", kind: "now", title: `${plural(n, "post")} waiting for your review`, action: "Review", href: "/admin/content/?type=post&status=review" });
      })(),
    );
  }

  if (can(role, "settings.site")) {
    jobs.push(
      (async () => {
        const dead = await deadMenuLinks();
        if (dead.length) {
          out.push({
            id: "menu",
            kind: "fix",
            title: `The menu links to ${plural(dead.length, "page")} that ${dead.length === 1 ? "isn’t" : "aren’t"} live`,
            detail: `${dead.slice(0, 4).map((l) => `${l.label} (${l.href})`).join(", ")}${dead.length > 4 ? ` and ${dead.length - 4} more` : ""}. Visitors who click get “page not found”. Publish the page, or change the menu.`,
            action: "Open pages",
            href: `/admin/content/?type=page&q=${encodeURIComponent(dead[0].href.replace(/^\/|\/$/g, "").split("/").pop() ?? "")}`,
          });
        }
      })(),
    );
  }

  if (can(role, "products")) {
    jobs.push(
      (async () => {
        const rows = await getAdminProducts().catch(() => []);
        if (!rows.length) return;
        const fresh = await newProducts(rows);
        if (fresh.length) out.push({ id: "products", kind: "now", title: `${plural(fresh.length, "new product")} arrived from Twenty`, detail: "Check where they appear and give them a photo order.", action: "Place them", href: "/admin/products/" });
        const noCategory = rows.filter((r) => !r.categoryTitle).length;
        if (noCategory) out.push({ id: "nocat", kind: "tidy", title: `${plural(noCategory, "product")} in Twenty ${noCategory === 1 ? "has" : "have"} no category, so ${noCategory === 1 ? "it is" : "they are"} hidden`, detail: "Set the category in Twenty to show them on the website.", action: "See products", href: "/admin/products/" });
      })(),
    );
  }

  if (can(role, "content.all")) {
    jobs.push(
      (async () => {
        const h = await siteHealth().catch(() => null);
        if (!h) return;
        if (h.brokenLinks) out.push({ id: "links", kind: "fix", title: `${plural(h.brokenLinks, "link")} on the site ${h.brokenLinks === 1 ? "goes" : "go"} nowhere`, action: "Fix links", href: "/admin/seo/?tab=links" });
        if (h.notFound7d) out.push({ id: "404", kind: "fix", title: `Visitors hit ${plural(h.notFound7d, "missing page")} this week`, detail: "Send each one to the right page with a redirect.", action: "Add redirects", href: "/admin/seo/?tab=404" });
        if (h.seoWeak) out.push({ id: "seo", kind: "tidy", title: `${plural(h.seoWeak, "page")} could do better on Google`, action: "Improve", href: "/admin/seo/" });
        if (can(role, "media") && h.photosWithoutDescription) out.push({ id: "alt", kind: "tidy", title: `${plural(h.photosWithoutDescription, "photo")} without a description`, detail: "A few words on what each shows helps Google Images.", action: "Start", href: "/admin/media/?filter=noalt" });
      })(),
      (async () => {
        const missing = await db.select({ n: count() }).from(schema.authors).where(sql`trim(${schema.authors.bio}) = '' or ${schema.authors.photoMediaId} is null`);
        if (missing[0].n) out.push({ id: "authors", kind: "tidy", title: `${plural(missing[0].n, "blog author")} without a photo or bio`, action: "Add", href: "/admin/content/authors/" });
      })(),
    );
  }

  // First-time set-up (only the people who can do it).
  jobs.push(
    (async () => {
      const [me] = await db.select({ totp: schema.users.totpEnabled }).from(schema.users).where(eq(schema.users.id, user.id));
      if (!me?.totp && (role === "admin" || role === "editor")) out.push({ id: "2fa", kind: "setup", title: "Turn on two-step sign-in for your account", detail: "Two minutes with an authenticator app; a stolen password then can’t open the admin.", action: "Set up", href: "/admin/account/" });
    })(),
  );
  if (can(role, "settings.site")) {
    jobs.push(
      (async () => {
        const [studios, tracking] = await Promise.all([getConfig("config.studios"), getConfig("config.tracking")]);
        if (!studios.length) out.push({ id: "studios", kind: "setup", title: "Add your studios", detail: "Address, hours and map link; shown on the contact page and to Google.", action: "Add studios", href: "/admin/settings/site/" });
        if (can(role, "settings.integrations") && !tracking.ga4 && !tracking.gtm) out.push({ id: "tracking", kind: "setup", title: "Connect Google Analytics", detail: "Paste the GA4 or Tag Manager ID to see visitor numbers.", action: "Connect", href: "/admin/settings/site/" });
      })(),
    );
  }
  if (can(role, "settings.integrations")) {
    jobs.push(
      (async () => {
        const s = await getSettings(["email.smtpHost", "twenty.pushLeads", "allsy.apiKey"]);
        if (!s["email.smtpHost"]) out.push({ id: "email", kind: "setup", title: "Set up email", detail: "Needed for lead alerts and the customer’s automatic reply.", action: "Set up", href: "/admin/settings/integrations/" });
        if (s["twenty.pushLeads"] !== "yes") out.push({ id: "push", kind: "setup", title: "Leads aren’t being copied to Twenty", detail: "They are saved here. Switch on “Send website leads” when ready.", action: "Switch on", href: "/admin/settings/integrations/" });
        if (!s["allsy.apiKey"]) out.push({ id: "allsy", kind: "setup", title: "Connect Allsy.io for product photos", action: "Add key", href: "/admin/settings/integrations/" });
      })(),
    );
  }

  await Promise.all(jobs.map((j) => j.catch((e) => console.error("dashboard to-do failed:", e instanceof Error ? e.message : e))));
  const order = { now: 0, fix: 1, setup: 2, tidy: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
