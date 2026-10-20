import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Anti-bot form token: a signed timestamp issued when the form is shown.
 * A submission is accepted only if the token is genuine, at least MIN_SECONDS old
 * (humans take a few seconds to fill a form) and not older than MAX_HOURS.
 */
const MIN_SECONDS = 3;
const MAX_HOURS = 12;

function sign(ts: string) {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set");
  return createHmac("sha256", secret).update(`form:${ts}`).digest("base64url");
}

export function issueFormToken(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

export function checkFormToken(token: unknown, now = Date.now()): "ok" | "invalid" | "too_fast" | "expired" {
  if (typeof token !== "string" || !token.includes(".")) return "invalid";
  const [ts, sig] = token.split(".");
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(sig ?? "");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = (now - Number(ts)) / 1000;
  if (!Number.isFinite(age) || age < 0) return "invalid";
  if (age < MIN_SECONDS) return "too_fast";
  if (age > MAX_HOURS * 3600) return "expired";
  return "ok";
}
