import { fieldModes, FORM_FIELDS, FORM_LABELS, NEEDS_CONTACT, type FieldMode, type FormKey } from "@/lib/form-fields";
import "server-only";
import { cache } from "react";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { CATEGORIES } from "@/lib/categories";
import { safeHref } from "@/sections/clean";
import { mediaUrl } from "./storage";

/**
 * Site-wide settings that have a structure (menus, identity, tracking, banners, shared texts), stored as JSON
 * in the settings table. Every value is checked on save and read with defaults, so a missing or broken value
 * never breaks the site. The defaults are what the site showed before these settings existed.
 */

const link = z.object({ label: z.string().trim().max(60), href: z.string().trim().max(500) });
const menuItem = link.extend({ children: z.array(link).max(12).default([]) });

export const CONFIG = {
  "config.identity": z.object({
    logo: z.uuid().nullable().default(null),
    logoLight: z.uuid().nullable().default(null),
    favicon: z.uuid().nullable().default(null),
    shareImage: z.uuid().nullable().default(null),
  }),
  "config.contact": z.object({
    phone: z.string().trim().max(40).default("+91 92120 96387"),
    email: z.string().trim().max(120).default(""),
    social: z
      .array(z.object({ network: z.enum(["instagram", "facebook", "linkedin", "youtube", "x", "pinterest"]), url: z.string().trim().max(300) }))
      .max(8)
      .default([
        { network: "instagram", url: "https://www.instagram.com/spanfloors/" },
        { network: "facebook", url: "https://www.facebook.com/spanfloors/" },
        { network: "linkedin", url: "https://www.linkedin.com/company/span-floors-llp" },
      ]),
  }),
  "config.studios": z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        address: z.string().trim().min(1).max(400),
        city: z.string().trim().max(80).default(""),
        country: z.string().trim().max(2).default("IN"),
        phone: z.string().trim().max(40).default(""),
        hours: z.string().trim().max(120).default(""),
        mapUrl: z.string().trim().max(500).default(""),
        lat: z.number().min(-90).max(90).nullable().default(null),
        lng: z.number().min(-180).max(180).nullable().default(null),
      }),
    )
    .max(12)
    .default([]),
  "config.tracking": z.object({
    ga4: z.string().trim().regex(/^(G-[A-Z0-9]{4,14})?$/, "GA4 IDs look like G-XXXXXXX").default(""),
    gtm: z.string().trim().regex(/^(GTM-[A-Z0-9]{4,10})?$/, "Tag Manager IDs look like GTM-XXXXXX").default(""),
    metaPixel: z.string().trim().regex(/^(\d{8,20})?$/, "The Meta Pixel ID is a number").default(""),
    googleVerification: z.string().trim().max(100).default(""),
    bingVerification: z.string().trim().max(100).default(""),
    /** Ask for consent before analytics and ads cookies (recommended). */
    requireConsent: z.boolean().default(true),
  }),
  "config.cookies": z.object({
    enabled: z.boolean().default(true),
    text: z.string().trim().max(400).default("We use cookies to understand how the site is used and to improve it. You can accept or decline analytics and advertising cookies."),
    accept: z.string().trim().max(30).default("Accept"),
    decline: z.string().trim().max(30).default("Decline"),
    policy: link.default({ label: "Privacy policy", href: "/privacy-policy/" }),
  }),
  "config.announcement": z.object({
    enabled: z.boolean().default(false),
    text: z.string().trim().max(200).default(""),
    link: link.default({ label: "", href: "" }),
    /** ISO date-time; the bar stops showing after it. */
    until: z.string().trim().max(40).default(""),
    tone: z.enum(["dark", "brand", "light"]).default("dark"),
  }),
  "config.header": z.object({
    left: z.array(menuItem).max(10),
    right: z.array(menuItem).max(10),
    button: link.default({ label: "", href: "" }),
  }),
  "config.footer": z.object({
    columns: z.array(z.object({ title: z.string().trim().max(40), links: z.array(link).max(15) })).max(8),
    legal: z.array(link).max(8),
    showSubscribe: z.boolean().default(true),
    copyright: z.string().trim().max(120).default("© {year} Span Floors. All rights reserved."),
  }),
  "config.texts": z.record(z.string(), z.string().max(300)).default({}),
  /** Per website form: extra fields set to optional, required or hidden (see lib/form-fields). */
  "config.forms": z.record(z.string(), z.record(z.string(), z.enum(["optional", "required", "hidden"]))).default({}),
} as const;

export type ConfigKey = keyof typeof CONFIG;
export type Config<K extends ConfigKey> = z.infer<(typeof CONFIG)[K]>;
export type MenuItem = z.infer<typeof menuItem>;
export type MenuLink = z.infer<typeof link>;

