import "server-only";
import { existsSync } from "node:fs";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ViewContent } from "@/views/ContentView";
import { randomToken } from "./crypto";
import { mediaUrl, resolveStored } from "./storage";

/** Signed-in previews last a day; shared links last a week. */
export const PREVIEW_HOURS = 24;
export const SHARED_PREVIEW_DAYS = 7;

export async function createPreview(opts: { contentId: string | null; data: Record<string, unknown>; userId: string; shared?: boolean }) {
  await db.delete(schema.previews).where(lt(schema.previews.expiresAt, new Date())).catch(() => undefined);
  const id = randomToken(18).replace(/[^A-Za-z0-9_-]/g, "");
  const expiresAt = new Date(Date.now() + (opts.shared ? SHARED_PREVIEW_DAYS * 864e5 : PREVIEW_HOURS * 36e5));
  await db.insert(schema.previews).values({ id, contentId: opts.contentId, data: opts.data, shared: Boolean(opts.shared), createdBy: opts.userId, expiresAt });
  return { id, expiresAt };
}

export async function getPreview(id: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null;
  const [row] = await db
    .select()
    .from(schema.previews)
    .where(and(eq(schema.previews.id, id), gt(schema.previews.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** A preview's stored fields, shaped like a live page or post for rendering. */
export async function previewView(data: Record<string, unknown>): Promise<{ c: ViewContent; path: string }> {
  let featured: ViewContent["featured"] = null;
  const fid = str(data.featuredMediaId);
  if (/^[0-9a-f-]{36}$/.test(fid)) {
    const [m] = await db.select({ path: schema.media.path, alt: schema.media.alt }).from(schema.media).where(eq(schema.media.id, fid));
    const full = m && resolveStored(m.path);
    if (m && full && existsSync(full)) featured = { url: mediaUrl(m.path), alt: m.alt };
  }
  const date = (v: unknown) => (v ? new Date(v as string) : null);
  return {
    path: str(data.path) || "/",
    c: {
      id: typeof data.contentId === "string" && /^[0-9a-f-]{36}$/.test(data.contentId) ? data.contentId : null,
      type: data.type === "post" ? "post" : "page",
      title: str(data.title) || "Untitled",
      body: str(data.body),
      layout: Array.isArray(data.layout) ? data.layout : [],
      excerpt: str(data.excerpt),
      publishedAt: date(data.publishedAt),
      updatedAt: date(data.updatedAt) ?? new Date(),
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      authorName: str(data.authorName) || null,
      seoDescription: str(data.seoDescription) || null,
      featured,
      aeo: data.aeo ?? {},
      schemaType: str(data.schemaType) || null,
      relatedIds: Array.isArray(data.relatedIds) ? (data.relatedIds as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)) : [],
    },
  };
}
