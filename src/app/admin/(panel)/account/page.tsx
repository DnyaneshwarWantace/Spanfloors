import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { logActivity, requireUser, SESSION_COOKIE } from "@/server/auth";
import { hashPassword, sha256, verifyPassword } from "@/server/crypto";
import { btn, Field, Input, Notice, PageHeader } from "@/components/admin/ui";

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

const ERRORS: Record<string, string> = {
  short: "Use at least 10 characters.",
  match: "The new passwords don’t match.",
  current: "Your current password is incorrect.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
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
    </>
  );
}
