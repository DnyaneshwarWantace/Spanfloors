/* Answer-engine fields on pages and posts: a short answer, key takeaways and questions with answers. */

export type Aeo = { answer: string; takeaways: string[]; faqs: { q: string; a: string }[]; reviewedAt: string | null };

export const SCHEMA_TYPES = [
  { value: "", label: "Automatic", hint: "Article for blog posts, web page for pages" },
  { value: "WebPage", label: "Web page", hint: "General page" },
  { value: "AboutPage", label: "About page", hint: "About the company" },
  { value: "ContactPage", label: "Contact page", hint: "Addresses and contact details" },
  { value: "CollectionPage", label: "Collection page", hint: "A list of products or projects" },
  { value: "ItemPage", label: "Single item page", hint: "One project or product story" },
] as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function cleanAeo(raw: unknown): Aeo {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const takeaways = Array.isArray(o.takeaways) ? o.takeaways.map((t) => str(t, 200)).filter(Boolean).slice(0, 8) : [];
  const faqs = Array.isArray(o.faqs)
    ? o.faqs
        .map((f) => (f && typeof f === "object" ? { q: str((f as Record<string, unknown>).q, 200), a: str((f as Record<string, unknown>).a, 1200) } : { q: "", a: "" }))
        .filter((f) => f.q && f.a)
        .slice(0, 20)
    : [];
  const reviewed = str(o.reviewedAt, 20);
  return { answer: str(o.answer, 600), takeaways, faqs, reviewedAt: /^\d{4}-\d{2}-\d{2}$/.test(reviewed) ? reviewed : null };
}
