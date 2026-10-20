import CategoryView, { categoryMetadata } from "@/views/CategoryView";

export const revalidate = 300;
export const metadata = categoryMetadata("facades");

export default function Page() {
  return <CategoryView categoryKey="facades" />;
}
