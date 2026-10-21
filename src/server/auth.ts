import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { randomToken, sha256, verifyPassword } from "./crypto";

export const SESSION_COOKIE = "sf_session";
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

export type LoginResult = { user: SessionUser } | { error: "invalid" | "locked" };

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
  await logActivity(user.id, "login", "user", user.id, `${user.email} signed in`);
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
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

/** For admin pages and server actions: redirects to login if signed out; 403-style redirect if the role is too low. */
export async function requireUser(role: "editor" | "admin" = "editor"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/admin/login/");
  if (role === "admin" && user.role !== "admin") redirect("/admin/?denied=1");
  return user;
}

export async function logActivity(userId: string | null, action: string, entity: string, entityId: string | null, summary: string) {
  await db
    .insert(schema.activity)
    .values({ userId, action, entity, entityId, summary })
    .catch(() => undefined);
}
