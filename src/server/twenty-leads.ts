import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Lead } from "@/db/schema";
import { getFullCatalog } from "@/lib/catalog";
import { SITE_URL } from "@/lib/seo";
import { getSettings } from "./settings";

/**
 * ⚠️ The ONLY place in the codebase that writes to Twenty CRM (see CLAUDE.md).
 *
 * Approved scope: CREATE a new `currentLeads` record for a website form submission, plus one
 * `notes` record and the `noteTargets` link that attaches it to that new lead.
 * Never update, never delete, never touch any other object.
 */

const ALLOWED_OBJECTS = new Set(["currentLeads", "notes", "noteTargets"]);

async function twentyCreate(object: string, body: Record<string, unknown>): Promise<string> {
  if (!ALLOWED_OBJECTS.has(object)) throw new Error(`Refusing to write to Twenty object "${object}"`);
  const cfg = await getSettings(["twenty.apiUrl", "twenty.apiKey"]);
  if (!cfg["twenty.apiKey"]) throw new Error("Twenty API key is not set");
  const res = await fetch(`${cfg["twenty.apiUrl"] ?? "https://api.twenty.com"}/rest/${object}`, {
    method: "POST", // create only
    headers: { Authorization: `Bearer ${cfg["twenty.apiKey"]}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Twenty ${object} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  // REST create responses look like { data: { createCurrentLead: { id, … } } }
  const created = Object.values((json.data ?? {}) as Record<string, { id?: string }>)[0];
  if (!created?.id) throw new Error(`Twenty ${object}: no id in response`);
  return created.id;
}

/* ---------- Mapping website lead → Twenty fields ---------- */

const LABELS: Record<string, string> = {
  enquiry: "Enquiry",
  sample: "Free sample request",
  download: "Guide / catalogue download",
  dealer: "Dealer / partner application",
  video_call: "Architect video call",
  visit: "Experience centre visit",
  landing: "Landing page lead",
};

const CALLING_CODES: [string, string][] = [
  ["+971", "AE"],
  ["+977", "NP"],
  ["+975", "BT"],
  ["+91", "IN"],
];

function phoneField(phone: string | null) {
  if (!phone) return undefined;
  let num = phone.replace(/[^\d+]/g, "");
  let code = "+91";
  let country = "IN";
  const match = CALLING_CODES.find(([c]) => num.startsWith(c));
  if (match) {
    [code, country] = match;
    num = num.slice(code.length);
  } else if (num.startsWith("0")) {
    num = num.slice(1);
  }
  return { primaryPhoneNumber: num.replace(/\D/g, ""), primaryPhoneCountryCode: country, primaryPhoneCallingCode: code, additionalPhones: [] };
}

function leadSource(lead: Lead): string {
  const utm = lead.utm as Record<string, string>;
  const src = `${utm.utm_source ?? ""} ${utm.utm_medium ?? ""}`.toLowerCase();
  if (utm.fbclid || /facebook|instagram|meta|\bfb\b|\big\b/.test(src)) return "META_ADS";
  if (lead.type === "dealer" || lead.profession === "dealer") return "DEALER";
  if (lead.profession === "architect" || lead.profession === "interior_designer") return "ARCHITECT_DESIGNER";
  if (lead.profession === "contractor" || lead.profession === "builder") return "CONTRACTOR";
  return "WEBSITE_SEO";
}

const CLIENT_TYPE: Record<string, string> = { homeowner: "HOMEOWNER", contractor: "CONTRACTOR", builder: "CONTRACTOR" };
const PRODUCT_TYPE: Record<string, string> = {
  engineered: "ENGINEERED_WOODEN_FLOORING",
  laminate: "LAMINATE_FLOORING",
  composite: "ECO_COMPOSITE_FLOORING",
  decking: "WOODEN_DECKING",
  facades: "WOODEN_CLADDING",
};
const TONE: Record<string, string> = {
  AIRY_LIGHT_TONES: "AIRY_LIGHT_TONES",
  WHITE_GREY_AND_BLACK_TONES: "WHITE_GREY_BLACK_TONES",
  MEDIUM_NATURAL_TONES: "MEDIUM_NATURAL_TONES",
  MEDIUM_BROWN_TONES: "MEDIUM_NATURAL_TONES",
  EARTHY_BROWN_TONES: "EARTHY_BROWN_TONES",
};
const BRANDS = new Set(["CHAMPACA", "COSWICK", "ABODO", "OPT", "LAMETT", "TENACITY", "NUANCE", "OAK_STORY", "SYLVANIX", "BASIX", "OSMO", "KALINDI", "SPREZZATURA"]);
const brandEnum = (b: string) => b.toUpperCase().replace(/^THE\s+/, "").replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

async function buildPayload(lead: Lead) {
  const data = lead.data as Record<string, unknown>;
  const [first, ...rest] = lead.name.trim().split(/\s+/);
  const payload: Record<string, unknown> = {
    name: `${lead.name} · Website ${LABELS[lead.type] ?? lead.type}`.slice(0, 200),
    clientFirstName: first,
    clientLastName: rest.join(" ") || undefined,
    leadSource: leadSource(lead),
    clientType: lead.profession ? CLIENT_TYPE[lead.profession] : undefined,
    clientPhoneNumber: phoneField(lead.phone),
  };
  if (lead.city || data.address) {
    payload.projectAddress = {
      addressStreet1: (data.address as string) ?? "",
      addressCity: lead.city ?? "",
      addressPostcode: (data.pincode as string) ?? "",
      addressCountry: (lead.phone ?? "").startsWith("+971") ? "United Arab Emirates" : "India",
    };
  }
  // Sample requests: describe the chosen products with Twenty's own option values.
  const ids = Array.isArray(data.productIds) ? (data.productIds as string[]) : [];
  if (ids.length) {
    const catalog = await getFullCatalog().catch(() => []);
    const chosen = ids.map((id) => catalog.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const types = [...new Set(chosen.map((p) => PRODUCT_TYPE[p.categoryKey]).filter(Boolean))];
    const tones = [...new Set(chosen.map((p) => (p.collection ? TONE[p.collection] : undefined)).filter(Boolean))];
    const brands = [...new Set(chosen.map((p) => (p.brand ? brandEnum(p.brand) : "")).filter((b) => BRANDS.has(b)))];
    if (types.length) payload.productType = types;
    if (tones.length) payload.colourTone = tones;
    if (brands.length) payload.productBrand = brands;
  }
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
  return payload;
}

function noteMarkdown(lead: Lead) {
  const data = lead.data as Record<string, unknown>;
  const utm = lead.utm as Record<string, string>;
  const when = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const lines = [
    `**${LABELS[lead.type] ?? lead.type}** from the website, ${when(lead.createdAt)}`,
    "",
    lead.email && `- Email: ${lead.email}`,
    lead.phone && `- Phone: ${lead.phone}`,
    lead.profession && `- Profession: ${lead.profession.replace(/_/g, " ")}`,
    lead.city && `- City: ${lead.city}`,
    lead.slotStart && `- **Booked for: ${when(lead.slotStart)}**`,
    Array.isArray(data.products) && `- Samples: ${(data.products as { name: string; url: string }[]).map((p) => `[${p.name}](${p.url})`).join(", ")}`,
    data.address && `- Delivery address: ${data.address} ${data.pincode ?? ""}`,
    data.company && `- Company: ${data.company}${data.gstin ? ` (GSTIN ${data.gstin})` : ""}`,
    data.downloadId && `- Download: ${data.downloadId}`,
    lead.message && `\n> ${lead.message.replace(/\n/g, "\n> ")}`,
    "",
    lead.sourcePath && `Page: ${SITE_URL}${lead.sourcePath}`,
    Object.keys(utm).length ? `Campaign: ${Object.entries(utm).map(([k, v]) => `${k}=${v}`).join(", ")}` : null,
    `Website admin: ${SITE_URL}/admin/leads/${lead.id}/`,
  ];
  return lines.filter((l) => l !== false && l !== null && l !== undefined && l !== "").join("\n");
}

/* ---------- Sync ---------- */

export async function pushLeadsEnabled() {
  return (await getSettings(["twenty.pushLeads"]))["twenty.pushLeads"] === "yes";
}

/** Creates the lead (and its note) in Twenty once. Safe to call repeatedly: finished steps are skipped. */
export async function pushLead(leadId: string): Promise<"sent" | "failed" | "off" | "skipped"> {
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId));
  if (!lead || lead.status === "spam" || lead.twentyStatus === "sent") return "skipped";
  if (!(await pushLeadsEnabled())) {
    await db.update(schema.leads).set({ twentyStatus: "off" }).where(eq(schema.leads.id, leadId));
    return "off";
  }
  try {
    let twentyLeadId = lead.twentyLeadId;
    if (!twentyLeadId) {
      twentyLeadId = await twentyCreate("currentLeads", await buildPayload(lead));
      await db.update(schema.leads).set({ twentyLeadId }).where(eq(schema.leads.id, leadId));
    }
    if (!lead.twentyNoteId) {
      const noteId = await twentyCreate("notes", { title: `Website: ${LABELS[lead.type] ?? lead.type}`, bodyV2: { markdown: noteMarkdown(lead) } });
      await db.update(schema.leads).set({ twentyNoteId: noteId }).where(eq(schema.leads.id, leadId));
      await twentyCreate("noteTargets", { noteId, targetCurrentLeadId: twentyLeadId });
    }
    await db
      .update(schema.leads)
      .set({ twentyStatus: "sent", twentyError: null, twentySyncedAt: new Date(), twentyAttempts: lead.twentyAttempts + 1 })
      .where(eq(schema.leads.id, leadId));
    return "sent";
  } catch (e) {
    await db
      .update(schema.leads)
      .set({ twentyStatus: "failed", twentyError: (e instanceof Error ? e.message : String(e)).slice(0, 500), twentyAttempts: lead.twentyAttempts + 1 })
      .where(eq(schema.leads.id, leadId));
    return "failed";
  }
}

/**
 * Retries every lead that hasn't reached Twenty yet — no attempt limit: leads stay safely in our
 * database and keep retrying (oldest first) until Twenty accepts them.
 * Called by the cron route every few minutes, after each new submission, and by "Retry now" in the admin.
 */
export async function retryPendingLeads(limit = 25) {
  if (!(await pushLeadsEnabled())) return { tried: 0, sent: 0 };
  const rows = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(inArray(schema.leads.twentyStatus, ["pending", "failed", "off"]))
    .orderBy(asc(schema.leads.createdAt))
    .limit(limit);
  let sent = 0;
  for (const r of rows) if ((await pushLead(r.id)) === "sent") sent++;
  return { tried: rows.length, sent };
}

/** Read-only preview of what would be created in Twenty for a lead (nothing is sent). */
export async function previewTwentyPayload(leadId: string) {
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId));
  if (!lead) return null;
  return { currentLead: await buildPayload(lead), note: { title: `Website: ${LABELS[lead.type] ?? lead.type}`, markdown: noteMarkdown(lead) } };
}
