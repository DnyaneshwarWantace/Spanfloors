import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { ResolvedMedia } from "../resolve";
import { sized, srcSet } from "@/lib/img";
import type { LinkValue, Section } from "../types";

/* Small building blocks shared by the section components. Restyle these first when the final design arrives. */

const THEME: Record<string, string> = {
  default: "bg-paper text-ink",
  muted: "bg-paper-2 text-ink",
  dark: "bg-ink text-paper",
};
const SPACING: Record<string, string> = {
  compact: "py-8 md:py-10",
  normal: "py-14 md:py-20",
  spacious: "py-20 md:py-32",
};

export function Shell({ section, children, flush = false }: { section: Section; children: ReactNode; flush?: boolean }) {
  return (
    <section
      id={section.anchor || undefined}
      data-section={section.type}
      className={`${THEME[section.theme ?? "default"]} ${flush ? "" : SPACING[section.spacing ?? "normal"]} ${section.anchor ? "scroll-mt-[calc(var(--spacing-header)+1rem)]" : ""}`}
    >
      {children}
    </section>
  );
}

export function Heading({ kicker, heading, intro, level = 2, center = false, dark = false }: { kicker?: unknown; heading?: unknown; intro?: unknown; level?: 1 | 2; center?: boolean; dark?: boolean }) {
  if (!kicker && !heading && !intro) return null;
  const H = level === 1 ? "h1" : "h2";
  return (
    <div className={`mb-8 grid max-w-3xl gap-3 md:mb-10 ${center ? "mx-auto text-center" : ""}`}>
      {typeof kicker === "string" && kicker && <p className={`text-2xs tracking-[0.08em] uppercase ${dark ? "text-paper/60" : "text-muted"}`}>{kicker}</p>}
      {typeof heading === "string" && heading && <H className={level === 1 ? "mono text-display" : "mono text-title md:text-lead"}>{heading}</H>}
      {typeof intro === "string" && intro && <p className={`whitespace-pre-line leading-relaxed ${dark ? "text-paper/75" : "text-ink-2"}`}>{intro}</p>}
    </div>
  );
}

/** A photo filling its box, cropped around the focal point chosen in the media library (or shown whole). */
export function Img({ m, className = "", sizes, priority = false, style }: { m: ResolvedMedia | undefined; className?: string; sizes?: string; priority?: boolean; style?: CSSProperties }) {
  if (!m) return null;
  return (
    <img
      src={sized(m.url, 1280, m.version)}
      srcSet={srcSet(m.url, m.width, m.version)}
      alt={m.alt}
      width={m.width ?? undefined}
      height={m.height ?? undefined}
      sizes={sizes ?? "100vw"}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
      style={{ objectFit: m.fit, objectPosition: `${m.focalX}% ${m.focalY}%`, ...style }}
    />
  );
}

export function isLink(v: unknown): v is LinkValue {
  return Boolean(v) && typeof (v as LinkValue).href === "string" && Boolean((v as LinkValue).href) && Boolean((v as LinkValue).label);
}

const external = (href: string) => /^(https?:|mailto:|tel:)/i.test(href);

export function SmartLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (external(href)) {
    const web = /^https?:/i.test(href);
    return (
      <a href={href} className={className} {...(web ? { target: "_blank", rel: "noopener" } : {})}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Button({ link, variant = "primary", dark = false }: { link: unknown; variant?: "primary" | "secondary"; dark?: boolean }) {
  if (!isLink(link)) return null;
  const cls =
    variant === "primary"
      ? dark
        ? "inline-flex h-11 items-center border border-paper bg-paper px-5 text-2xs text-ink transition-colors hover:bg-transparent hover:text-paper"
        : "inline-flex h-11 items-center border border-ink bg-ink px-5 text-2xs text-paper transition-colors hover:bg-transparent hover:text-ink"
      : dark
        ? "inline-flex h-11 items-center border border-paper/60 px-5 text-2xs text-paper transition-colors hover:border-paper"
        : "inline-flex h-11 items-center border border-ink/40 px-5 text-2xs transition-colors hover:border-ink";
  return (
    <SmartLink href={link.href} className={cls}>
      {link.label}
    </SmartLink>
  );
}

export const text = (v: unknown) => (typeof v === "string" ? v : "");
export const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
