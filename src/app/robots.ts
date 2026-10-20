import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Same rules as the current spanfloors.com robots.txt.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/wp-admin/", "/wp-content/uploads/wpforms/"], allow: ["/wp-admin/admin-ajax.php"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
