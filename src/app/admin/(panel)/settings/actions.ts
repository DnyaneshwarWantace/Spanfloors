"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { logActivity, requireUser } from "@/server/auth";
import { saveSettings, SETTING_DEFS, type SettingKey } from "@/server/settings";

export type SettingsState = { ok?: boolean; error?: string; tested?: string };

/** Saves one settings group. Secret fields left blank keep their current value; "clear" removes them. */
export async function saveSettingsGroup(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const group = String(form.get("_group") ?? "");
  const user = await requireUser(group === "integrations" ? "admin" : "editor");
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
  await requireUser("admin");
  const { getSettings } = await import("@/server/settings");
  const cfg = await getSettings(["twenty.apiUrl", "twenty.apiKey"]);
  if (!cfg["twenty.apiKey"]) return { error: "No Twenty API key saved." };
  try {
    const res = await fetch(`${cfg["twenty.apiUrl"] ?? "https://api.twenty.com"}/rest/masterProducts?limit=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg["twenty.apiKey"]}` },
      cache: "no-store",
    });
    if (!res.ok) return { error: `Twenty answered ${res.status}. Check the URL and key.` };
    const j = (await res.json()) as { totalCount?: number };
    return { ok: true, tested: `Connected. ${j.totalCount ?? "?"} products in Twenty.` };
  } catch (e) {
    return { error: `Couldn’t reach Twenty: ${e instanceof Error ? e.message : e}` };
  }
}
