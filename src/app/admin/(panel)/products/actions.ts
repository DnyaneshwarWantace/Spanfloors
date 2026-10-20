"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { sanitizeBody, slugify } from "@/server/html";
import { isValidImageId, testImageId } from "@/server/product-images";

export type ProductSaveState = { ok?: boolean; error?: string; savedAt?: string };

const schemaIn = z.object({
  twentyId: z.uuid(),
  hidden: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.coerce.number().int().min(-9999).max(9999),
  slug: z.string().max(120),
  displayName: z.string().max(160),
  descriptionHtml: z.string().max(100_000),
  mediaIds: z.array(z.uuid()).max(40),
  externalImageIds: z.array(z.string()).max(40),
  useExternalImages: z.boolean(),
  seoTitle: z.string().max(120),
  seoDescription: z.string().max(320),
});

/** Saves admin extras for a Twenty product. Writes only to our own database — never to Twenty. */
export async function saveProductExtras(_prev: ProductSaveState, form: FormData): Promise<ProductSaveState> {
  const user = await requireUser();
  const parsed = schemaIn.safeParse({
    twentyId: form.get("twentyId"),
    hidden: form.get("hidden") === "on",
    featured: form.get("featured") === "on",
    sortOrder: form.get("sortOrder") || 0,
    slug: String(form.get("slug") ?? "").trim(),
    displayName: String(form.get("displayName") ?? "").trim(),
    descriptionHtml: String(form.get("descriptionHtml") ?? ""),
    mediaIds: String(form.get("mediaIds") ?? "")
      .split(",")
      .filter(Boolean),
    externalImageIds: String(form.get("externalImageIds") ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    useExternalImages: form.get("useExternalImages") === "on",
    seoTitle: String(form.get("seoTitle") ?? "").trim(),
    seoDescription: String(form.get("seoDescription") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  const v = parsed.data;
  const badId = v.externalImageIds.find((id) => !isValidImageId(id));
  if (badId) return { error: `“${badId}” isn’t a valid image ID (letters, numbers, dot, dash, underscore).` };

  const values = {
    hidden: v.hidden,
    featured: v.featured,
    sortOrder: v.sortOrder,
    slug: v.slug ? slugify(v.slug).replace(/\//g, "-") || null : null,
    displayName: v.displayName || null,
    descriptionHtml: sanitizeBody(v.descriptionHtml),
    mediaIds: [...new Set(v.mediaIds)],
    externalImageIds: [...new Set(v.externalImageIds)],
    useExternalImages: v.useExternalImages,
    seoTitle: v.seoTitle || null,
    seoDescription: v.seoDescription || null,
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.productOverrides)
    .values({ twentyId: v.twentyId, ...values })
    .onConflictDoUpdate({ target: schema.productOverrides.twentyId, set: values });

  await logActivity(user.id, "update", "product", v.twentyId, `Updated product extras${v.hidden ? " (hidden)" : ""}`);
  // Product pages, listings and the sitemap all read the merged catalogue.
  revalidatePath("/", "layout");
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function testExternalImage(id: string) {
  await requireUser();
  return testImageId(id.trim());
}

const arrangeSchema = z.array(z.object({ id: z.uuid(), hidden: z.boolean(), featured: z.boolean() })).max(500);

/** Saves the order (positions 1…n) and hide/featured flags for one category. Our database only — never Twenty. */
export async function saveArrangement(items: unknown, categoryTitle: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = arrangeSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "Invalid order" };
  for (const [i, it] of parsed.data.entries()) {
    const values = { sortOrder: i + 1, hidden: it.hidden, featured: it.featured, updatedBy: user.id, updatedAt: new Date() };
    await db.insert(schema.productOverrides).values({ twentyId: it.id, ...values }).onConflictDoUpdate({ target: schema.productOverrides.twentyId, set: values });
  }
  await logActivity(user.id, "update", "product", null, `Arranged ${parsed.data.length} products in ${categoryTitle.slice(0, 80)}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
