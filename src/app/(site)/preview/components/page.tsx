import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { notFound } from "next/navigation";
import { and, desc, eq, gt, like } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { resolveStored } from "@/server/storage";
import { getConfig } from "@/server/site-config";
import { COLLECTION_OPTIONS, SECTIONS } from "@/sections/registry";
import RenderSections from "@/sections/RenderSections";
import type { Section } from "@/sections/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Section guide · Span Floors" },
  robots: { index: false, follow: false, nocache: true },
};

/** Sections that only make sense inside the editor (markers and links to other sections). */
const SKIP = new Set(["listing", "pending", "reusable"]);

/** Photos and a PDF from the media library that are on this server, for the sample content. */
async function sampleMedia() {
  const imgs = await db
    .select({ id: schema.media.id, path: schema.media.path })
    .from(schema.media)
    .where(and(like(schema.media.mime, "image/%"), eq(schema.media.placeholder, false), gt(schema.media.width, 1200)))
    .orderBy(desc(schema.media.createdAt))
    .limit(80);
  const images = imgs.filter((m) => {
    const f = resolveStored(m.path);
    return f && existsSync(f);
  }).map((m) => m.id);
  const pdfs = await db.select({ id: schema.media.id, path: schema.media.path }).from(schema.media).where(eq(schema.media.mime, "application/pdf")).limit(80);
  const pdf = pdfs.find((m) => {
    const f = resolveStored(m.path);
    return f && existsSync(f);
  });
  return { images: images.slice(0, 16), pdf: pdf?.id ?? null };
}

const para = "<p>Engineered wood flooring has a real hardwood top layer on a stable, cross-layered core. It looks and feels like solid wood but copes far better with India’s humidity and with underfloor heating.</p><ul><li>Real oak surface</li><li>Click or glue-down fitting</li><li>Can be sanded and refinished</li></ul>";

function sample(type: string, img: (i: number) => string | null, pdf: string | null): Record<string, unknown> {
  const btn = (label: string, href = "/contact-us/") => ({ label, href });
  switch (type) {
    case "hero":
      return { style: "full", kicker: "Span Floors", heading: "Wood floors made for Indian homes", intro: "Engineered wood, laminate, decking and facades, chosen and fitted by people who have done it for 20 years.", image: img(0), primary: btn("Explore flooring", "/engineered-wood-flooring-collection/"), secondary: btn("Book a studio visit") };
    case "text":
      return { kicker: "Guide", heading: "What is engineered wood flooring?", body: para, width: "narrow" };
    case "mediaText":
      return { image: img(1), side: "left", kicker: "Our studios", heading: "See and feel every floor before you choose", body: "<p>Visit a Span Floors studio to walk on full-size boards, compare finishes in daylight and take samples home.</p>", button: btn("Find a studio") };
    case "gallery":
      return { heading: "A recent project", images: [2, 3, 4, 5, 6, 7].map(img).filter(Boolean), style: "grid", captions: false };
    case "productGrid":
      return { kicker: "Collection", heading: "Engineered wood flooring", intro: "A few products from the collection, straight from Twenty.", products: { mode: "collection", collection: COLLECTION_OPTIONS[0]?.value, ids: [], limit: 4 }, style: "grid" };
    case "collectionCards":
      return { heading: "Our collections", collections: COLLECTION_OPTIONS.slice(0, 4).map((c, i) => ({ id: `c${i}xxxx`, collection: c.value, image: img(8 + i), text: "" })) };
    case "cta":
      return { heading: "Not sure which floor suits your home?", intro: "Talk to a flooring advisor. We’ll help you choose and send free samples.", image: img(12), primary: btn("Talk to us"), secondary: btn("Order samples", "/samples/") };
    case "features":
      return { kicker: "Why Span Floors", heading: "What you get with every floor", items: ["Real wood surface", "Fitted by our own team", "Long warranties"].map((title, i) => ({ id: `f${i}xxxxx`, title, text: "A short line explaining the benefit in plain words.", image: null, link: { label: "", href: "" } })) };
    case "stats":
      return { heading: "Span Floors in numbers", items: [["20+", "years in flooring"], ["10,000+", "homes and projects"], ["6", "studios"], ["300+", "products"]].map(([value, label], i) => ({ id: `s${i}xxxxx`, value, label })) };
    case "faq":
      return { heading: "Questions people ask", items: [["Can engineered wood go in a kitchen?", "Yes. Its layered core keeps it stable when humidity changes, and a lacquered or oiled finish protects it from everyday spills if they are wiped up."], ["How long does fitting take?", "A typical 1,000 sq ft home takes two to three days once the subfloor is ready and level."]].map(([q, a], i) => ({ id: `q${i}xxxxx`, q, a })) };
    case "testimonials":
      return { heading: "What clients say", items: [{ id: "t0xxxxx", quote: "The team helped us pick a floor that suits the light in our house. Fitting was quick and clean.", name: "A homeowner", role: "Delhi", image: null }, { id: "t1xxxxx", quote: "We specify Span Floors on most of our residential projects.", name: "An architect", role: "Mumbai", image: null }] };
    case "logos":
      return { heading: "Brands we work with", items: [13, 14, 15].map((n, i) => ({ id: `l${i}xxxxx`, image: img(n), name: `Brand ${i + 1}`, href: "" })).filter((x) => x.image) };
    case "video":
      return { url: "https://youtu.be/Xung9x1J1Bo", title: "Span Floors", caption: "A short film about how we work." };
    case "downloads":
      return { heading: "Brochures", gated: false, items: pdf ? [{ id: "d0xxxxx", title: "Care and maintenance guide", file: pdf, image: null }] : [] };
    case "form":
      return { heading: "Send an enquiry", intro: "We reply within one working day.", formType: "enquiry", image: null };
    case "studios":
      return { heading: "Our studios", showMap: false };
    default:
      return {};
  }
}

