import Link from "next/link";
import type { Config, TextKey } from "@/server/site-config";

/* The site footer. Columns and legal links come from Admin → Menus; social links from Site settings. */

const SOCIAL_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube", x: "X", pinterest: "Pinterest" };
const external = (href: string) => /^(https?:|mailto:|tel:)/.test(href);

function FooterLink({ href, label }: { href: string; label: string }) {
  return external(href) ? (
    <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})} className="text-paper/75 hover:text-paper">
      {label}
    </a>
  ) : (
    <Link href={href} className="text-paper/75 hover:text-paper">
      {label}
    </Link>
  );
}

export default function Footer({
  footer,
  contact,
  logo,
  texts,
}: {
  footer: Config<"config.footer">;
  contact: Config<"config.contact">;
  logo: string | null;
  texts: Record<TextKey, string>;
}) {
  const cols = [...footer.columns, ...(contact.social.length ? [{ title: "Follow", links: contact.social.map((s) => ({ href: s.url, label: SOCIAL_LABEL[s.network] ?? s.network })) }] : [])];
  return (
    <footer className="bg-ink px-gap pt-20 pb-gap text-paper">
      <div className="grid grid-cols-2 gap-gap text-2xs lg:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.6fr)]">
        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-2xs font-semibold tracking-[0.06em] uppercase">{col.title}</h4>
            <ul className="grid gap-[0.35rem]">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <FooterLink {...l} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {footer.showSubscribe && (
          <div className="col-span-2 lg:col-span-1">
            <h4 className="mb-4 text-2xs font-semibold tracking-[0.06em] uppercase">{texts["footer.subscribe"]}</h4>
            <form className="flex border-b border-line-light">
              <label className="sr-only" htmlFor="footer-email">
                Email
              </label>
              <input id="footer-email" type="email" placeholder={texts["footer.emailPlaceholder"]} className="min-w-0 flex-1 bg-transparent py-2.5 text-paper outline-none placeholder:text-paper/50" />
              <button type="button" className="text-2xs tracking-[0.08em] uppercase">
                {texts["footer.subscribe"]}
              </button>
            </form>
          </div>
        )}
      </div>
      <div className="mt-24 grid items-end gap-gap text-2xs text-paper/50 lg:grid-cols-[1fr_auto_1fr]">
        <span>{footer.copyright.replace("{year}", String(new Date().getFullYear()))}</span>
        <img src={logo ?? "/brand/span-floors-logo.png"} alt="Span Floors" width={155} height={82} className="h-14 w-auto" />
        <div className="flex flex-wrap gap-6 lg:justify-end">
          {footer.legal.map((l) => (
            <Link key={l.href + l.label} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
