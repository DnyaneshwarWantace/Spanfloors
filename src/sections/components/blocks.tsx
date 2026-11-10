import Link from "next/link";
import ArticleBody from "@/components/ArticleBody";
import CardsSlider from "@/components/CardsSlider";
import ProductCard from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/categories";
import type { Resolved } from "../resolve";
import type { LinkValue, Section } from "../types";
import { parseVideo } from "../video";
import { sized } from "@/lib/img";
import GallerySlider from "./GallerySlider";
import { Button, Heading, Img, isLink, list, Shell, SmartLink, text } from "./parts";
import SiteForm, { type FormType } from "./SiteForm";
import VideoEmbed from "./VideoEmbed";

/* One component per section type. Plain, restylable markup using the site's current tokens. */

export type BlockProps = {
  section: Section;
  r: Resolved;
  /** Extras some sections need: studios from Site settings, products for the samples form. */
  ctx: BlockContext;
};

export type BlockContext = {
  studios: { name: string; address: string; phone?: string; hours?: string; mapUrl?: string }[];
  sampleProducts: { id: string; name: string }[];
  /** Admin → Forms field settings. */
  formsConfig?: Record<string, Record<string, string>>;
  /** Words from Admin → Shared texts used by forms. */
  texts: Record<string, string>;
  /** True for the first visible section (eager-load its photo). */
  first: boolean;
  preview: boolean;
};

const d = (s: Section) => s.data as Record<string, unknown>;
type Item = Record<string, unknown> & { id: string };