/** Admin-only: every section type with sample content, to see how they look before building a page. */
export default async function SectionGuide() {
  const user = await currentUser();
  if (!user || !can(user.role, "content")) notFound();
  const { images, pdf } = await sampleMedia();
  const img = (i: number) => (images.length ? images[i % images.length] : null);
  const defs = SECTIONS.filter((d) => !SKIP.has(d.type));
  const studios = await getConfig("config.studios");
  /** Shown instead of a section that has nothing to show yet. */
  const empty: Record<string, string> = {
    ...(studios.length ? {} : { studios: "No studios saved yet. Add them in Admin → Site settings → Studios and they appear here." }),
    ...(pdf ? {} : { downloads: "No PDF files on this server yet. Upload a brochure in the media library to see this section." }),
  };

  return (
    <>
      <header className="border-b border-line px-gap pt-14 pb-8">
        <p className="text-2xs text-muted">Admin only · not visible to visitors or search engines</p>
        <h1 className="mono mt-2 text-display">Section guide</h1>
        <p className="mt-3 max-w-2xl text-2xs leading-relaxed text-muted">Every section you can add to a page, filled with sample text and photos from the media library. Colours and spacing can be changed per section in the editor.</p>
        <nav className="mt-5 flex flex-wrap gap-2 text-2xs" aria-label="Sections">
          {defs.map((d) => (
            <a key={d.type} href={`#guide-${d.type}`} className="border border-line px-2.5 py-1 hover:border-ink">
              {d.label}
            </a>
          ))}
        </nav>
      </header>
      {defs.map((d) => {
        const section: Section = { id: `guide-${d.type}`, type: d.type, data: sample(d.type, img, pdf) };
        return (
          <div key={d.type} id={`guide-${d.type}`} className="scroll-mt-20">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-y border-dashed border-line bg-paper-2/70 px-gap py-2.5 text-2xs">
              <strong className="font-semibold tracking-[0.06em] uppercase">{d.label}</strong>
              <span className="text-muted">{d.description}</span>
            </div>
            {empty[d.type] ? <p className="px-gap py-10 text-2xs text-muted">{empty[d.type]}</p> : <RenderSections layout={[section]} path="/preview/components/" preview />}
          </div>
        );
      })}
    </>
  );
}
