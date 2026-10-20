import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCatalog } from "@/lib/catalog";
import { isSlotAvailable } from "./bookings";
import { checkFormToken } from "./form-token";
import { escapeHtml, sendMail } from "./mailer";
import { rateLimit } from "./rate-limit";
import { getSettings } from "./settings";
import { pushLead, retryPendingLeads } from "./twenty-leads";
import { SITE_URL } from "@/lib/seo";

export const LEAD_TYPES = ["enquiry", "sample", "download", "dealer", "video_call", "visit", "landing"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_LABELS: Record<LeadType, string> = {
  enquiry: "Enquiry",
  sample: "Free sample request",
  download: "Guide / catalogue download",
  dealer: "Dealer / partner application",
  video_call: "Architect video call",
  visit: "Experience centre visit",
  landing: "Landing page lead",
};

/* ---------- Validation ---------- */

const phone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[^\d+]/g, ""))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "Enter a valid phone number"));
const text = (max: number) => z.string().trim().max(max);

const base = z.object({
  name: text(120).min(2, "Enter your name"),
  email: z.email("Enter a valid email").max(254).optional().or(z.literal("")),
  phone: phone.optional().or(z.literal("")),
  profession: z.enum(["homeowner", "architect", "interior_designer", "builder", "contractor", "dealer", "other"]).optional(),
  city: text(80).optional(),
  message: text(4000).optional(),
  consent: z.boolean().optional(),
});

const needContact = <T extends z.ZodType<{ email?: string; phone?: string }>>(s: T) =>
  s.refine((v) => Boolean(v.email || v.phone), { message: "Give an email or a phone number", path: ["email"] });

const SCHEMAS: Record<LeadType, z.ZodType> = {
  enquiry: needContact(base),
  landing: needContact(base.extend({ campaign: text(80).optional() })),
  sample: base.extend({
    phone,
    productIds: z.array(z.uuid()).min(1, "Choose at least one product").max(5, "Up to 5 samples per request"),
    address: text(300).min(8, "Enter the delivery address"),
    pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit PIN code"),
  }),
  download: base.extend({ email: z.email("Enter a valid email").max(254), downloadId: text(80).optional() }),
  dealer: base.extend({
    phone,
    email: z.email("Enter a valid email").max(254),
    company: text(160).min(2, "Enter the company name"),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[0-9A-Z]{15}$/, "GSTIN has 15 letters/numbers")
      .optional()
      .or(z.literal("")),
    yearsInBusiness: z.coerce.number().int().min(0).max(100).optional(),
  }),
  video_call: needContact(base.extend({ slot: z.iso.datetime({ offset: true }) })),
  visit: needContact(base.extend({ slot: z.iso.datetime({ offset: true }) })),
};

/* ---------- Submission ---------- */

export type SubmitMeta = { ip: string; userAgent: string | null; origin: string | null; referrer: string | null };
export type SubmitResult = { ok: true; id: string } | { ok: false; status: number; error: string; fields?: Record<string, string> };

const COMMON_KEYS = new Set(["name", "email", "phone", "profession", "city", "message", "consent", "slot"]);

async function verifyTurnstile(token: unknown, ip: string): Promise<boolean | null> {
  const { "turnstile.secret": secret } = await getSettings(["turnstile.secret"]);
  if (!secret) return null; // not configured
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    return Boolean(((await res.json()) as { success?: boolean }).success);
  } catch {
    return false;
  }
}

function allowedOrigin(origin: string | null) {
  if (!origin) return true; // same-origin form posts from some browsers omit it; other checks still apply
  try {
    const host = new URL(origin).host;
    return host === new URL(SITE_URL).host || host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.endsWith(".spanfloors.com");
  } catch {
    return false;
  }
}

