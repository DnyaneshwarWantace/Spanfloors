import CategoryView, { categoryMetadata } from "@/views/CategoryView";

export const revalidate = 300;
export const metadata = categoryMetadata("laminate");

export default function Page() {
  return <CategoryView categoryKey="laminate" />;
}
