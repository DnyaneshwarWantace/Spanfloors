import "server-only";
import { existsSync } from "node:fs";
import type { Metadata } from "next";
import { legacyFor, robotsFrom, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getSetting } from "./settings";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveStored } from "./storage";
import { identityUrls } from "./site-config";

/**
 * One place for every page's title, description, canonical address, search-engine rules and share card.
 *
 * Order of precedence: what an editor set in the admin → the old spanfloors.com values for this URL (so
 * rankings carry over) → the page's own title and text. Pages without a chosen share image get a branded
 * card from /og/ with the page's own photo.
 */

/** Search engines are kept out of every copy of the site except the live domain (staging, previews, local). */
export const NOINDEX_SITE =
  process.env.NEXT_PUBLIC_NOINDEX === "true" ||
  (process.env.NEXT_PUBLIC_NOINDEX !== "false" && !/(^|\.)spanfloors\.com$/.test(new URL(SITE_URL).hostname));

export type MetaInput = {
  /** Public path with trailing slash, e.g. "/about-spanfloors/". */
  path: string;
  /** The page's own title (used for the card and as the last fallback). */
  title: string;
  description?: string | null;
  seoTitle?: string | null;
  /** Full title to use when nothing was set in the admin and the old site had none. */
  fallbackTitle?: string;
  seoDescription?: string | null;
  robots?: string | null;
  canonical?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  /** Share image chosen in the admin (/media/… address). */
  ogImage?: string | null;
  /** The page's own main photo, used inside the automatic share card. */
  photo?: string | null;
  /** Small label on the automatic share card, e.g. "Decking" or "Blog". */
  kicker?: string;
  type?: "website" | "article";
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
  author?: string | null;
};

const abs = (url: string) => (/^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`);

/** Photos marked "placeholder" in the media library are never used in share cards. */
const placeholderPaths = cache(async () => {
  const rows = await db.select({ path: schema.media.path }).from(schema.media).where(eq(schema.media.placeholder, true)).catch(() => []);
  return new Set(rows.map((r) => r.path));
});

/** /media/… addresses only count when the file is on this server and isn't a placeholder. */
async function localMedia(url: string | null | undefined) {
  if (!url?.startsWith("/media/")) return null;
  const rel = decodeURIComponent(url.slice("/media/".length).split("?")[0]);
  const full = resolveStored(rel);
  if (!full || !existsSync(full)) return null;
  return (await placeholderPaths()).has(rel) ? null : url;
}

/** Old WordPress image addresses (spanfloors.com/wp-content/uploads/…) are served from /media/wp/ now. */
async function fromLegacy(url: string | null | undefined) {
  const m = url?.match(/\/wp-content\/uploads\/(.+)$/);
  return m ? localMedia(`/media/wp/${m[1]}`) : null;
}

export function shareCardUrl(title: string, kicker?: string, photo?: string | null) {
  const q = new URLSearchParams({ title: title.slice(0, 110), ...(kicker ? { kicker } : {}), ...(photo ? { img: photo } : {}) });
  return `/og/?${q}`;
}

export async function buildMetadata(m: MetaInput): Promise<Metadata> {
  const legacy = legacyFor(m.path);
  const title = m.seoTitle?.trim() || legacy?.title || m.fallbackTitle || `${m.title} - ${SITE_NAME}`;
  const fallbackDescription = m.description?.trim() || (await getSetting("seo.defaultDescription")) || undefined;
  const description = (m.seoDescription?.trim() || legacy?.description || fallbackDescription)?.slice(0, 320);
  const url = `${SITE_URL}${m.path}`;
  const canonical = m.canonical?.trim() || url;
  const shareTitle = m.ogTitle?.trim() || title;
  const shareDescription = (m.ogDescription?.trim() || description)?.slice(0, 300);
  const photo = (await localMedia(m.photo)) ?? (await fromLegacy(legacy?.ogImage)) ?? (await localMedia((await identityUrls()).shareImage));
  const chosen = await localMedia(m.ogImage);
  const image = chosen ?? shareCardUrl(m.title, m.kicker, photo);
  const robots = robotsFrom(NOINDEX_SITE ? "noindex, nofollow" : (m.robots ?? legacy?.robots));

  return {
    title: { absolute: title },
    description,
    alternates: { canonical, languages: { "en-IN": url, "x-default": url } },
    robots,
    openGraph: {
      type: m.type ?? "website",
      locale: "en_IN",
      siteName: SITE_NAME,
      url,
      title: shareTitle,
      description: shareDescription,
      // The automatic card is always 1200 × 630; a chosen image keeps its own size.
      images: [{ url: abs(image), ...(chosen ? {} : { width: 1200, height: 630 }), alt: shareTitle }],
      ...(m.type === "article"
        ? {
            publishedTime: m.publishedTime?.toISOString(),
            modifiedTime: m.modifiedTime?.toISOString(),
            ...(m.author ? { authors: [m.author] } : {}),
          }
        : {}),
    },
    twitter: { card: "summary_large_image", site: "@spanfloors", title: shareTitle, description: shareDescription, images: [abs(image)] },
  };
}
