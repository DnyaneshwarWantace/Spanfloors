import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import MobileNav from "@/components/admin/MobileNav";
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

  const sidebar = (
    <>
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
          <div className="grid min-w-0 gap-3 rounded-sm bg-white/5 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-paper/15 text-body text-paper">
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-body text-paper">{user.name}</span>
                  <span className="shrink-0 rounded-sm bg-paper/15 px-1.5 py-px text-2xs capitalize text-paper/80">{user.role}</span>
                </div>
                <div className="truncate text-paper/50" title={user.email}>
                  {user.email}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/admin/account/"
                className="flex h-8 items-center justify-center rounded-sm border border-line-light whitespace-nowrap text-paper/80 transition-colors hover:bg-white/10 hover:text-paper"
              >
                Account
              </Link>
              <form action={signOut} className="contents">
                <button className="flex h-8 items-center justify-center rounded-sm border border-line-light whitespace-nowrap text-paper/80 transition-colors hover:bg-white/10 hover:text-paper">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
    </>
  );

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Phones & tablets: top bar + slide-in menu */}
      <Suspense>
        <MobileNav>{sidebar}</MobileNav>
      </Suspense>

      {/* Large screens: fixed sidebar */}
      <aside className="hidden flex-col gap-8 bg-ink px-4 py-6 text-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">{sidebar}</aside>

      <div className="min-w-0 overflow-x-clip px-4 pb-24 sm:px-6 lg:px-10">{children}</div>
    </div>
  );
}
