import type { MetadataRoute } from "next";
import { CATEGORIES, getCatalog } from "@/lib/catalog";
import { SITE_URL } from "@/lib/seo";
import { listLivePaths } from "@/server/content";

// Rendered per request (the build has no API keys); Twenty data itself is cached for 5 minutes.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, pages] = await Promise.all([getCatalog().catch(() => []), listLivePaths().catch(() => [])]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/${c.slug}/`, changeFrequency: "daily" as const, priority: 0.8 })),
    { url: `${SITE_URL}/blog/`, changeFrequency: "weekly" as const, priority: 0.6 },
    ...pages
      .filter((p) => p.path !== "/" && !/noindex/.test(p.robots ?? ""))
      .map((p) => ({ url: `${SITE_URL}${p.path}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: p.type === "post" ? 0.6 : 0.5 })),
    ...products.map((p) => ({ url: `${SITE_URL}${p.href}`, lastModified: new Date(p.updatedAt), changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
