import "server-only";
import { cache } from "react";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";

/**
 * Every setting the admin can manage. `secret` values are stored encrypted and never sent to the
 * browser in full (the admin only sees "••••1234"). `env` is the fallback while a value isn't set yet.
 */
export const SETTING_DEFS = {
  // Integrations & API keys
  "twenty.apiUrl": { group: "integrations", label: "Twenty API URL", secret: false, env: "TWENTY_API_URL", default: "https://api.twenty.com" },
  "twenty.apiKey": { group: "integrations", label: "Twenty API key (read-only use)", secret: true, env: "TWENTY_API_KEY" },
  "twenty.pushLeads": { group: "integrations", label: "Send website leads to Twenty (Current Leads): yes/no", secret: false, default: "no" },
  "twenty.refreshSeconds": { group: "integrations", label: "Product refresh interval (seconds)", secret: false, env: "TWENTY_REVALIDATE_SECONDS", default: "300" },
  "images.mode": { group: "integrations", label: "How product images are fetched: allsy, template, api or none", secret: false, default: "allsy" },
  "images.urlTemplate": {
    group: "integrations",
    label: "Public image URL template ({id} = image ID)",
    secret: false,
    env: "PRODUCT_IMAGE_URL_TEMPLATE",
  },
  "images.apiUrl": { group: "integrations", label: "Image API endpoint ({id} = image ID)", secret: false },
  "images.apiKey": { group: "integrations", label: "Image API key", secret: true },
  "images.apiKeyHeader": { group: "integrations", label: "Header that carries the key", secret: false, default: "Authorization" },
  "images.apiKeyPrefix": { group: "integrations", label: "Key prefix (e.g. “Bearer ”; leave empty for none)", secret: false, default: "Bearer " },
  "images.jsonPath": {
    group: "integrations",
    label: "If the API returns JSON: path to the image URL (e.g. data.url)",
    secret: false,
  },
  "allsy.apiUrl": { group: "integrations", label: "Allsy.io API base URL (e.g. https://api.allsy.io/v1)", secret: false },
  "allsy.apiKey": { group: "integrations", label: "Allsy.io API key (for pulling media)", secret: true },
  "allsy.webhookSecret": { group: "integrations", label: "Allsy.io push secret (shared with Allsy.io to sign pushes)", secret: true },
  "analytics.gaId": { group: "integrations", label: "Google Analytics measurement ID", secret: false },
  "analytics.gtmId": { group: "integrations", label: "Google Tag Manager ID", secret: false },
  "email.smtpHost": { group: "integrations", label: "SMTP host (enquiry emails)", secret: false },
  "email.smtpUser": { group: "integrations", label: "SMTP username", secret: false },
  "email.smtpPassword": { group: "integrations", label: "SMTP password", secret: true },
  "email.enquiryTo": { group: "integrations", label: "Send enquiries to", secret: false },

  "email.smtpPort": { group: "integrations", label: "SMTP port", secret: false, default: "587" },
  "email.fromAddress": { group: "integrations", label: "Send emails from (address)", secret: false },
  "email.fromName": { group: "integrations", label: "Send emails from (name)", secret: false, default: "Span Floors" },
  "turnstile.siteKey": { group: "integrations", label: "Cloudflare Turnstile site key (optional spam check)", secret: false },
  "turnstile.secret": { group: "integrations", label: "Cloudflare Turnstile secret key", secret: true },

  // Forms & bookings
  "forms.recipients": {
    group: "forms",
    label: "Lead recipients per form type (JSON)",
    secret: false,
    default: "{}",
  },
  "forms.autoReply": { group: "forms", label: "Send an automatic reply to the customer (yes/no)", secret: false, default: "yes" },
  "forms.whatsapp": { group: "forms", label: "WhatsApp number (with country code, digits only)", secret: false, default: "919212096387" },
  "bookings.config": {
    group: "forms",
    label: "Booking availability (JSON)",
    secret: false,
    default: JSON.stringify({
      timezone: "Asia/Kolkata",
      slotMinutes: 30,
      minNoticeHours: 4,
      daysAhead: 30,
      // 0 = Sunday … 6 = Saturday; times in the timezone above
      hours: { video_call: { "1": ["10:00-18:00"], "2": ["10:00-18:00"], "3": ["10:00-18:00"], "4": ["10:00-18:00"], "5": ["10:00-18:00"], "6": ["10:00-14:00"] }, visit: { "1": ["10:30-18:30"], "2": ["10:30-18:30"], "3": ["10:30-18:30"], "4": ["10:30-18:30"], "5": ["10:30-18:30"], "6": ["10:30-18:30"] } },
      blockedDates: [],
    }),
  },

  // Site settings
  "site.name": { group: "site", label: "Site name", secret: false, default: "Span Floors" },
  "site.phone": { group: "site", label: "Phone", secret: false, default: "+91 92120 96387" },
  "site.email": { group: "site", label: "Email", secret: false },
  "site.address": { group: "site", label: "Experience centre address", secret: false },
  "site.instagram": { group: "site", label: "Instagram URL", secret: false, default: "https://www.instagram.com/spanfloors/" },
  "site.facebook": { group: "site", label: "Facebook URL", secret: false, default: "https://www.facebook.com/spanfloors/" },
  "site.linkedin": { group: "site", label: "LinkedIn URL", secret: false, default: "https://www.linkedin.com/company/span-floors-llp" },
  "seo.defaultTitle": { group: "seo", label: "Default SEO title", secret: false },
  "seo.defaultDescription": { group: "seo", label: "Default meta description", secret: false },
} as const satisfies Record<string, { group: string; label: string; secret: boolean; env?: string; default?: string }>;

