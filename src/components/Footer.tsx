import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";

const COLS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  { title: "Products", links: CATEGORIES.map((c) => ({ href: `/${c.slug}/`, label: c.title })) },
  {
    title: "Inspiration",
    links: [
      { href: "/projects/", label: "Projects" },
      { href: "/engineered-wood-flooring-gallery/", label: "Flooring Gallery" },
      { href: "/decking-gallery/", label: "Decking Gallery" },
      { href: "/cladding-gallery/", label: "Cladding Gallery" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about-spanfloors/", label: "Our Story" },
      { href: "/why-span-floors/", label: "Why Span Floors" },
      { href: "/news/", label: "News" },
      { href: "/media/", label: "Media" },
    ],
  },
  {
    title: "Professionals",
    links: [
      { href: "/architect/", label: "Architects" },
      { href: "/dealer/", label: "Become a Dealer" },
      { href: "/be-a-partner/", label: "Partner With Us" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/downloads/", label: "Downloads" },
      { href: "/wooden-flooring-101-guide/", label: "Flooring 101" },
      { href: "/downloads/educational-videos/", label: "Videos" },
    ],
  },
  {
    title: "Regions",
    links: [
      { href: "/dubai/", label: "Dubai" },
      { href: "/nepal/", label: "Nepal" },
      { href: "/bhutan/", label: "Bhutan" },
    ],
  },
  {
    title: "Follow",
    links: [
      { href: "https://www.instagram.com/spanfloors/", label: "Instagram", external: true },
      { href: "https://www.facebook.com/spanfloors/", label: "Facebook", external: true },
      { href: "https://www.linkedin.com/company/span-floors-llp", label: "LinkedIn", external: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink px-gap pt-20 pb-gap text-paper">
      <div className="grid grid-cols-2 gap-gap text-2xs lg:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.6fr)]">
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-2xs font-semibold tracking-[0.06em] uppercase">{col.title}</h4>
            <ul className="grid gap-[0.35rem]">
              {col.links.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener" className="text-paper/75 hover:text-paper">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-paper/75 hover:text-paper">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="col-span-2 lg:col-span-1">
          <h4 className="mb-4 text-2xs font-semibold tracking-[0.06em] uppercase">Subscribe</h4>
          <form className="flex border-b border-line-light">
            <label className="sr-only" htmlFor="footer-email">
              Email
            </label>
            <input id="footer-email" type="email" placeholder="Email*" className="min-w-0 flex-1 bg-transparent py-2.5 text-paper outline-none placeholder:text-paper/50" />
            <button type="button" className="text-2xs tracking-[0.08em] uppercase">
              Subscribe
            </button>
          </form>
        </div>
      </div>
      <div className="mt-24 grid items-end gap-gap text-2xs text-paper/50 lg:grid-cols-[1fr_auto_1fr]">
        <span>© {new Date().getFullYear()} Span Floors. All rights reserved.</span>
        <img src="/brand/span-floors-logo.png" alt="Span Floors" width={155} height={82} className="h-14 w-auto" />
        <div className="flex flex-wrap gap-6 lg:justify-end">
          <Link href="/privacy-policy/">Privacy Policy</Link>
          <Link href="/client-behaviour-policy/">Client Policy</Link>
        </div>
      </div>
    </footer>
  );
}
