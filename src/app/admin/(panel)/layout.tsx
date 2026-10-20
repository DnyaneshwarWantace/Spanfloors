import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import { logout, requireUser } from "@/server/auth";

export const metadata: Metadata = {
  title: { absolute: "Admin · Span Floors" },
  robots: { index: false, follow: false },
};

async function signOut() {
  "use server";
  await logout();
  redirect("/admin/login/");
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-8 bg-ink px-4 py-6 text-paper lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <Link href="/admin/" className="flex items-center gap-3 px-2">
          <img src="/brand/span-floors-logo.png" alt="Span Floors" width={155} height={82} className="h-9 w-auto" />
          <span className="mono text-2xs text-paper/60">Admin</span>
        </Link>

        <Suspense>
          <AdminNav role={user.role} />
        </Suspense>

        <div className="mt-auto grid gap-3 border-t border-line-light pt-4 text-2xs">
          <Link href="/" target="_blank" className="px-2 text-paper/70 hover:text-paper">
            View website ↗
          </Link>
          <div className="flex items-center justify-between gap-2 px-2">
            <Link href="/admin/account/" className="min-w-0">
              <div className="truncate text-paper">{user.name}</div>
              <div className="truncate text-paper/50">
                {user.email} · <span className="capitalize">{user.role}</span>
              </div>
            </Link>
            <form action={signOut}>
              <button className="shrink-0 rounded-sm border border-line-light px-2 py-1 text-paper/70 hover:text-paper">Sign out</button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 px-6 pb-24 lg:px-10">{children}</div>
    </div>
  );
}
