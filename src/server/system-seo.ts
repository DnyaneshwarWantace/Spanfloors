import "server-only";
import type { Metadata } from "next";
import { getSystemPage, type SystemKey } from "./content";
import { buildMetadata } from "./metadata";

/**
 * Metadata for a fixed site page (home, blog, collections, accessories): what an editor set on the page's
 * record in the admin wins; otherwise the old spanfloors.com values for this URL, then the given fallback.
 */
export async function systemMetadata(key: SystemKey, path: string, fallback: { title: string; description?: string; kicker?: string }): Promise<Metadata> {
  const rec = await getSystemPage(key);
  return buildMetadata({
    path,
    title: fallback.title.replace(/\s*[|-]\s*Span Floors$/, ""),
    description: fallback.description,
    seoTitle: rec?.seoTitle,
    fallbackTitle: fallback.title,
    seoDescription: rec?.seoDescription,
    robots: rec?.robots,
    canonical: rec?.canonicalUrl,
    ogTitle: rec?.ogTitle,
    ogDescription: rec?.ogDescription,
    ogImage: rec?.ogImage,
    kicker: fallback.kicker ?? "Span Floors",
  });
}
