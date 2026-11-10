"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { testAllsy, testEmail, testTwentyConnection, type SettingsState } from "@/app/admin/(panel)/settings/actions";
import { btn, inputCls } from "./ui";

function Result({ r }: { r: SettingsState | null }) {
  if (!r) return null;
  return <span className={`text-2xs ${r.error ? "text-brand" : "text-[#2f6339]"}`}>{r.error ?? r.tested}</span>;
}

/** Admin → Integrations: one-click checks for email, Twenty (read-only) and Allsy.io. Every check is logged. */
export default function IntegrationTests({ email }: { email: string }) {
  const [to, setTo] = useState(email);
  const [res, setRes] = useState<Record<string, SettingsState | null>>({});
  const [busy, setBusy] = useState("");
  const [, start] = useTransition();
  const run = (k: string, fn: () => Promise<SettingsState>) =>
    start(async () => {
      setBusy(k);
      setRes((r) => ({ ...r, [k]: null }));
      const out = await fn().catch((e) => ({ error: String(e) }));
      setRes((r) => ({ ...r, [k]: out }));
      setBusy("");
    });

  return (
    <section className="mt-10 grid max-w-3xl gap-4 border border-line bg-white/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Check connections</h2>
        <Link href="/admin/settings/integrations/log/" className="text-2xs underline">
          Integration log
        </Link>
      </div>
      <div className="grid gap-2">
        <span className="text-2xs font-medium">Email</span>
        <div className="flex flex-wrap items-center gap-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} type="email" aria-label="Send test email to" className={`${inputCls} max-w-xs`} />
          <button type="button" className={btn.secondary} disabled={Boolean(busy)} onClick={() => run("email", () => testEmail(to))}>
            {busy === "email" ? "Sending…" : "Send test email"}
          </button>
          <Result r={res.email ?? null} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn.secondary} disabled={Boolean(busy)} onClick={() => run("twenty", testTwentyConnection)}>
          {busy === "twenty" ? "Testing…" : "Test Twenty"}
        </button>
        <Result r={res.twenty ?? null} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn.secondary} disabled={Boolean(busy)} onClick={() => run("allsy", testAllsy)}>
          {busy === "allsy" ? "Testing…" : "Test Allsy.io"}
        </button>
        <Result r={res.allsy ?? null} />
      </div>

    </section>
  );
}
