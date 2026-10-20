import CategoryView, { categoryMetadata } from "@/views/CategoryView";

export const revalidate = 300;
export const metadata = categoryMetadata("engineered");

export default function Page() {
  return <CategoryView categoryKey="engineered" />;
}
