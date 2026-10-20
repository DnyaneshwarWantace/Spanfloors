import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getSettings } from "./settings";

/**
 * Allsy.io → website media sync (images, brochure PDFs, videos stored on Cloudflare R2).
 * Allsy.io is read for media only; products themselves come from Twenty.
 *
 * Two ways in, both handled by `ingestAssets`:
 *  - push:  Allsy.io POSTs signed events to /api/allsy/webhook/
 *  - pull:  "Sync now" / cron GETs {allsy.apiUrl}/assets?updated_since=… (fallback & full resync)
 * The exact contract is documented in docs/allsy-api-spec.md (sent to Allsy.io).
 */

const tagSchema = z.union([z.string(), z.object({ group: z.string(), value: z.string() })]);

export const assetSchema = z.object({
  id: z.string().trim().regex(/^[A-Za-z0-9._-]{1,128}$/, "id: letters, numbers, dot, dash, underscore"),
  type: z.enum(["image", "pdf", "video"]),
  url: z.url().refine((u) => u.startsWith("https://"), "url must be https"),
  mime: z.string().max(100).optional().nullable(),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  bytes: z.number().int().nonnegative().optional().nullable(),
  title: z.string().max(300).optional().nullable(),
  alt: z.string().max(500).optional().nullable(),
  tags: z.array(tagSchema).max(100).optional().default([]),
  productId: z.string().max(64).optional().nullable(),
  project: z
    .object({
      id: z.string().max(128),
      name: z.string().max(300).optional(),
      city: z.string().max(120).optional(),
      category: z.string().max(80).optional(),
      year: z.number().int().optional(),
      architect: z.string().max(200).optional(),
    })
    .optional()
    .nullable(),
  section: z.string().max(200).optional().nullable(),
  videoUrl: z.url().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  deleted: z.boolean().optional().default(false),
  updatedAt: z.iso.datetime({ offset: true }).optional().nullable(),
});
export type IncomingAsset = z.input<typeof assetSchema>;

const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** "Tone: Earthy Brown" | {group:"tone",value:"Earthy Brown"} → "tone:earthy-brown". Untyped tags → "tag:<value>". */
export function normaliseTag(t: z.infer<typeof tagSchema>): string | null {
  const [g, v] = typeof t === "string" ? (t.includes(":") ? t.split(/:(.*)/s) : ["tag", t]) : [t.group, t.value];
  const group = slug(g ?? "");
  const value = slug(v ?? "");
  return group && value ? `${group}:${value}` : null;
}

function flagsFor(a: z.infer<typeof assetSchema>, tags: string[]): string[] {
  const f: string[] = [];
  if (a.type === "image" && tags.length === 0) f.push("missing_tag");
  if (a.type === "image" && !a.productId && !a.project) f.push("not_linked");
  if (a.type === "image" && !a.alt) f.push("missing_alt");
  if (a.type === "pdf" && !a.section) f.push("missing_section");
  if (a.type === "video" && !a.videoUrl) f.push("missing_video_url");
  return f;
}

export type IngestResult = { received: number; upserted: number; deleted: number; flagged: number; rejected: number; items: { id: string; action: string; flags?: string[]; error?: string }[] };

/** Validates and stores a batch of assets. Invalid items are rejected individually; the rest still apply. */
export async function ingestAssets(raw: unknown[]): Promise<IngestResult> {
  const result: IngestResult = { received: raw.length, upserted: 0, deleted: 0, flagged: 0, rejected: 0, items: [] };
  for (const item of raw.slice(0, 1000)) {
    const parsed = assetSchema.safeParse(item);
    const id = typeof (item as { id?: unknown })?.id === "string" ? String((item as { id: string }).id).slice(0, 128) : "?";
    if (!parsed.success) {
      result.rejected++;
      result.items.push({ id, action: "rejected", error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300) });
      continue;
    }
    const a = parsed.data;
    if (a.deleted) {
      await db.update(schema.allsyAssets).set({ deleted: true, receivedAt: new Date() }).where(eq(schema.allsyAssets.id, a.id));
      result.deleted++;
      result.items.push({ id: a.id, action: "deleted" });
      continue;
    }
    const tags = [...new Set(a.tags.map(normaliseTag).filter((t): t is string => Boolean(t)))];
    const flags = flagsFor(a, tags);
    const values = {
      type: a.type,
      url: a.url,
      mime: a.mime ?? null,
      width: a.width ?? null,
      height: a.height ?? null,
      bytes: a.bytes ?? null,
      title: a.title ?? "",
      alt: a.alt ?? "",
      tags,
      productId: a.productId ?? null,
      project: a.project ?? null,
      section: a.section ?? null,
      videoUrl: a.videoUrl ?? null,
      sortOrder: a.sortOrder,
      flags,
      deleted: false,
      sourceUpdatedAt: a.updatedAt ? new Date(a.updatedAt) : null,
      receivedAt: new Date(),
    };
    await db.insert(schema.allsyAssets).values({ id: a.id, ...values }).onConflictDoUpdate({ target: schema.allsyAssets.id, set: values });
    result.upserted++;
    if (flags.length) result.flagged++;
    result.items.push({ id: a.id, action: "upserted", ...(flags.length ? { flags } : {}) });
  }
  return result;
}

async function logSync(kind: "webhook" | "pull", r: IngestResult | null, opts: { eventId?: string | null; error?: string } = {}) {
  await db
    .insert(schema.syncLog)
    .values({
      source: "allsy",
      kind,
      eventId: opts.eventId ?? null,
      received: r?.received ?? 0,
      upserted: r?.upserted ?? 0,
      deleted: r?.deleted ?? 0,
      flagged: r?.flagged ?? 0,
      ok: !opts.error && (r?.rejected ?? 0) === 0,
      error: opts.error ?? (r?.rejected ? `${r.rejected} item(s) rejected` : null),
      items: (r?.items ?? []).slice(0, 500),
    })
    .onConflictDoNothing();
}

