import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { NOINDEX_SITE } from "@/server/metadata";

// Live domain: the same rules as the old spanfloors.com robots.txt, plus previews and the admin.
// Any other copy (staging, local): search engines are asked to stay out entirely.
export default function robots(): MetadataRoute.Robots {
  if (NOINDEX_SITE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", disallow: ["/wp-admin/", "/wp-content/uploads/wpforms/", "/preview/", "/admin/"], allow: ["/wp-admin/admin-ajax.php"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
