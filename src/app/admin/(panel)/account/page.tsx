import { redirect } from "next/navigation";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { logActivity, requireUser, SESSION_COOKIE } from "@/server/auth";
import { hashPassword, sha256, verifyPassword } from "@/server/crypto";
import { btn, Field, formatDate, Input, Notice, PageHeader } from "@/components/admin/ui";
import TwoStepPanel from "@/components/admin/TwoStepPanel";

async function changePassword(form: FormData) {
  "use server";
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next.length < 10) redirect("/admin/account/?error=short");
  if (next !== confirm) redirect("/admin/account/?error=match");
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, me.id));
  if (!u || !(await verifyPassword(current, u.passwordHash))) redirect("/admin/account/?error=current");
  await db.update(schema.users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(schema.users.id, me.id));
  // Sign out other devices, keep this one.
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, me.id), ne(schema.sessions.id, sha256(token))));
  await logActivity(me.id, "update", "user", me.id, "Changed own password");
  redirect("/admin/account/?saved=1");
}

async function signOutSession(form: FormData) {
  "use server";
  const me = await requireUser();
  const id = String(form.get("id") ?? "");
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (id === "others") {
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, me.id), ne(schema.sessions.id, sha256(token))));
    await logActivity(me.id, "update", "user", me.id, "Signed out all other devices");
  } else if (/^[0-9a-f]{64}$/.test(id) && id !== sha256(token)) {
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, me.id), eq(schema.sessions.id, id)));
    await logActivity(me.id, "update", "user", me.id, "Signed out a device");
  }
  redirect("/admin/account/?signedout=1");
}

/** "Chrome on Mac" from a user agent (good enough to recognise your own devices). */
function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

const ERRORS: Record<string, string> = {
  short: "Use at least 10 characters.",
  match: "The new passwords don’t match.",
  current: "Your current password is incorrect.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; signedout?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  const [[row], sessions] = await Promise.all([
    db.select({ totpEnabled: schema.users.totpEnabled, recoveryCodes: schema.users.recoveryCodes }).from(schema.users).where(eq(schema.users.id, me.id)),
    db.select().from(schema.sessions).where(and(eq(schema.sessions.userId, me.id), gt(schema.sessions.expiresAt, new Date()))).orderBy(desc(schema.sessions.createdAt)),
  ]);
  const here = sha256(token);
  return (
    <>
      <PageHeader title="Your account" description={`${me.name} · ${me.email} · ${me.role}`} />
      <form action={changePassword} className="grid max-w-md gap-4">
        {sp.saved && <Notice tone="success">Password changed. Other devices have been signed out.</Notice>}
        {sp.error && <Notice tone="error">{ERRORS[sp.error]}</Notice>}
        <Field label="Current password" htmlFor="current">
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="New password" htmlFor="next" hint="At least 10 characters.">
          <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <button className={`${btn.primary} w-fit`}>Change password</button>
      </form>

      <hr className="my-12 max-w-3xl border-line" />
      <TwoStepPanel enabled={row?.totpEnabled ?? false} codesLeft={row?.recoveryCodes.length ?? 0} />

      <hr className="my-12 max-w-3xl border-line" />
      <section className="grid max-w-3xl gap-4">
        <div>
          <h2 className="text-title">Signed-in devices</h2>
          <p className="mt-1 text-2xs text-muted">Where your account is signed in. Sign out anything you don’t recognise, then change your password.</p>
        </div>
        {sp.signedout && <Notice tone="success">Signed out.</Notice>}
        <ul className="divide-y divide-line border-y border-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-2xs">
              <div className="min-w-0">
                <div className="text-body">
                  {device(s.userAgent)}
                  {s.id === here && <span className="ml-2 rounded-sm bg-[#2f6339]/10 px-1.5 py-px text-2xs text-[#2f6339]">This device</span>}
                </div>
                <div className="text-muted">
                  Signed in {formatDate(s.createdAt, true)}
                  {s.ip ? ` · ${s.ip}` : ""}
                </div>
              </div>
              {s.id !== here && (
                <form action={signOutSession}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className={btn.ghost}>Sign out</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {sessions.length > 1 && (
          <form action={signOutSession}>
            <input type="hidden" name="id" value="others" />
            <button className={btn.secondary}>Sign out everywhere else</button>
          </form>
        )}
      </section>
    </>
  );
}