/* ---------- Push (webhook) ---------- */

const MAX_SKEW_SECONDS = 300;

/**
 * Verifies `X-Allsy-Signature: t=<unix>,v1=<hex hmac-sha256 of "<t>.<raw body>">` with the push secret.
 * The timestamp stops old requests being replayed.
 */
export async function verifyWebhook(rawBody: string, header: string | null): Promise<"ok" | "unconfigured" | "bad_signature" | "stale"> {
  const { "allsy.webhookSecret": secret } = await getSettings(["allsy.webhookSecret"]);
  if (!secret) return "unconfigured";
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t)) return "bad_signature";
  if (Math.abs(Date.now() / 1000 - t) > MAX_SKEW_SECONDS) return "stale";
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  const given = Buffer.from(parts.v1);
  return expected.length === given.length && timingSafeEqual(expected, given) ? "ok" : "bad_signature";
}

const eventSchema = z.object({
  eventId: z.string().min(1).max(128),
  event: z.enum(["assets.upsert", "assets.delete", "ping"]),
  assets: z.array(z.unknown()).max(1000).optional().default([]),
});

export async function handleWebhook(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return { status: 400, json: { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" } };
  const { eventId, event, assets } = parsed.data;

  const [seen] = await db.select({ id: schema.syncLog.id }).from(schema.syncLog).where(eq(schema.syncLog.eventId, eventId));
  if (seen) return { status: 200, json: { ok: true, duplicate: true } };
  if (event === "ping") {
    await logSync("webhook", { received: 0, upserted: 0, deleted: 0, flagged: 0, rejected: 0, items: [] }, { eventId });
    return { status: 200, json: { ok: true, pong: true } };
  }
  const items = event === "assets.delete" ? assets.map((a) => ({ ...(a as object), deleted: true })) : assets;
  const r = await ingestAssets(items);
  await logSync("webhook", r, { eventId });
  return { status: 200, json: { ok: true, received: r.received, upserted: r.upserted, deleted: r.deleted, flagged: r.flagged, rejected: r.rejected, errors: r.items.filter((i) => i.error) } };
}

/* ---------- Pull (fallback / full resync) ---------- */

export async function pullFromAllsy(opts: { full?: boolean } = {}): Promise<{ ok: boolean; message: string }> {
  const cfg = await getSettings(["allsy.apiUrl", "allsy.apiKey"]);
  const base = cfg["allsy.apiUrl"]?.replace(/\/$/, "");
  if (!base || !cfg["allsy.apiKey"]) return { ok: false, message: "Set the Allsy.io API URL and key under Integrations first." };

  let since: string | null = null;
  if (!opts.full) {
    const [last] = await db.select({ at: schema.syncLog.createdAt }).from(schema.syncLog).where(eq(schema.syncLog.kind, "pull")).orderBy(desc(schema.syncLog.createdAt)).limit(1);
    since = last ? new Date(last.at.getTime() - 5 * 60_000).toISOString() : null; // small overlap
  }
  const total: IngestResult = { received: 0, upserted: 0, deleted: 0, flagged: 0, rejected: 0, items: [] };
  try {
    let cursor: string | null = null;
    for (let page = 0; page < 500; page++) {
      const qs = new URLSearchParams({ limit: "200" });
      if (since) qs.set("updated_since", since);
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`${base}/assets?${qs}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${cfg["allsy.apiKey"]}`, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Allsy.io answered ${res.status}`);
      const json = (await res.json()) as { data?: unknown[]; nextCursor?: string | null };
      const r = await ingestAssets(json.data ?? []);
      for (const k of ["received", "upserted", "deleted", "flagged", "rejected"] as const) total[k] += r[k];
      total.items.push(...r.items);
      cursor = json.nextCursor ?? null;
      if (!cursor) break;
    }
    await logSync("pull", total);
    return { ok: true, message: `Synced ${total.upserted} item(s), removed ${total.deleted}, ${total.flagged} need attention${total.rejected ? `, ${total.rejected} rejected` : ""}.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSync("pull", total, { error: msg });
    return { ok: false, message: `Sync failed: ${msg}` };
  }
}

/* ---------- Lookups used by the catalogue ---------- */

/** All live image assets, keyed for product-image resolution. */
export async function allsyImageIndex() {
  const rows = await db
    .select({ id: schema.allsyAssets.id, url: schema.allsyAssets.url, productId: schema.allsyAssets.productId, sortOrder: schema.allsyAssets.sortOrder, flags: schema.allsyAssets.flags })
    .from(schema.allsyAssets)
    .where(and(eq(schema.allsyAssets.type, "image"), eq(schema.allsyAssets.deleted, false)))
    .catch(() => []);
  const byId = new Map<string, string>();
  const byProduct = new Map<string, { url: string; sortOrder: number }[]>();
  // Flagged images (e.g. missing tag) are held back from the website until fixed in Allsy.io.
  const live = rows.filter((r) => !r.flags.includes("missing_tag"));
  for (const r of live) {
    byId.set(r.id, r.url);
    if (r.productId) (byProduct.get(r.productId) ?? byProduct.set(r.productId, []).get(r.productId)!).push({ url: r.url, sortOrder: r.sortOrder });
  }
  return { byId, byProduct };
}

export async function assetsByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(schema.allsyAssets).where(inArray(schema.allsyAssets.id, ids));
}