function Hero({ section, r, ctx }: BlockProps) {
  const x = d(section);
  const img = typeof x.image === "string" ? r.media.get(x.image) : undefined;
  const video = parseVideo(x.video);
  const style = text(x.style) || "full";
  const buttons = (dark: boolean) =>
    (isLink(x.primary) || isLink(x.secondary)) && (
      <div className="mt-6 flex flex-wrap gap-3">
        <Button link={x.primary} dark={dark} />
        <Button link={x.secondary} variant="secondary" dark={dark} />
      </div>
    );

  if (style === "full" && (img || video)) {
    return (
      <Shell section={{ ...section, theme: "dark" }} flush>
        <div className="relative isolate flex min-h-[70svh] items-end overflow-hidden px-gap pt-24 pb-12 md:pb-16">
          <Img m={img} priority={ctx.first} sizes="100vw" className="absolute inset-0 -z-20 size-full" />
          {video?.provider === "youtube" && (
            <iframe
              aria-hidden="true"
              tabIndex={-1}
              title=""
              src={`${video.embed}?autoplay=1&mute=1&loop=1&playlist=${video.id}&controls=0&modestbranding=1&playsinline=1`}
              allow="autoplay; encrypted-media"
              className="pointer-events-none absolute top-1/2 left-1/2 -z-10 aspect-video min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 border-0 motion-reduce:hidden"
            />
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
          <div className="max-w-3xl">
            {text(x.kicker) && <p className="mb-3 text-2xs tracking-[0.08em] text-paper/75 uppercase">{text(x.kicker)}</p>}
            <h1 className="mono text-display text-paper">{text(x.heading)}</h1>
            {text(x.intro) && <p className="mt-4 max-w-xl text-body leading-relaxed whitespace-pre-line text-paper/85">{text(x.intro)}</p>}
            {buttons(true)}
          </div>
        </div>
      </Shell>
    );
  }

  if (style === "split" && img) {
    return (
      <Shell section={section}>
        <div className="grid items-center gap-gap px-gap md:grid-cols-2">
          <div>
            {text(x.kicker) && <p className="mb-3 text-2xs tracking-[0.08em] text-muted uppercase">{text(x.kicker)}</p>}
            <h1 className="mono text-display">{text(x.heading)}</h1>
            {text(x.intro) && <p className="mt-4 max-w-xl leading-relaxed whitespace-pre-line text-ink-2">{text(x.intro)}</p>}
            {buttons(section.theme === "dark")}
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
            <Img m={img} priority={ctx.first} sizes="(min-width: 768px) 50vw, 100vw" className="absolute inset-0 size-full" />
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading kicker={x.kicker} heading={x.heading} intro={x.intro} level={1} dark={section.theme === "dark"} />
        {buttons(section.theme === "dark")}
      </div>
    </Shell>
  );
}

function TextBlock({ section }: BlockProps) {
  const x = d(section);
  const wide = text(x.width) === "wide";
  return (
    <Shell section={section}>
      <div className={`px-gap ${wide ? "" : "mx-auto max-w-3xl"}`}>
        <Heading kicker={x.kicker} heading={x.heading} dark={section.theme === "dark"} />
        <ArticleBody html={text(x.body)} />
      </div>
    </Shell>
  );
}

function MediaText({ section, r }: BlockProps) {
  const x = d(section);
  const img = typeof x.image === "string" ? r.media.get(x.image) : undefined;
  const right = text(x.side) === "right";
  return (
    <Shell section={section}>
      <div className="grid items-center gap-gap px-gap md:grid-cols-2">
        <div className={`relative aspect-[4/3] overflow-hidden bg-paper-2 ${right ? "md:order-2" : ""}`}>
          <Img m={img} sizes="(min-width: 768px) 50vw, 100vw" className="absolute inset-0 size-full" />
        </div>
        <div className="md:px-6">
          <Heading kicker={x.kicker} heading={x.heading} dark={section.theme === "dark"} />
          {text(x.body) && <ArticleBody html={text(x.body)} />}
          {isLink(x.button) && (
            <div className="mt-6">
              <Button link={x.button} dark={section.theme === "dark"} />
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Gallery({ section, r }: BlockProps) {
  const x = d(section);
  const photos = list<string>(x.images)
    .map((id) => r.media.get(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m && m.mime.startsWith("image/")));
  if (!photos.length) return null;
  const captions = x.captions === true;
  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading heading={x.heading} dark={section.theme === "dark"} />
        {text(x.style) === "slider" ? (
          <GallerySlider captions={captions} photos={photos.map((m) => ({ id: m.id, url: m.url, alt: m.alt, caption: m.caption, focalX: m.focalX, focalY: m.focalY, fit: m.fit, width: m.width, version: m.version }))} />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4">
            {photos.map((m) => (
              <figure key={m.id}>
                <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
                  <Img m={m} sizes="(min-width: 768px) 33vw, 50vw" className="absolute inset-0 size-full" />
                </div>
                {captions && m.caption && <figcaption className="mt-2 text-2xs text-muted">{m.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function ProductGrid({ section, r }: BlockProps) {
  const x = d(section);
  const products = r.products.get(section.id) ?? [];
  if (!products.length) return null;
  const dark = section.theme === "dark";
  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading kicker={x.kicker} heading={x.heading} intro={x.intro} dark={dark} />
      </div>
      {text(x.style) === "slider" ? (
        <CardsSlider products={products} />
      ) : (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-8 px-gap md:grid-cols-3 md:gap-x-[18px] lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} dark={dark} />
          ))}
        </div>
      )}
      {isLink(x.button) && (
        <div className="mt-10 px-gap">
          <Button link={x.button} variant="secondary" dark={dark} />
        </div>
      )}
    </Shell>
  );
}

function CollectionCards({ section, r }: BlockProps) {
  const x = d(section);
  const items = list<Item>(x.collections)
    .map((it) => ({ it, cat: CATEGORIES.find((c) => c.slug === it.collection) }))
    .filter((v): v is { it: Item; cat: (typeof CATEGORIES)[number] } => Boolean(v.cat));
  if (!items.length) return null;
  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading kicker={x.kicker} heading={x.heading} dark={section.theme === "dark"} />
        <div className="grid gap-gap sm:grid-cols-2">
          {items.map(({ it, cat }) => {
            const img = typeof it.image === "string" ? r.media.get(it.image) : undefined;
            return (
              <Link key={it.id} href={`/${cat.slug}/`} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden bg-paper-2">
                  {img ? (
                    <Img m={img} sizes="(min-width: 640px) 50vw, 100vw" className="absolute inset-0 size-full transition-transform duration-[1200ms] ease-butter group-hover:scale-[1.03]" />
                  ) : (
                    <div className="wood" style={{ ["--tone" as string]: "#8a6a4a", ["--boards" as string]: 4 }} />
                  )}
                </div>
                <div className="mt-3 text-card group-hover:underline">{cat.title}</div>
                <p className="mt-1 text-2xs text-muted">{text(it.text) || cat.intro}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

function Cta({ section, r }: BlockProps) {
  const x = d(section);
  const img = typeof x.image === "string" ? r.media.get(x.image) : undefined;
  const dark = Boolean(img) || section.theme === "dark";
  return (
    <Shell section={img ? { ...section, theme: "dark" } : section}>
      <div className="relative isolate mx-gap overflow-hidden px-6 py-14 md:px-12 md:py-20">
        {img && (
          <>
            <Img m={img} sizes="100vw" className="absolute inset-0 -z-20 size-full" />
            <div className="absolute inset-0 -z-10 bg-ink/55" />
          </>
        )}
        <div className="max-w-2xl">
          {text(x.heading) && <h2 className="mono text-title md:text-lead">{text(x.heading)}</h2>}
          {text(x.intro) && <p className={`mt-3 leading-relaxed whitespace-pre-line ${dark ? "text-paper/80" : "text-ink-2"}`}>{text(x.intro)}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button link={x.primary} dark={dark} />
            <Button link={x.secondary} variant="secondary" dark={dark} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Features({ section, r }: BlockProps) {
  const x = d(section);
  const items = list<Item>(x.items);
  const dark = section.theme === "dark";
  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading kicker={x.kicker} heading={x.heading} intro={x.intro} dark={dark} />
        <div className="grid gap-x-gap gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const img = typeof it.image === "string" ? r.media.get(it.image) : undefined;
            const link = it.link as LinkValue | undefined;
            return (
              <div key={it.id}>
                {img && (
                  <div className="relative mb-4 aspect-[4/3] overflow-hidden bg-paper-2">
                    <Img m={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="absolute inset-0 size-full" />
                  </div>
                )}
                <h3 className="text-card">{text(it.title)}</h3>
                {text(it.text) && <p className={`mt-2 text-2xs leading-relaxed whitespace-pre-line ${dark ? "text-paper/70" : "text-muted"}`}>{text(it.text)}</p>}
                {isLink(link) && (
                  <SmartLink href={link.href} className="arrow-link mt-3 inline-block text-2xs">
                    {link.label}
                  </SmartLink>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

function Stats({ section }: BlockProps) {
  const x = d(section);
  const items = list<Item>(x.items);
  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading heading={x.heading} dark={section.theme === "dark"} />
        <dl className="grid grid-cols-2 gap-gap md:grid-cols-4">
          {items.map((it) => (
            <div key={it.id} className="border-t border-current/20 pt-4">
              <dt className="sr-only">{text(it.label)}</dt>
              <dd className="mono text-display tabular-nums">{text(it.value)}</dd>
              <dd className="mt-1 text-2xs opacity-70">{text(it.label)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Shell>
  );
}

function Faq({ section }: BlockProps) {
  const x = d(section);
  const items = list<Item>(x.items);
  return (
    <Shell section={section}>
      <div className="mx-auto max-w-3xl px-gap">
        <Heading heading={x.heading} dark={section.theme === "dark"} />
        <div className="border-t border-current/20">
          {items.map((it) => (
            <details key={it.id} className="group border-b border-current/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-card [&::-webkit-details-marker]:hidden">
                {text(it.q)}
                <span aria-hidden="true" className="text-lead leading-none transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 leading-relaxed whitespace-pre-line opacity-80">{text(it.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function Testimonials({ section, r }: BlockProps) {
  const x = d(section);
  const items = list<Item>(x.items);
  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading heading={x.heading} dark={section.theme === "dark"} />
        <div className="grid gap-gap md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const img = typeof it.image === "string" ? r.media.get(it.image) : undefined;
            return (
              <figure key={it.id} className="flex flex-col justify-between gap-6 border border-current/15 p-6">
                <blockquote className="text-body leading-relaxed whitespace-pre-line">“{text(it.quote)}”</blockquote>
                <figcaption className="flex items-center gap-3 text-2xs">
                  {img && (
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-paper-2">
                      <Img m={img} sizes="40px" className="absolute inset-0 size-full" />
                    </span>
                  )}
                  <span>
                    <span className="block font-medium">{text(it.name)}</span>
                    {text(it.role) && <span className="opacity-70">{text(it.role)}</span>}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

function Logos({ section, r }: BlockProps) {
  const x = d(section);
  const items = list<Item>(x.items).filter((it) => typeof it.image === "string" && r.media.has(it.image));
  if (!items.length) return null;
  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading heading={x.heading} dark={section.theme === "dark"} />
        <ul className="grid grid-cols-3 items-center gap-6 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((it) => {
            const m = r.media.get(it.image as string)!;
            const logo = <img src={sized(m.url, 320, m.version)} alt={text(it.name) || m.alt} loading="lazy" className="mx-auto max-h-12 w-auto object-contain opacity-80 transition-opacity hover:opacity-100" />;
            const href = text(it.href);
            return <li key={it.id}>{href && /^(https?:\/\/|\/)/.test(href) ? <SmartLink href={href}>{logo}</SmartLink> : logo}</li>;
          })}
        </ul>
      </div>
    </Shell>
  );
}

function Video({ section }: BlockProps) {
  const x = d(section);
  if (!parseVideo(x.url)) return null;
  return (
    <Shell section={section}>
      <div className="mx-auto max-w-5xl px-gap">
        <Heading heading={x.heading} dark={section.theme === "dark"} />
        <VideoEmbed url={text(x.url)} title={text(x.title) || text(x.heading)} />
        {text(x.caption) && <p className="mt-3 text-2xs whitespace-pre-line opacity-70">{text(x.caption)}</p>}
      </div>
    </Shell>
  );
}

function Downloads({ section, r, ctx }: BlockProps) {
  const x = d(section);
  const items = list<Item>(x.items).filter((it) => typeof it.file === "string" && r.media.has(it.file));
  if (!items.length) return null;
  const gated = x.gated === true;
  return (
    <Shell section={section}>
      <div className="px-gap">
        <Heading heading={x.heading} intro={x.intro} dark={section.theme === "dark"} />
        <div className="grid gap-gap sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const file = r.media.get(it.file as string)!;
            const cover = typeof it.image === "string" ? r.media.get(it.image) : undefined;
            const kb = Math.round(file.size / 1024);
            return (
              <div key={it.id} className="grid content-start gap-3">
                {cover && (
                  <div className="relative aspect-[3/4] overflow-hidden bg-paper-2">
                    <Img m={cover} sizes="(min-width: 1024px) 33vw, 50vw" className="absolute inset-0 size-full" />
                  </div>
                )}
                <div className="text-card">{text(it.title)}</div>
                <div className="text-2xs opacity-60">
                  {file.mime === "application/pdf" ? "PDF" : file.mime.split("/")[1]?.toUpperCase()} · {kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}
                </div>
                {gated ? (
                  <details className="group">
                    <summary className="inline-flex h-10 cursor-pointer list-none items-center border border-current/40 px-4 text-2xs [&::-webkit-details-marker]:hidden">Download</summary>
                    <div className="mt-4">
                      <SiteForm type="download" compact downloadId={file.id} downloadUrl={file.url} texts={ctx.texts} formsConfig={ctx.formsConfig} />
                    </div>
                  </details>
                ) : (
                  <a href={file.url} target="_blank" rel="noopener" className="inline-flex h-10 w-fit items-center border border-current/40 px-4 text-2xs hover:border-current">
                    Download
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

function FormBlock({ section, r, ctx }: BlockProps) {
  const x = d(section);
  const img = typeof x.image === "string" ? r.media.get(x.image) : undefined;
  const type = (text(x.formType) || "enquiry") as FormType;
  return (
    <Shell section={section}>
      <div className={`grid gap-gap px-gap ${img ? "md:grid-cols-2" : ""}`}>
        {img && (
          <div className="relative aspect-[4/5] overflow-hidden bg-paper-2 max-md:hidden">
            <Img m={img} sizes="50vw" className="absolute inset-0 size-full" />
          </div>
        )}
        <div className={img ? "" : "mx-auto w-full max-w-3xl"}>
          <Heading heading={x.heading} intro={x.intro} dark={section.theme === "dark"} />
          <SiteForm type={type} products={ctx.sampleProducts} texts={ctx.texts} formsConfig={ctx.formsConfig} />
        </div>
      </div>
    </Shell>
  );
}

function Studios({ section, ctx }: BlockProps) {
  const x = d(section);
  if (!ctx.studios.length) return null;
  const first = ctx.studios[0];
  return (
    <Shell section={section}>
      <div className={`grid gap-gap px-gap ${x.showMap !== false ? "md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}`}>
        {x.showMap !== false && first.address && (
          <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
            <iframe
              title={`Map: ${first.name}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(first.address)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 size-full border-0"
            />
          </div>
        )}
        <div>
          <Heading heading={x.heading} intro={x.intro} dark={section.theme === "dark"} />
          <div className="grid gap-6">
            {ctx.studios.map((s) => (
              <div key={s.name} className="border-t border-current/20 pt-4 text-2xs leading-relaxed">
                <div className="text-card">{s.name}</div>
                <p className="mt-1 whitespace-pre-line opacity-80">{s.address}</p>
                {s.hours && <p className="mt-1 opacity-70">{s.hours}</p>}
                {s.phone && <p className="mt-1">{s.phone}</p>}
                <a href={s.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`} target="_blank" rel="noopener" className="arrow-link mt-2 inline-block">
                  Directions
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Pending({ section, ctx }: BlockProps) {
  const x = d(section);
  if (ctx.preview) {
    return (
      <div className="mx-gap my-6 border border-dashed border-sand bg-sand/10 px-5 py-4 text-2xs">
        <b>Content coming soon</b> (only you see this note): {text(x.note)}
      </div>
    );
  }
  if (x.public !== true) return null;
  return (
    <Shell section={section}>
      <p className="px-gap text-center text-2xs text-muted">{text(x.message) || "More details coming soon."}</p>
    </Shell>
  );
}

export const BLOCKS: Record<string, (p: BlockProps) => React.ReactNode> = {
  hero: Hero,
  text: TextBlock,
  mediaText: MediaText,
  gallery: Gallery,
  productGrid: ProductGrid,
  collectionCards: CollectionCards,
  cta: Cta,
  features: Features,
  stats: Stats,
  faq: Faq,
  testimonials: Testimonials,
  logos: Logos,
  video: Video,
  downloads: Downloads,
  form: FormBlock,
  studios: Studios,
  pending: Pending,
};