export async function submitLead(type: LeadType, input: Record<string, unknown>, meta: SubmitMeta): Promise<SubmitResult> {
  if (!allowedOrigin(meta.origin)) return { ok: false, status: 403, error: "Forbidden" };

  // Honeypot: a hidden field real visitors never fill.
  if (typeof input.website === "string" && input.website.trim() !== "") return { ok: true, id: "ignored" };

  const token = checkFormToken(input._t);
  if (token === "too_fast") return { ok: true, id: "ignored" };
  if (token !== "ok") return { ok: false, status: 400, error: "The form expired. Please reload the page and try again." };

  if (!(await rateLimit(`form:${meta.ip}`, 5, 600))) return { ok: false, status: 429, error: "Too many submissions. Please try again in a few minutes." };

  const turnstile = await verifyTurnstile(input["cf-turnstile-response"], meta.ip);
  if (turnstile === false) return { ok: false, status: 400, error: "Please complete the verification and try again." };

  const parsed = SCHEMAS[type].safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, status: 422, error: "Please check the highlighted fields.", fields };
  }
  const v = parsed.data as Record<string, unknown> & z.infer<typeof base> & { slot?: string };

  // Type-specific data kept in `data`.
  const data: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) if (!COMMON_KEYS.has(k) && val !== undefined && val !== "") data[k] = val;

  if (type === "sample") {
    const catalog = await getCatalog().catch(() => []);
    const chosen = (data.productIds as string[]).map((id) => catalog.find((p) => p.id === id)).filter(Boolean);
    if (chosen.length !== (data.productIds as string[]).length) return { ok: false, status: 422, error: "One of the chosen products is no longer available.", fields: { productIds: "Choose again" } };
    data.products = chosen.map((p) => ({ id: p!.id, name: p!.name, url: `${SITE_URL}${p!.href}` }));
  }

  let slotStart: Date | null = null;
  if (type === "video_call" || type === "visit") {
    slotStart = new Date(v.slot!);
    if (!(await isSlotAvailable(type, slotStart))) return { ok: false, status: 409, error: "That time was just taken. Please pick another slot.", fields: { slot: "No longer available" } };
  }

  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]) {
    if (typeof input[k] === "string" && input[k]) utm[k] = String(input[k]).slice(0, 200);
  }

  let id: string;
  try {
    const [row] = await db
      .insert(schema.leads)
      .values({
        type,
        name: v.name,
        email: v.email || null,
        phone: v.phone || null,
        profession: v.profession ?? null,
        city: v.city || null,
        message: v.message || null,
        data,
        slotStart,
        sourcePath: typeof input.sourcePath === "string" ? input.sourcePath.slice(0, 300) : null,
        referrer: meta.referrer?.slice(0, 500) ?? null,
        utm,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      })
      .returning({ id: schema.leads.id });
    id = row.id;
  } catch (e) {
    // Unique slot index: someone booked the same slot at the same moment.
    if (String(e).includes("leads_slot_idx")) return { ok: false, status: 409, error: "That time was just taken. Please pick another slot.", fields: { slot: "No longer available" } };
    throw e;
  }

  // Emails and the Twenty copy are best-effort and never block the visitor; the lead is already saved.
  notify(id).catch((e) => console.error("lead notify failed", e));
  pushLead(id)
    .then(() => retryPendingLeads(10))
    .catch((e) => console.error("twenty push failed", e));
  return { ok: true, id };
}

/* ---------- Notifications ---------- */

async function recipientsFor(type: LeadType): Promise<string[]> {
  const s = await getSettings(["forms.recipients", "email.enquiryTo"]);
  let map: Record<string, string | string[]> = {};
  try {
    map = JSON.parse(s["forms.recipients"] ?? "{}");
  } catch {}
  const list = map[type] ?? map.default ?? s["email.enquiryTo"] ?? "";
  return (Array.isArray(list) ? list : String(list).split(",")).map((x) => x.trim()).filter((x) => /.+@.+\..+/.test(x));
}

const fmtSlot = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" });

async function notify(id: string) {
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
  if (!lead) return;
  const type = lead.type as LeadType;
  const data = lead.data as Record<string, unknown>;
  const lines: [string, string | null | undefined][] = [
    ["Type", LEAD_LABELS[type]],
    ["Name", lead.name],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Profession", lead.profession],
    ["City", lead.city],
    ["Booked for", lead.slotStart ? fmtSlot(lead.slotStart) : null],
    ["Products", Array.isArray(data.products) ? (data.products as { name: string }[]).map((p) => p.name).join(", ") : null],
    ["Address", data.address ? `${data.address} ${data.pincode ?? ""}` : null],
    ["Company", data.company as string],
    ["GSTIN", data.gstin as string],
    ["Message", lead.message],
    ["Page", lead.sourcePath],
  ];
  const rows = lines.filter(([, val]) => val);
  const adminUrl = `${SITE_URL}/admin/leads/${lead.id}/`;

  const to = await recipientsFor(type);
  let sent = false;
  if (to.length) {
    sent = await sendMail({
      to,
      replyTo: lead.email ?? undefined,
      subject: `New ${LEAD_LABELS[type].toLowerCase()}: ${lead.name}`,
      text: `${rows.map(([k, val]) => `${k}: ${val}`).join("\n")}\n\nOpen in admin: ${adminUrl}`,
      html: `<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">${rows
        .map(([k, val]) => `<tr><td style="color:#777;vertical-align:top">${escapeHtml(k)}</td><td>${escapeHtml(String(val)).replace(/\n/g, "<br>")}</td></tr>`)
        .join("")}</table><p><a href="${adminUrl}">Open in admin</a></p>`,
    });
  }

  const { "forms.autoReply": autoReply } = await getSettings(["forms.autoReply"]);
  if (lead.email && autoReply !== "no") {
    const what =
      type === "video_call" || type === "visit"
        ? `your ${type === "visit" ? "visit to our experience centre" : "video call"} on ${fmtSlot(lead.slotStart!)} is booked. We’ll confirm shortly.`
        : type === "sample"
          ? "we’ve received your sample request and will be in touch about delivery."
          : type === "dealer"
            ? "thank you for your interest in partnering with Span Floors. Our team will review your application."
            : "thank you for getting in touch. Our team will reply shortly.";
    await sendMail({
      to: lead.email,
      subject: "Span Floors: we’ve received your request",
      text: `Hello ${lead.name},\n\n${what.charAt(0).toUpperCase()}${what.slice(1)}\n\nSpan Floors`,
    });
  }
  if (sent) await db.update(schema.leads).set({ emailedAt: new Date() }).where(eq(schema.leads.id, id));
}
