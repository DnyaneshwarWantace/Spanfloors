import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, finishTwoStep, pendingTwoStep } from "@/server/auth";
import { btn, Field, Input, Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: { absolute: "Two-step sign-in · Span Floors admin" }, robots: { index: false, follow: false } };

async function verify(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").slice(0, 40);
  const next = String(formData.get("next") ?? "");
  const result = await finishTwoStep(code);
  if ("error" in result) {
    if (result.error === "expired") redirect("/admin/login/?error=expired");
    redirect(`/admin/login/code/?error=${result.error}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  redirect(next.startsWith("/admin/") ? next : "/admin/");
}

export default async function TwoStepPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; recovery?: string }> }) {
  if (await currentUser()) redirect("/admin/");
  const user = await pendingTwoStep();
  if (!user) redirect("/admin/login/?error=expired");
  const { error, next, recovery } = await searchParams;
  const useRecovery = recovery === "1";

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 py-16">
      <form action={verify} className="grid w-full max-w-sm gap-5">
        <div>
          <img src="/brand/span-floors-logo-dark.png" alt="Span Floors" width={155} height={82} className="mb-8 h-12 w-auto" />
          <h1 className="mono text-title">Two-step sign-in</h1>
          <p className="mt-1.5 text-2xs text-muted">
            {useRecovery ? "Enter one of the recovery codes you saved when you turned on two-step sign-in. Each code works once." : "Open your authenticator app and enter the 6-digit code for Span Floors admin."}
          </p>
        </div>
        {error === "locked" && <Notice tone="error">Too many wrong codes. Sign-in is paused for 15 minutes.</Notice>}
        {error === "invalid" && <Notice tone="error">That code didn’t work. Codes change every 30 seconds; try the current one.</Notice>}
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label={useRecovery ? "Recovery code" : "Code"} htmlFor="code">
          <Input
            id="code"
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            {...(useRecovery ? { placeholder: "xxxx-xxxx", maxLength: 20 } : { inputMode: "numeric" as const, pattern: "[0-9 ]{6,7}", maxLength: 7, placeholder: "123 456" })}
            className="font-mono tracking-[0.2em]"
          />
        </Field>
        <button type="submit" className={`${btn.primary} h-11`}>
          Continue
        </button>
        <div className="flex flex-wrap justify-between gap-2 text-2xs text-muted">
          <Link href={`/admin/login/code/?${new URLSearchParams({ ...(next ? { next } : {}), ...(useRecovery ? {} : { recovery: "1" }) })}`} className="underline">
            {useRecovery ? "Use the app code instead" : "Lost your phone? Use a recovery code"}
          </Link>
          <Link href="/admin/login/" className="underline">
            Start again
          </Link>
        </div>
      </form>
    </main>
  );
}
