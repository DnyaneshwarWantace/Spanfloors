import Link from "next/link";
import ProductMedia from "./ProductMedia";

export type CardProduct = {
  id: string;
  href: string;
  name: string;
  subtitle: string;
  image: string | null;
  tone: string | null;
};

export default function ProductCard({ p, dark = false }: { p: CardProduct; dark?: boolean }) {
  return (
    <Link href={p.href} className="group card-cv block">
      <div className="relative aspect-[5/6] overflow-hidden bg-paper-2">
        <div className="absolute inset-0 transition-transform duration-[1200ms] ease-butter group-hover:scale-[1.03]">
          <ProductMedia src={p.image} alt={p.name} tone={p.tone} />
        </div>
        <span aria-hidden="true" className="absolute top-2.5 right-2.5 z-10 grid size-[1.6rem] place-items-center bg-ink/70 text-base leading-none text-paper">
          +
        </span>
      </div>
      <div className="pt-3 text-2xs">
        <div className={`text-card ${dark ? "text-paper" : "text-ink"}`}>{p.name}</div>
        {p.subtitle && <div className="mt-0.5 text-muted">{p.subtitle}</div>}
      </div>
    </Link>
  );
}