const DEFAULTS: { [K in ConfigKey]: Config<K> } = {
  "config.identity": CONFIG["config.identity"].parse({}),
  "config.contact": CONFIG["config.contact"].parse({}),
  "config.studios": [],
  "config.tracking": CONFIG["config.tracking"].parse({}),
  "config.cookies": CONFIG["config.cookies"].parse({}),
  "config.announcement": CONFIG["config.announcement"].parse({}),
  "config.header": {
    left: [
      { href: "/engineered-wood-flooring-collection/", label: "Wood Flooring", children: [] },
      { href: "/laminate-flooring-collection/", label: "Laminate", children: [] },
      { href: "/decking-collection/", label: "Decking", children: [] },
      { href: "/facades-collection/", label: "Facades", children: [] },
      { href: "/accessories/", label: "Accessories", children: [] },
    ],
    right: [
      { href: "/projects/", label: "Projects", children: [] },
      { href: "/about-spanfloors/", label: "About", children: [] },
      { href: "/dealer/", label: "Dealers", children: [] },
      { href: "/contact-us/", label: "Contact", children: [] },
    ],
    button: { label: "", href: "" },
  },
  "config.footer": {
    columns: [
      { title: "Products", links: CATEGORIES.map((c) => ({ href: `/${c.slug}/`, label: c.title })) },
      { title: "Inspiration", links: [{ href: "/projects/", label: "Projects" }, { href: "/engineered-wood-flooring-gallery/", label: "Flooring Gallery" }, { href: "/decking-gallery/", label: "Decking Gallery" }, { href: "/cladding-gallery/", label: "Cladding Gallery" }] },
      { title: "About", links: [{ href: "/about-spanfloors/", label: "Our Story" }, { href: "/why-span-floors/", label: "Why Span Floors" }, { href: "/news/", label: "News" }, { href: "/media/", label: "Media" }] },
      { title: "Professionals", links: [{ href: "/architect/", label: "Architects" }, { href: "/dealer/", label: "Become a Dealer" }, { href: "/be-a-partner/", label: "Partner With Us" }] },
      { title: "Resources", links: [{ href: "/downloads/", label: "Downloads" }, { href: "/wooden-flooring-101-guide/", label: "Flooring 101" }, { href: "/downloads/educational-videos/", label: "Videos" }] },
      { title: "Regions", links: [{ href: "/dubai/", label: "Dubai" }, { href: "/nepal/", label: "Nepal" }, { href: "/bhutan/", label: "Bhutan" }] },
    ],
    legal: [
      { href: "/privacy-policy/", label: "Privacy Policy" },
      { href: "/client-behaviour-policy/", label: "Client Policy" },
    ],
    showSubscribe: true,
    copyright: "© {year} Span Floors. All rights reserved.",
  },
  "config.texts": {},
  "config.forms": {},
};

/** Words used on many pages. Editors change them in Admin → Shared texts; these are the defaults. */
export const TEXT_DEFAULTS = {
  "form.submit.enquiry": "Send enquiry",
  "form.submit.sample": "Request samples",
  "form.submit.download": "Get the download",
  "form.submit.dealer": "Apply to become a dealer",
  "form.submit.video_call": "Book the video call",
  "form.submit.visit": "Book the visit",
  "form.done.enquiry": "Thank you. Our team will call you shortly.",
  "form.done.sample": "Thank you. We'll confirm your samples and delivery by phone.",
  "form.done.download": "Thank you. Your download is ready below.",
  "form.done.dealer": "Thank you. Our partnerships team will contact you.",
  "form.done.video_call": "Booked. You'll get a confirmation with the call details.",
  "form.done.visit": "Booked. We look forward to seeing you at the studio.",
  "form.privacy": "We use your details only to reply to you.",
  "form.error": "Something went wrong. Please try again, or call us.",
  "footer.subscribe": "Subscribe",
  "footer.emailPlaceholder": "Email*",
  "blog.more": "More from the blog",
  "blog.all": "All articles",
  "notFound.title": "Page not found",
  "notFound.text": "The page you were looking for has moved or no longer exists.",
  "menu.products": "Products",
  "menu.follow": "Follow",
  "home.introButton": "Our Story",
  "home.surfaces": "Our Surfaces",
  "home.projects": "Span Floors Projects",
  "home.samplesTitle": "Free Samples",
  "home.samplesText": "See and feel our floors at home. Order up to five free samples and we will deliver them to your door.",
  "home.samplesButton": "Order Samples",
  "home.studioButton": "Visit a Studio",
  "home.featuredCollection": "Featured Collection:",
  "home.videos": "Featured Video",
  "home.videoButton": "Watch video",
  "home.blog": "From the Blog",
  "home.blogButton": "View all articles",
  "home.resources": "Featured Resources",
  "home.resourcesButton": "Browse all files",
  "home.adviceTitle": "Specialist Advice",
  "home.adviceText": "Not sure which floor suits your space? Talk to our flooring advisors, visit a studio, or book a video call with our architects' team.",
  "home.videoCallButton": "Book a Video Call",
  "product.samples": "Free samples, delivered across India",
  "product.comingSoon": "This range is being photographed. Contact us for the full catalogue and samples.",
  "product.enquire": "Enquire Now",
  "product.similar": "Similar Products",
} as const;

