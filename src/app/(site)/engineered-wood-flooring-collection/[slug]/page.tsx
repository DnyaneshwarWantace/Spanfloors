import ProductView, { productMetadata, productStaticParams } from "@/views/ProductView";

export const revalidate = 300;
export const dynamicParams = true; // new Twenty products render on first visit

export function generateStaticParams() {
  return productStaticParams("engineered");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return productMetadata("engineered", (await params).slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <ProductView categoryKey="engineered" slug={(await params).slug} />;
}
