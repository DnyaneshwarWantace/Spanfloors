"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { CONFIG, validateConfig, type ConfigKey } from "@/server/site-config";

const LABELS: Record<ConfigKey, string> = {
  "config.identity": "logo and icons",
  "config.contact": "contact details",
  "config.studios": "studios",
  "config.tracking": "tracking codes",
  "config.cookies": "cookie banner",
  "config.announcement": "announcement bar",
  "config.header": "header menu",
  "config.footer": "footer menu",
  "config.texts": "shared texts",
  "config.forms": "form fields",
};

/** Saves one structured site setting after checking it on the server. */
export async function saveConfig(key: string, value: unknown): Promise<{ ok?: boolean; error?: string }> {
  // Tracking codes run scripts on every page, so only admins may change them.
  const user = await requireUser(key === "config.tracking" ? "settings.integrations" : key === "config.forms" ? "settings.forms" : "settings.site");
  if (!(key in CONFIG)) return { error: "Unknown setting." };
  const k = key as ConfigKey;
  const checked = validateConfig(k, value);
  if (!checked.ok) return { error: checked.error };
  await db
    .insert(schema.settings)
    .values({ key: k, value: checked.value as never, secret: false, updatedBy: user.id })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: checked.value as never, updatedBy: user.id, updatedAt: new Date() } });
  await logActivity(user.id, "update", "settings", k, `Updated ${LABELS[k]}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