export type TextKey = keyof typeof TEXT_DEFAULTS;
export const TEXT_LABELS: Record<string, string> = {
  form: "Forms",
  footer: "Footer",
  blog: "Blog",
  notFound: "Page not found",
  menu: "Menus",
  home: "Home page",
  product: "Product pages",
};

const load = cache(async () => {
  const keys = Object.keys(CONFIG) as ConfigKey[];
  const rows = await db.select().from(schema.settings).where(inArray(schema.settings.key, keys)).catch(() => []);
  return new Map(rows.map((r) => [r.key, r.value]));
});

/** A structured setting with its defaults filled in (never throws). */
export async function getConfig<K extends ConfigKey>(key: K): Promise<Config<K>> {
  const raw = (await load()).get(key);
  if (raw == null) return DEFAULTS[key];
  const value = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  const parsed = CONFIG[key].safeParse(value);
  return (parsed.success ? parsed.data : DEFAULTS[key]) as Config<K>;
}

export async function getTexts(): Promise<Record<TextKey, string>> {
  const saved = await getConfig("config.texts");
  return Object.fromEntries((Object.keys(TEXT_DEFAULTS) as TextKey[]).map((k) => [k, saved[k]?.trim() || TEXT_DEFAULTS[k]])) as Record<TextKey, string>;
}

/** Validates a value for saving: menu and button links must be safe; unknown text keys are dropped. */
export function validateConfig<K extends ConfigKey>(key: K, value: unknown): { ok: true; value: Config<K> } | { ok: false; error: string } {
  const parsed = CONFIG[key].safeParse(value);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `${i.path.join(" › ") || "Value"}: ${i.message}` };
  }
  let v = parsed.data as Config<K>;
  const fixLink = (l: MenuLink) => ({ label: l.label, href: l.href ? safeHref(l.href) : "" });
  if (key === "config.header") {
    const h = v as Config<"config.header">;
    const items = (list: MenuItem[]) => list.filter((i) => i.label && i.href).map((i) => ({ ...fixLink(i), children: i.children.filter((c) => c.label && c.href).map(fixLink) }));
    v = { left: items(h.left), right: items(h.right), button: fixLink(h.button) } as Config<K>;
  }
  if (key === "config.footer") {
    const f = v as Config<"config.footer">;
    v = { ...f, columns: f.columns.filter((c) => c.title).map((c) => ({ title: c.title, links: c.links.filter((l) => l.label && l.href).map(fixLink) })), legal: f.legal.filter((l) => l.label && l.href).map(fixLink) } as Config<K>;
  }
  if (key === "config.announcement") {
    const a = v as Config<"config.announcement">;
    v = { ...a, link: fixLink(a.link) } as Config<K>;
  }
  if (key === "config.cookies") {
    const c = v as Config<"config.cookies">;
    v = { ...c, policy: fixLink(c.policy) } as Config<K>;
  }
  if (key === "config.contact") {
    const c = v as Config<"config.contact">;
    v = { ...c, social: c.social.filter((s) => /^https:\/\//.test(s.url)) } as Config<K>;
  }
  if (key === "config.studios") {
    const st = v as Config<"config.studios">;
    v = st.map((s) => ({ ...s, mapUrl: /^https:\/\//.test(s.mapUrl) ? s.mapUrl : "" })) as Config<K>;
  }
  if (key === "config.texts") {
    const t = v as Record<string, string>;
    v = Object.fromEntries(Object.entries(t).filter(([k, x]) => k in TEXT_DEFAULTS && x.trim())) as Config<K>;
  }
  if (key === "config.forms") {
    const f = v as Config<"config.forms">;
    const out: Record<string, Record<string, FieldMode>> = {};
    for (const form of Object.keys(FORM_FIELDS) as FormKey[]) {
      if (!f[form]) continue;
      if (NEEDS_CONTACT.includes(form) && f[form].phone === "hidden" && f[form].email === "hidden") {
        return { ok: false, error: `${FORM_LABELS[form]}: keep phone or email visible so the team can reply.` };
      }
      out[form] = fieldModes(f, form);
    }
    v = out as Config<K>;
  }
  return { ok: true, value: v };
}

/** URLs for the identity images (logo, icon, default share image) that are set. */
export async function identityUrls() {
  const id = await getConfig("config.identity");
  const ids = [id.logo, id.logoLight, id.favicon, id.shareImage].filter((x): x is string => Boolean(x));
  const rows = ids.length ? await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(inArray(schema.media.id, ids)).catch(() => []) : [];
  const url = (mid: string | null) => {
    const r = mid ? rows.find((x) => x.id === mid) : null;
    return r ? mediaUrl(r.path) : null;
  };
  return { logo: url(id.logo), logoLight: url(id.logoLight), favicon: url(id.favicon), shareImage: url(id.shareImage) };
}
