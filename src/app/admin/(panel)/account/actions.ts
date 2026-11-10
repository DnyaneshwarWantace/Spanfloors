"use server";

import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { decrypt, encrypt, verifyPassword } from "@/server/crypto";
import { newRecoveryCodes, newTotpSecret, otpauthUrl, verifyTotp } from "@/server/totp";

type Result = { error?: string; codes?: string[]; ok?: boolean };

async function me() {
  const user = await requireUser();
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  return row!;
}

/** Step 1 of turning on two-step sign-in: a new secret (not active until a code is confirmed). */
export async function startTwoStep(): Promise<{ error?: string; qr?: string; secret?: string }> {
  const u = await me();
  if (u.totpEnabled) return { error: "Two-step sign-in is already on." };
  const secret = newTotpSecret();
  await db.update(schema.users).set({ totpSecret: encrypt(secret), updatedAt: new Date() }).where(eq(schema.users.id, u.id));
  const qr = await QRCode.toString(otpauthUrl(secret, u.email), { type: "svg", margin: 1, width: 200 });
  return { qr, secret: secret.replace(/(.{4})/g, "$1 ").trim() };
}

/** Step 2: the first code from the app proves it was set up; turns two-step on and returns recovery codes (shown once). */
export async function confirmTwoStep(code: string): Promise<Result> {
  const u = await me();
  if (u.totpEnabled) return { error: "Two-step sign-in is already on." };
  if (!u.totpSecret) return { error: "Start the setup again." };
  if (!verifyTotp(decrypt(u.totpSecret), code)) return { error: "That code didn’t match. Check the phone’s time is set automatically and try the current code." };
  const { codes, hashes } = newRecoveryCodes();
  await db.update(schema.users).set({ totpEnabled: true, recoveryCodes: hashes, updatedAt: new Date() }).where(eq(schema.users.id, u.id));
  await logActivity(u.id, "update", "user", u.id, "Turned on two-step sign-in");
  return { ok: true, codes };
}

/** New recovery codes (the old ones stop working). Needs a current app code. */
export async function newCodes(code: string): Promise<Result> {
  const u = await me();
  if (!u.totpEnabled || !u.totpSecret) return { error: "Two-step sign-in is off." };
  if (!verifyTotp(decrypt(u.totpSecret), code)) return { error: "That code didn’t match." };
  const { codes, hashes } = newRecoveryCodes();
  await db.update(schema.users).set({ recoveryCodes: hashes, updatedAt: new Date() }).where(eq(schema.users.id, u.id));
  await logActivity(u.id, "update", "user", u.id, "Made new two-step recovery codes");
  return { ok: true, codes };
}

/** Turns two-step sign-in off. Needs the account password. */
export async function stopTwoStep(password: string): Promise<Result> {
  const u = await me();
  if (!(await verifyPassword(password, u.passwordHash))) return { error: "That password is incorrect." };
  await db.update(schema.users).set({ totpEnabled: false, totpSecret: null, recoveryCodes: [], updatedAt: new Date() }).where(eq(schema.users.id, u.id));
  await logActivity(u.id, "update", "user", u.id, "Turned off two-step sign-in");
  return { ok: true };
}
