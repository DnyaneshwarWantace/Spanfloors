import "server-only";
import { eq, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/* Where media files are used: pages and posts (text, sections, featured and share images), products, reusable
   sections and site settings. Used to block deleting files in use and to list unused files. */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const MEDIA_PATH = /\/media\/([^"'\s)?#]+)/g;

export type Usage = { kind: "page" | "post" | "product" | "reusable" | "settings"; id: string; title: string; href: string };

/** Every media id and file path referenced anywhere (one pass over the content). */
export async function usedMediaIndex() {
  const [content, products, reusable, settings] = await Promise.all([
    db.select({ body: schema.content.body, layout: schema.content.layout, f: schema.content.featuredMediaId, o: schema.content.ogImageMediaId }).from(schema.content),
    db.select({ ids: schema.productOverrides.mediaIds, o: schema.productOverrides.ogImageMediaId }).from(schema.productOverrides),
    db.select({ section: schema.reusableSections.section }).from(schema.reusableSections),
    db.select({ value: schema.settings.value }).from(schema.settings),
  ]);
  const ids = new Set<string>();
  const paths = new Set<string>();
  const addIds = (text: string) => {
    for (const m of text.matchAll(UUID)) ids.add(m[0].toLowerCase());
  };
  for (const c of content) {
    if (c.f) ids.add(c.f);
    if (c.o) ids.add(c.o);
    addIds(JSON.stringify(c.layout));
    for (const m of c.body.matchAll(MEDIA_PATH)) paths.add(decodeURIComponent(m[1]));
    for (const m of JSON.stringify(c.layout).matchAll(MEDIA_PATH)) paths.add(decodeURIComponent(m[1]));
  }
  for (const p of products) {
    p.ids.forEach((i) => ids.add(i));
    if (p.o) ids.add(p.o);
  }
  for (const r of reusable) addIds(JSON.stringify(r.section));
  for (const s of settings) addIds(JSON.stringify(s.value));
  return { ids, paths };
}

/** The places one file is used, for the media details panel. */
export async function mediaUsage(id: string, path: string): Promise<Usage[]> {
  const like = `%${id}%`;
  const enc = path.split("/").map(encodeURIComponent).join("/");
  const [content, products, reusable, settings] = await Promise.all([
    db
      .select({ id: schema.content.id, title: schema.content.title, type: schema.content.type })
      .from(schema.content)
      .where(
        or(
          eq(schema.content.featuredMediaId, id),
          eq(schema.content.ogImageMediaId, id),
          sql`${schema.content.layout}::text like ${like}`,
          sql`${schema.content.body} like ${`%/media/${path}%`}`,
          sql`${schema.content.body} like ${`%/media/${enc}%`}`,
        ),
      ),
    db
      .select({ id: schema.productOverrides.twentyId, name: schema.productOverrides.displayName })
      .from(schema.productOverrides)
      .where(or(sql`${id}::uuid = any(${schema.productOverrides.mediaIds})`, eq(schema.productOverrides.ogImageMediaId, id))),
    db.select({ id: schema.reusableSections.id, name: schema.reusableSections.name }).from(schema.reusableSections).where(sql`${schema.reusableSections.section}::text like ${like}`),
    db.select({ key: schema.settings.key }).from(schema.settings).where(sql`${schema.settings.value}::text like ${like}`),
  ]);
  return [
    ...content.map((c) => ({ kind: c.type, id: c.id, title: c.title, href: `/admin/content/${c.id}/?type=${c.type}` }) as Usage),
    ...products.map((p) => ({ kind: "product" as const, id: p.id, title: p.name || "A product", href: `/admin/products/${p.id}/` })),
    ...reusable.map((r) => ({ kind: "reusable" as const, id: r.id, title: r.name, href: `/admin/reusable/${r.id}/` })),
    ...settings.map((s) => ({ kind: "settings" as const, id: s.key, title: s.key === "config.identity" ? "Site settings: logo and icons" : `Site settings (${s.key})`, href: "/admin/settings/site/" })),
  ];
}
