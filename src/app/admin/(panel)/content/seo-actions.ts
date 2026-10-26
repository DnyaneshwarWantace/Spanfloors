"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { normalizePath } from "@/server/html";
import { checkSeo, type SeoReport } from "@/server/seo-check";
import { cleanSections } from "@/sections/clean";
import { cleanAeo } from "@/server/aeo";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** The live SEO checklist for the editor's current (unsaved) form. */
export async function checkSeoForm(form: FormData): Promise<SeoReport> {
  await requireUser("content");
  const id = str(form, "id") || null;
  const [row] = id ? await db.select({ type: schema.content.type, path: schema.content.path, systemKey: schema.content.systemKey }).from(schema.content).where(eq(schema.content.id, id)) : [];
  const type = row?.type ?? (str(form, "type") === "page" ? "page" : "post");
  let layout: unknown = [];
  let aeo: unknown = {};
  try {
    layout = JSON.parse(String(form.get("layout") ?? "[]"));
    aeo = JSON.parse(String(form.get("aeo") ?? "{}"));
  } catch {}
  return checkSeo({
    id,
    type,
    title: str(form, "title"),
    path: row?.systemKey ? row.path : normalizePath(str(form, "path") || str(form, "title") || "page"),
    body: String(form.get("body") ?? ""),
    layout: cleanSections(layout, row?.systemKey ? "system" : type).sections,
    excerpt: str(form, "excerpt"),
    seoTitle: str(form, "seoTitle"),
    seoDescription: str(form, "seoDescription"),
    focusKeyword: str(form, "focusKeyword"),
    robots: str(form, "noindex") === "on" ? "noindex" : str(form, "robots"),
    ogImageMediaId: /^[0-9a-f-]{36}$/.test(str(form, "ogImageMediaId")) ? str(form, "ogImageMediaId") : null,
    aeo: cleanAeo(aeo),
  });
}
