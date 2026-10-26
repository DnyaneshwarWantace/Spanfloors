import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATEGORIES, displayName, getCatalog } from "@/lib/catalog";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { getSettings } from "@/server/settings";
import { getStudios } from "@/server/site-ld";
import { getConfig } from "@/server/site-config";

export const dynamic = "force-dynamic";

/** Plain-text summary of the site for AI answer engines (llmstxt.org convention). */
export async function GET() {
  const [s, studios, products, pages, posts] = await Promise.all([
    getSettings(["site.name", "seo.aiSummary", "seo.aiFacts"]),
    getStudios().catch(() => []),
    getCatalog().catch(() => []),
    db
      .select({ title: schema.content.title, path: schema.content.path, description: schema.content.seoDescription })
      .from(schema.content)
      .where(
        and(
          eq(schema.content.type, "page"),
          isNull(schema.content.systemKey),
          inArray(schema.content.status, ["published"]),
          or(isNull(schema.content.robots), sql`${schema.content.robots} not like '%noindex%'`),
        ),
      )
      .orderBy(schema.content.title)
      .catch(() => []),
    db
      .select({ title: schema.content.title, path: schema.content.path, description: schema.content.seoDescription, excerpt: schema.content.excerpt })
      .from(schema.content)
      .where(and(eq(schema.content.type, "post"), eq(schema.content.status, "published")))
      .orderBy(desc(schema.content.publishedAt))
      .limit(40)
      .catch(() => []),
  ]);
  const contact = await getConfig("config.contact");
  const name = s["site.name"] || SITE_NAME;
  const summary =
    s["seo.aiSummary"]?.trim() ||
    `${name} supplies engineered wood flooring, laminate flooring, composite flooring, wooden decking and facade cladding in India, with experience studios where architects, interior designers and homeowners can see the floors in person.`;
  const facts = (s["seo.aiFacts"] ?? "")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
  const clip = (t: string | null | undefined, n = 160) => (t ? ` ${t.replace(/\s+/g, " ").trim().slice(0, n)}` : "");

  const lines = [
    `# ${name}`,
    "",
    `> ${summary}`,
    "",
    "## Key facts",
    ...facts.map((f) => `- ${f}`),
    ...(contact.phone ? [`- Phone: ${contact.phone}`] : []),
    ...(contact.email ? [`- Email: ${contact.email}`] : []),
    `- Website: ${SITE_URL}/`,
    "",
    ...(studios.length ? ["## Experience studios", ...studios.map((st) => `- ${st.name}: ${st.address.replace(/\s+/g, " ")}${st.phone ? `, ${st.phone}` : ""}${st.hours ? ` (${st.hours})` : ""}`), ""] : []),
    "## Collections",
    ...CATEGORIES.map((c) => {
      const n = products.filter((p) => p.categoryKey === c.key).length;
      return `- [${c.title}](${SITE_URL}/${c.slug}/): ${c.intro}${n ? ` ${n} products.` : ""}`;
    }),
    "",
    ...CATEGORIES.flatMap((c) => {
      const list = products.filter((p) => p.categoryKey === c.key);
      return list.length ? [`## ${c.title} products`, ...list.map((p) => `- [${displayName(p)}](${SITE_URL}${p.href})`), ""] : [];
    }),
    "## Pages",
    ...pages.map((p) => `- [${p.title}](${SITE_URL}${p.path})${p.description ? `:${clip(p.description)}` : ""}`),
    "",
    "## Articles",
    ...posts.map((p) => `- [${p.title}](${SITE_URL}${p.path})${p.description || p.excerpt ? `:${clip(p.description || p.excerpt)}` : ""}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
