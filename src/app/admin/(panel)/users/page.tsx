import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { hashPassword, randomToken } from "@/server/crypto";
import { Badge, btn, formatDate, inputCls, Notice, PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Temporary passwords are shown once via a 60-second, admin-path-only cookie (never in the URL). */
async function flashPassword(email: string, temp: string, reset: boolean) {
  (await cookies()).set("sf_flash", JSON.stringify({ email, temp, reset }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/users/",
    maxAge: 60,
  });
}

async function inviteUser(form: FormData) {
  "use server";
  const me = await requireUser("admin");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const role = form.get("role") === "admin" ? "admin" : "editor";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) redirect("/admin/users/?error=invalid");
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (exists) redirect("/admin/users/?error=exists");
  const temp = randomToken(9);
  await db.insert(schema.users).values({ email, name, role, passwordHash: await hashPassword(temp) });
  await logActivity(me.id, "create", "user", null, `Added ${role} ${email}`);
  await flashPassword(email, temp, false);
  redirect("/admin/users/");
}

async function updateUser(form: FormData) {
  "use server";
  const me = await requireUser("admin");
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  if (id === me.id && op !== "reset") redirect("/admin/users/?error=self");
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u) redirect("/admin/users/");
  if (op === "role") {
    const role = u.role === "admin" ? "editor" : "admin";
    await db.update(schema.users).set({ role, updatedAt: new Date() }).where(eq(schema.users.id, id));
    await logActivity(me.id, "update", "user", id, `${u.email} is now ${role}`);
  } else if (op === "active") {
    await db.update(schema.users).set({ active: !u.active, updatedAt: new Date() }).where(eq(schema.users.id, id));
    if (u.active) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    await logActivity(me.id, "update", "user", id, `${u.active ? "Deactivated" : "Reactivated"} ${u.email}`);
  } else if (op === "reset") {
    const temp = randomToken(9);
    await db.update(schema.users).set({ passwordHash: await hashPassword(temp), updatedAt: new Date() }).where(eq(schema.users.id, id));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    await logActivity(me.id, "update", "user", id, `Reset password for ${u.email}`);
    await flashPassword(u.email, temp, true);
  }
  redirect("/admin/users/");
}

const ERRORS: Record<string, string> = {
  invalid: "Enter a name and a valid email.",
  exists: "Someone with that email already has an account.",
  self: "You can’t change your own role or deactivate yourself.",
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireUser("admin");
  const sp = await searchParams;
  let flash: { email: string; temp: string; reset: boolean } | null = null;
  try {
    flash = JSON.parse((await cookies()).get("sf_flash")?.value ?? "null");
  } catch {}
  const users = await db.select().from(schema.users).orderBy(asc(schema.users.createdAt));

  return (
    <>
      <PageHeader title="Users" description="Admins manage everything, including API keys and users. Editors manage blog posts, pages, media, site settings and redirects." />

      <div className="mb-6 grid gap-3">
        {sp.error && <Notice tone="error">{ERRORS[sp.error] ?? "Something went wrong."}</Notice>}
        {flash && (
          <Notice tone="success">
            {flash.reset ? "Password reset" : "Account created"} for <strong>{flash.email}</strong>. Temporary password:{" "}
            <code className="bg-white px-1.5 py-0.5 font-mono">{flash.temp}</code>{" "}
            — share it securely; they should change it under Account after signing in. It disappears within a minute.
          </Notice>
        )}
      </div>

      <form action={inviteUser} className="mb-8 grid items-end gap-3 border border-line bg-white/40 p-4 md:grid-cols-[1fr_1fr_9rem_auto]">
        <label className="grid gap-1.5 text-2xs font-medium">
          Name
          <input name="name" required className={inputCls} />
        </label>
        <label className="grid gap-1.5 text-2xs font-medium">
          Email
          <input name="email" type="email" required className={inputCls} />
        </label>
        <label className="grid gap-1.5 text-2xs font-medium">
          Role
          <select name="role" className={inputCls}>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className={btn.primary}>Add user</button>
      </form>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[52rem] text-left text-2xs">
          <thead className="bg-paper-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Last sign-in</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="text-body">
                    {u.name} {u.id === me.id && <span className="text-muted">(you)</span>}
                  </div>
                  <div className="text-muted">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge value={u.role} />
                </td>
                <td className="px-4 py-3">{u.active ? "Active" : <span className="text-muted">Deactivated</span>}</td>
                <td className="px-4 py-3 text-muted">{formatDate(u.lastLoginAt, true)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {u.id !== me.id && (
                      <>
                        <form action={updateUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="op" value="role" />
                          <button className={btn.ghost}>Make {u.role === "admin" ? "editor" : "admin"}</button>
                        </form>
                        <form action={updateUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="op" value="active" />
                          <button className={btn.ghost}>{u.active ? "Deactivate" : "Reactivate"}</button>
                        </form>
                      </>
                    )}
                    <form action={updateUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="op" value="reset" />
                      <button className={btn.ghost}>Reset password</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