export type SettingKey = keyof typeof SETTING_DEFS;

function envFallback(key: SettingKey): string | null {
  const def = SETTING_DEFS[key] as { env?: string; default?: string };
  return (def.env && process.env[def.env]) || def.default || null;
}

/** All stored settings for this request (one query), decrypted. */
const loadAll = cache(async (): Promise<Map<string, string>> => {
  const rows = await db.select().from(schema.settings).catch(() => []);
  const out = new Map<string, string>();
  for (const r of rows) {
    try {
      out.set(r.key, r.secret ? decrypt(String(r.value)) : String(r.value));
    } catch {
      // unreadable secret (e.g. APP_SECRET changed) — fall back to env/default
    }
  }
  return out;
});

export async function getSetting(key: SettingKey): Promise<string | null> {
  const stored = (await loadAll()).get(key);
  return stored != null && stored !== "" ? stored : envFallback(key);
}

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<Record<K, string | null>> {
  const all = await loadAll();
  return Object.fromEntries(keys.map((k) => [k, all.get(k) || envFallback(k)])) as Record<K, string | null>;
}

/** Saves settings; empty string clears a value (falls back to env/default). */
export async function saveSettings(values: Partial<Record<SettingKey, string>>, userId: string | null) {
  const entries = Object.entries(values) as [SettingKey, string][];
  const clear = entries.filter(([, v]) => v === "").map(([k]) => k);
  if (clear.length) await db.delete(schema.settings).where(inArray(schema.settings.key, clear));
  for (const [key, raw] of entries) {
    if (raw === "") continue;
    const def = SETTING_DEFS[key];
    const value = def.secret ? encrypt(raw) : raw;
    await db
      .insert(schema.settings)
      .values({ key, value, secret: def.secret, updatedBy: userId })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, secret: def.secret, updatedBy: userId, updatedAt: new Date() } });
  }
}

/** Admin view: values with secrets masked, plus where each value comes from. */
export async function settingsForAdmin() {
  const all = await loadAll();
  return (Object.keys(SETTING_DEFS) as SettingKey[]).map((key) => {
    const def = SETTING_DEFS[key] as { group: string; label: string; secret: boolean; env?: string; default?: string };
    const stored = all.get(key);
    const fallback = envFallback(key);
    const value = stored ?? fallback ?? "";
    return {
      key,
      group: def.group,
      label: def.label,
      secret: def.secret,
      source: stored ? "admin" : fallback ? (def.env && process.env[def.env] ? "env" : "default") : "unset",
      value: def.secret ? (value ? `••••${value.slice(-4)}` : "") : value,
    };
  });
}

export async function deleteSetting(key: SettingKey) {
  await db.delete(schema.settings).where(eq(schema.settings.key, key));
}
