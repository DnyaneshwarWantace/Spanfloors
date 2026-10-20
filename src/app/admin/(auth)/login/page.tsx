import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, login } from "@/server/auth";
import { btn, Field, Input, Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: { absolute: "Sign in · Span Floors admin" }, robots: { index: false, follow: false } };

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const result = await login(email, password);
  if ("error" in result) redirect(`/admin/login/?error=${result.error}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  // Only allow redirects back into the admin.
  redirect(next.startsWith("/admin/") ? next : "/admin/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await currentUser()) redirect("/admin/");
  const { error, next } = await searchParams;

  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="wood opacity-80" style={{ ["--tone" as string]: "#4a3627", ["--boards" as string]: 5 }} />
        <div className="absolute bottom-10 left-10 max-w-sm text-paper">
          <img src="/brand/span-floors-logo.png" alt="Span Floors" width={155} height={82} className="mb-6 h-14 w-auto" />
          <p className="text-body text-paper/80">Manage blog posts, pages, media, integrations and site settings.</p>
        </div>
      </div>

      <div className="grid place-items-center px-6 py-16">
        <form action={signIn} className="grid w-full max-w-sm gap-5">
          <div>
            <img src="/brand/span-floors-logo-dark.png" alt="Span Floors" width={155} height={82} className="mb-8 h-12 w-auto lg:hidden" />
            <h1 className="mono text-title">Sign in</h1>
            <p className="mt-1.5 text-2xs text-muted">Span Floors admin</p>
          </div>
          {error === "locked" ? (
            <Notice tone="error">Too many failed attempts. Sign-in is paused for 15 minutes.</Notice>
          ) : (
            error && <Notice tone="error">That email and password don’t match an active account.</Notice>
          )}
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <button type="submit" className={`${btn.primary} h-11`}>
            Sign in
          </button>
          <p className="text-2xs text-muted">Forgot your password? Ask an admin to reset it from Users.</p>
        </form>
      </div>
    </main>
  );
}
