import { emptyData, sectionDef } from "./registry";
import type { Section } from "./types";

/* Starting layouts for a new page. Each section starts with the registry defaults plus a few hints. */

export type TemplateKey = "blank" | "landing" | "contact" | "collection";

export const TEMPLATES: { key: TemplateKey; label: string; description: string }[] = [
  { key: "blank", label: "Blank page", description: "Start empty and add sections yourself." },
  { key: "landing", label: "Landing page", description: "Hero, benefits, products, questions and a form, for campaigns and ads." },
  { key: "contact", label: "Contact page", description: "Short intro, studios with map, and the enquiry form." },
  { key: "collection", label: "Collection story", description: "Photo-led page about one range: hero, text, gallery, products and a call to action." },
];

type Spec = { type: string; data?: Record<string, unknown>; theme?: Section["theme"]; anchor?: string };

const SPECS: Record<TemplateKey, Spec[]> = {
  blank: [],
  landing: [
    { type: "hero", data: { style: "full", primary: { label: "Order free samples", href: "#form" } } },
    { type: "features", data: { heading: "Why Span Floors" } },
    { type: "productGrid", data: { heading: "Popular finishes" } },
    { type: "testimonials", data: { heading: "What clients say" } },
    { type: "faq", data: { heading: "Questions" } },
    { type: "form", data: { heading: "Get free samples", formType: "sample" }, theme: "muted", anchor: "form" },
  ],
  contact: [
    { type: "hero", data: { style: "minimal", heading: "Contact us" } },
    { type: "studios", data: { heading: "Visit an experience studio" } },
    { type: "form", data: { heading: "Send us a message", formType: "enquiry" }, theme: "muted" },
  ],
  collection: [
    { type: "hero", data: { style: "split" } },
    { type: "text" },
    { type: "gallery", data: { style: "slider" } },
    { type: "productGrid" },
    { type: "cta", data: { heading: "See it in person", primary: { label: "Book a studio visit", href: "/contact-us/" } }, theme: "dark" },
  ],
};

export function templateLayout(key: string, makeId: () => string): Section[] {
  const specs = SPECS[key as TemplateKey] ?? [];
  return specs.flatMap((s) => {
    const def = sectionDef(s.type);
    if (!def) return [];
    return [{ id: makeId(), type: def.type, ...(s.theme ? { theme: s.theme } : {}), ...(s.anchor ? { anchor: s.anchor } : {}), data: { ...emptyData(def), ...(s.data ?? {}) } }];
  });
}
