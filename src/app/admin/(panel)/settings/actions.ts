"use server";

import { logIntegration } from "@/server/integration-log";
import { sendMail, verifySmtp } from "@/server/mailer";
import { revalidatePath, revalidateTag } from "next/cache";
import { logActivity, requireUser } from "@/server/auth";
import { saveSettings, SETTING_DEFS, type SettingKey } from "@/server/settings";

export type SettingsState = { ok?: boolean; error?: string; tested?: string };

/** Saves one settings group. Secret fields left blank keep their current value; "clear" removes them. */
export async function saveSettingsGroup(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const group = String(form.get("_group") ?? "");
  const user = await requireUser(group === "integrations" ? "settings.integrations" : group === "forms" ? "settings.forms" : "settings.site");
  const values: Partial<Record<SettingKey, string>> = {};
  for (const [key, def] of Object.entries(SETTING_DEFS) as [SettingKey, (typeof SETTING_DEFS)[SettingKey]][]) {
    if (def.group !== group && !(group === "site" && def.group === "seo")) continue;
    if (!form.has(key)) continue;
    const raw = String(form.get(key) ?? "").trim();
    if (def.secret) {
      if (form.get(`${key}__clear`) === "on") values[key] = "";
      else if (raw) values[key] = raw; // blank = keep existing secret
    } else {
      values[key] = raw;
    }
  }
  for (const key of ["forms.recipients", "bookings.config"] as const) {
    if (values[key]) {
      try {
        const parsed = JSON.parse(values[key]!);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
        values[key] = JSON.stringify(parsed);
      } catch {
        return { error: `${SETTING_DEFS[key].label}: that isn’t valid JSON.` };
      }
    }
  }
  if (values["forms.autoReply"] && !["yes", "no"].includes(values["forms.autoReply"])) return { error: "Auto-reply must be yes or no." };
  if (values["forms.whatsapp"] && !/^\d{10,15}$/.test(values["forms.whatsapp"])) return { error: "WhatsApp number: digits only, with country code (e.g. 919212096387)." };
  if (values["twenty.apiUrl"] && !/^https:\/\//.test(values["twenty.apiUrl"])) return { error: "Twenty API URL must start with https://" };
  if (values["images.urlTemplate"] && !values["images.urlTemplate"].includes("{id}")) return { error: "The image URL template must contain {id}." };
  if (values["images.apiUrl"] && !/^https:\/\/.+\{id\}/.test(values["images.apiUrl"])) return { error: "The image API endpoint must start with https:// and contain {id}." };
  if (values["allsy.apiUrl"] && !/^https:\/\//.test(values["allsy.apiUrl"])) return { error: "Allsy.io API URL must start with https://" };
  if (values["twenty.pushLeads"] && !["yes", "no"].includes(values["twenty.pushLeads"])) return { error: "Send website leads to Twenty must be yes or no." };
  if (values["images.mode"] && !["allsy", "none", "template", "api"].includes(values["images.mode"])) return { error: "Image mode must be allsy, template, api or none." };
  if (values["twenty.refreshSeconds"] && !(Number(values["twenty.refreshSeconds"]) >= 30)) return { error: "Refresh interval must be at least 30 seconds." };

  await saveSettings(values, user.id);
  const changed = Object.keys(values).map((k) => SETTING_DEFS[k as SettingKey].label);
  await logActivity(user.id, "update", "settings", group, `Updated ${group} settings (${changed.length} field${changed.length === 1 ? "" : "s"})`);
  if (group === "integrations") revalidateTag("twenty", "max");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Read-only connection check: one GET to Twenty with the saved key. */
export async function testTwentyConnection(): Promise<SettingsState> {
  const user = await requireUser("settings.integrations");
  const { getSettings } = await import("@/server/settings");
  const cfg = await getSettings(["twenty.apiUrl", "twenty.apiKey"]);
  if (!cfg["twenty.apiKey"]) return { error: "No Twenty API key saved." };
  let result: SettingsState;
  try {
    // Read-only check (GET one product).
    const res = await fetch(`${cfg["twenty.apiUrl"] ?? "https://api.twenty.com"}/rest/masterProducts?limit=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg["twenty.apiKey"]}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) result = { error: `Twenty answered ${res.status}. Check the URL and key.` };
    else {
      const j = (await res.json()) as { totalCount?: number };
      result = { ok: true, tested: `Connected. ${j.totalCount ?? "?"} products in Twenty.` };
    }
  } catch (e) {
    result = { error: `Couldn’t reach Twenty: ${e instanceof Error ? e.message : e}` };
  }
  await logIntegration("twenty", "test", !result.error, result.error ?? result.tested ?? "", user.id);
  return result;
}

/** Checks the SMTP login, then sends a short test email to the address given (default: the admin's own). */
export async function testEmail(to: string): Promise<SettingsState> {
  const user = await requireUser("settings.integrations");
  const address = (to || user.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { error: "Enter a valid email address." };
  const check = await verifySmtp();
  if (!check.ok) {
    await logIntegration("email", "test", false, check.message, user.id);
    return { error: check.message };
  }
  const sent = await sendMail(
    { to: address, subject: "Span Floors website: test email", text: `This is a test from the website admin (sent by ${user.name}). If you can read it, website emails are working.` },
    "test",
  );
  return sent ? { ok: true, tested: `Test email sent to ${address}. Check the inbox (and spam folder).` } : { error: "The mail server accepted the login but the email couldn’t be sent. See the integration log." };
}

/** Checks the Allsy.io address and key answer (read-only). */
export async function testAllsy(): Promise<SettingsState> {
  const user = await requireUser("settings.integrations");
  const { getSettings } = await import("@/server/settings");
  const cfg = await getSettings(["allsy.apiUrl", "allsy.apiKey"]);
  const base = (cfg["allsy.apiUrl"] || "https://allsy.fly.dev/api/content/v1").replace(/\/$/, "");
  if (!cfg["allsy.apiKey"]) return { error: "Add the Allsy.io API key first." };
  let result: SettingsState;
  try {
    const res = await fetch(`${base}/images?limit=1`, { method: "GET", headers: { Authorization: `Bearer ${cfg["allsy.apiKey"]}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (res.status === 401 || res.status === 403) result = { error: `Allsy.io refused the key (${res.status}).` };
    else if (!res.ok) result = { error: `Allsy.io answered ${res.status}.` };
    else {
      const j = (await res.json()) as { pagination?: { total?: number } };
      result = { ok: true, tested: `Connected. ${j.pagination?.total ?? "?"} photos in Allsy.io.` };
    }
  } catch (e) {
    result = { error: `Couldn’t reach Allsy.io: ${e instanceof Error ? e.message : e}` };
  }
  await logIntegration("allsy", "test", !result.error, result.error ?? result.tested ?? "", user.id);
  return result;
}

