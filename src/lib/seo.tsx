import type { Metadata } from "next";
import legacySeo from "@/data/legacy-seo.json";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.spanfloors.com").replace(/\/$/, "");
export const SITE_NAME = "Span Floors";
const DEFAULT_OG_IMAGE = "/brand/span-floors-logo.png";

type LegacyEntry = { title: string | null; description: string | null; robots: string | null; h1: string | null; ogImage: string | null };
const LEGACY = legacySeo as Record<string, LegacyEntry>;

/** SEO tags that the current spanfloors.com page at this path uses (titles, descriptions, robots). */
export function legacyFor(path: string): LegacyEntry | undefined {
  return LEGACY[path];
}

function robotsFrom(value: string | null | undefined): Metadata["robots"] {
  const v = value ?? "max-image-preview:large";
  return {
    index: !/noindex/.test(v),
    follow: !/nofollow/.test(v),
    googleBot: {
      index: !/noindex/.test(v),
      follow: !/nofollow/.test(v),
      "max-image-preview": "large",
      ...(/max-snippet:-1/.test(v) ? { "max-snippet": -1 } : {}),
      ...(/max-video-preview:-1/.test(v) ? { "max-video-preview": -1 } : {}),
    },
  };
}

/**
 * Page metadata. Uses the existing spanfloors.com title/description for this exact URL when there is one,
 * so search rankings carry over; otherwise falls back to the provided values.
 */
export function pageMetadata(path: string, fallback: { title: string; description?: string; image?: string | null }): Metadata {
  const legacy = legacyFor(path);
  const title = legacy?.title ?? fallback.title;
  const description = legacy?.description ?? fallback.description;
  const image = fallback.image ?? legacy?.ogImage ?? DEFAULT_OG_IMAGE;
  const url = `${SITE_URL}${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: robotsFrom(legacy?.robots),
    openGraph: { type: "website", locale: "en_US", siteName: SITE_NAME, url, title, description, images: [{ url: image }] },
    twitter: { card: "summary_large_image", site: "@spanfloors", creator: "@spanfloors", title, description, images: [image] },
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE_URL}${it.path}` })),
  };
}
