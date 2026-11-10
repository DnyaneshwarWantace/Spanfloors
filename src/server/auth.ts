import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { decrypt, encrypt, randomToken, sha256, verifyPassword } from "./crypto";
import { consumeRecoveryCode, verifyTotp } from "./totp";
import { can, type Permission } from "@/lib/permissions";

export const SESSION_COOKIE = "sf_session";
/** Readable by the site's scripts; only says "someone signed in here". The real check is the session. */
export const ADMIN_HINT_COOKIE = "sf_admin";
const SESSION_DAYS = 14;

export type SessionUser = Pick<User, "id" | "email" | "name" | "role">;

/* ---------- Brute-force protection ---------- */

const LIMITS = { email: 5, ip: 20 };
const LOCK_MINUTES = 15;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

async function isLocked(keys: string[]) {
  const rows = await db.select().from(schema.loginAttempts).where(sql`${schema.loginAttempts.key} in ${keys}`);
  return rows.some((r) => r.lockedUntil && r.lockedUntil > new Date());
}

async function recordFailure(key: string, limit: number) {
  const lockAt = new Date(Date.now() + LOCK_MINUTES * 60_000);
  await db
    .insert(schema.loginAttempts)
    .values({ key, failures: 1 })
    .onConflictDoUpdate({
      target: schema.loginAttempts.key,
      set: {
        // Reset the counter if the last failure was over an hour ago.
        failures: sql`case when ${schema.loginAttempts.lastAttemptAt} < now() - interval '1 hour' then 1 else ${schema.loginAttempts.failures} + 1 end`,
        lockedUntil: sql`case when ${schema.loginAttempts.failures} + 1 >= ${limit} then ${lockAt.toISOString()}::timestamptz else ${schema.loginAttempts.lockedUntil} end`,
        lastAttemptAt: new Date(),
      },
    });
}

/** True when the request reached us over HTTPS (directly or via a proxy such as Cloudflare/nginx). */
export async function isHttps() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") && !(h.get("host") ?? "").startsWith("localhost");
}

export type LoginResult = { user: SessionUser } | { twoStep: true } | { error: "invalid" | "locked" };

/** Checks email + password (with lockout); on success creates a session and sets the cookie. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase().slice(0, 254);
  const ip = await clientIp();
  const keys = [`email:${normalized}`, `ip:${ip}`];
  if (await isLocked(keys)) return { error: "locked" };

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, normalized));
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!user || !ok || !user.active) {
    await recordFailure(keys[0], LIMITS.email);
    await recordFailure(keys[1], LIMITS.ip);
    await logActivity(user?.id ?? null, "login_failed", "user", user?.id ?? null, `Failed sign-in for ${normalized} from ${ip}`);
    return { error: "invalid" };
  }
  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, keys[0]));

  // Two-step sign-in: the password was right, now ask for the authenticator code before creating a session.
  if (user.totpEnabled && user.totpSecret) {
    (await cookies()).set(TWO_STEP_COOKIE, encrypt(JSON.stringify({ u: user.id, e: Date.now() + TWO_STEP_MINUTES * 60_000 })), {
      httpOnly: true,
      secure: await isHttps(),
      sameSite: "lax",
      path: "/admin/",
      maxAge: TWO_STEP_MINUTES * 60,
    });
    return { twoStep: true };
  }
  return { user: await startSession(user, ip) };
}

/** Creates the session row and cookie for a fully signed-in user. */
async function startSession(user: User, ip: string, how = "signed in"): Promise<SessionUser> {
  const token = randomToken();
  const h = await headers();
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    ip,
  });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // HTTPS-only when actually served over HTTPS (live site). On http://localhost a secure cookie
    // is dropped by some browsers (Safari), which logged people out on every click.
    secure: await isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  // A plain marker (no secret) so the public site knows to ask whether to show the "Edit this page" bar.
  (await cookies()).set(ADMIN_HINT_COOKIE, "1", { secure: await isHttps(), sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
  await logActivity(user.id, "login", "user", user.id, `${user.email} ${how}`);
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/* ---------- Two-step sign-in (second screen) ---------- */

const TWO_STEP_COOKIE = "sf_2fa";
const TWO_STEP_MINUTES = 5;

/** The user waiting to enter their code, if the password step was passed in the last few minutes. */
export async function pendingTwoStep(): Promise<User | null> {
  const raw = (await cookies()).get(TWO_STEP_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { u, e } = JSON.parse(decrypt(raw)) as { u: string; e: number };
    if (typeof u !== "string" || !(e > Date.now())) return null;
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, u));
    return user?.active && user.totpEnabled && user.totpSecret ? user : null;
  } catch {
    return null;
  }
}

export type TwoStepResult = { user: SessionUser } | { error: "invalid" | "locked" | "expired" };

/** Checks the authenticator code (or a one-time recovery code) and finishes signing in. */
export async function finishTwoStep(code: string): Promise<TwoStepResult> {
  const user = await pendingTwoStep();
  if (!user) return { error: "expired" };
  const ip = await clientIp();
  const key = `2fa:${user.id}`;
  if (await isLocked([key, `ip:${ip}`])) return { error: "locked" };

  let how = "signed in (two-step)";
  let ok = verifyTotp(decrypt(user.totpSecret!), code);
  if (!ok && code.replace(/\s/g, "").length > 6) {
    const left = consumeRecoveryCode(user.recoveryCodes, code);
    if (left) {
      ok = true;
      how = `signed in with a recovery code (${left.length} left)`;
      await db.update(schema.users).set({ recoveryCodes: left }).where(eq(schema.users.id, user.id));
    }
  }
  if (!ok) {
    await recordFailure(key, LIMITS.email);
    await recordFailure(`ip:${ip}`, LIMITS.ip);
    await logActivity(user.id, "login_failed", "user", user.id, `Wrong two-step code for ${user.email} from ${ip}`);
    return { error: "invalid" };
  }
  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, key));
  (await cookies()).delete({ name: TWO_STEP_COOKIE, path: "/admin/" });
  return { user: await startSession(user, ip, how) };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
  jar.delete(ADMIN_HINT_COOKIE);
}

/** The signed-in user for this request, or null. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role, active: schema.users.active })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())));
  if (!row || !row.active) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
});

/**
 * For admin pages and server actions: redirects to the login page when signed out, and to the dashboard
 * (with a "not allowed" notice) when the user's role doesn't include this permission.
 */
export async function requireUser(permission: Permission = "dashboard"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/admin/login/");
  if (!can(user.role, permission)) redirect("/admin/?denied=1");
  return user;
}

export async function logActivity(userId: string | null, action: string, entity: string, entityId: string | null, summary: string) {
  await db
    .insert(schema.activity)
    .values({ userId, action, entity, entityId, summary })
    .catch(() => undefined);
}
