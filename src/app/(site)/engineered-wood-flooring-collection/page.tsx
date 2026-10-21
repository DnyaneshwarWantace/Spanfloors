import CategoryView, { categoryMetadata } from "@/views/CategoryView";

// Rendered per request (the build has no API keys); Twenty data itself is cached for 5 minutes.
export const dynamic = "force-dynamic";
export const metadata = categoryMetadata("engineered");

export default function Page() {
  return <CategoryView categoryKey="engineered" />;
}
