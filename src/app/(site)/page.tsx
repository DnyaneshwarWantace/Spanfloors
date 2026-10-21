import CategoryView from "@/views/CategoryView";
import { pageMetadata } from "@/lib/seo";

// Rendered per request (the build has no API keys); Twenty data itself is cached for 5 minutes.
export const dynamic = "force-dynamic";

// Homepage keeps the current spanfloors.com title/description (from legacy SEO data).
export const metadata = pageMetadata("/", {
  title: "Wooden Flooring, Decks & Facades in India | Get Free Samples",
  description: "Premium engineered wood flooring, decking and facades by Span Floors.",
});

// Temporary: the full product catalogue. Hero and marketing sections return with the client's final design.
export default function Home() {
  return <CategoryView />;
}
