import "server-only";
import { displayName, getCatalog } from "@/lib/catalog";
import { JsonLd, SITE_URL } from "@/lib/seo";
import { getStudios } from "@/server/site-ld";
import { getTexts } from "@/server/site-config";
import { BLOCKS, type BlockContext } from "./components/blocks";
import { resolveSections, type Resolved } from "./resolve";
import type { Section } from "./types";
import { parseVideo } from "./video";

type Item = Record<string, unknown>;

/** Google structured data the sections add to the page: FAQ answers and videos. */
export function sectionsStructuredData(r: Resolved, pageUrl: string, extraFaqs: { q: string; a: string }[] = []) {
  const out: object[] = [];
  const faqs = [...r.sections
    .filter((s) => s.type === "faq")
    .flatMap((s) => (Array.isArray(s.data.items) ? (s.data.items as Item[]) : []))
    .filter((f) => typeof f.q === "string" && f.q && typeof f.a === "string" && f.a), ...extraFaqs];
  if (faqs.length) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  for (const s of r.sections) {
    if (s.type !== "video") continue;
    const v = parseVideo(s.data.url);
    if (!v) continue;
    const name = (s.data.title as string) || (s.data.heading as string);
    if (!name) continue; // Google requires a name; editors are asked for one in the admin
    out.push({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name,
      description: (s.data.caption as string) || name,
      embedUrl: v.embed,
      contentUrl: v.url,
      ...(v.thumbnail ? { thumbnailUrl: v.thumbnail } : {}),
      isPartOf: { "@id": pageUrl },
    });
  }
  return out;
}

async function context(r: Resolved, preview: boolean): Promise<BlockContext> {
  const needsSamples = r.sections.some((s) => s.type === "form" && s.data.formType === "sample");
  const needsStudios = r.sections.some((s) => s.type === "studios");
  const needsTexts = r.sections.some((s) => s.type === "form" || s.type === "downloads");
  const [catalog, studios, texts] = await Promise.all([
    needsSamples ? getCatalog().catch(() => []) : Promise.resolve([]),
    needsStudios ? getStudios() : Promise.resolve([]),
    needsTexts ? getTexts() : Promise.resolve({}),
  ]);
  return {
    sampleProducts: catalog.filter((p) => p.categoryKey !== "accessories").map((p) => ({ id: p.id, name: displayName(p) })),
    studios: studios.map((s) => ({ name: s.name, address: s.address, phone: s.phone || undefined, hours: s.hours || undefined, mapUrl: s.mapUrl || undefined })),
    texts: texts as Record<string, string>,
    first: false,
    preview,
  };
}

/**
 * Renders a page's sections. `preview` shows hidden sections' admin notes (e.g. "content coming soon") and is
 * used by the admin preview; visitors never see hidden sections.
 */
export default async function RenderSections({
  layout,
  path,
  preview = false,
  extraFaqs = [],
}: {
  layout: unknown;
  path: string;
  preview?: boolean;
  /** Questions from the page's answer-engine fields, merged into the one FAQ entry Google reads. */
  extraFaqs?: { q: string; a: string }[];
}) {
  const r = await resolveSections(layout, { showHidden: false });
  const ld = sectionsStructuredData(r, `${SITE_URL}${path}`, extraFaqs);
  if (!r.sections.length) return ld.map((data, i) => <JsonLd key={i} data={data} />);
  const ctx = await context(r, preview);
  return (
    <>
      {ld.map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      {r.sections.map((s: Section, i) => {
        const Block = BLOCKS[s.type];
        if (!Block) return null;
        return <Block key={s.id} section={s} r={r} ctx={{ ...ctx, first: i === 0 }} />;
      })}
    </>
  );
}
