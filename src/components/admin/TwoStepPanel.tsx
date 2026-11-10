"use client";

import { useState, useTransition } from "react";
import { confirmTwoStep, newCodes, startTwoStep, stopTwoStep } from "@/app/admin/(panel)/account/actions";
import { btn, inputCls, Notice } from "./ui";

function Codes({ codes }: { codes: string[] }) {
  return (
    <div className="grid gap-3 border border-[#a0661f]/40 bg-[#a0661f]/8 p-4">
      <p className="text-2xs">
        <strong className="font-medium">Save these recovery codes now.</strong> Each one lets you sign in once if you lose your phone. They won’t be shown again.
      </p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-2xs">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <button type="button" className={`${btn.secondary} w-fit`} onClick={() => navigator.clipboard?.writeText(codes.join("\n")).catch(() => undefined)}>
        Copy codes
      </button>
    </div>
  );
}

/** Account → Two-step sign-in: set up with an authenticator app, recovery codes, turn off. */
export default function TwoStepPanel({ enabled: initial, codesLeft }: { enabled: boolean; codesLeft: number }) {
  const [enabled, setEnabled] = useState(initial);
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"" | "off" | "codes">("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError("");
      await fn();
    });

  return (
    <section className="grid max-w-md gap-4">
      <div>
        <h2 className="text-title">Two-step sign-in</h2>
        <p className="mt-1 text-2xs text-muted">
          {enabled
            ? `On. Signing in asks for a code from your authenticator app. ${codesLeft} recovery code${codesLeft === 1 ? "" : "s"} left.`
            : "Off. Turn it on so a stolen password alone can’t open the admin. You need an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password."}
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {codes && <Codes codes={codes} />}

      {!enabled && !setup && (
        <button type="button" className={`${btn.primary} w-fit`} disabled={pending} onClick={() => run(async () => {
          const r = await startTwoStep();
          if (r.error) setError(r.error);
          else setSetup({ qr: r.qr!, secret: r.secret! });
        })}>
          Set up two-step sign-in
        </button>
      )}

      {!enabled && setup && (
        <div className="grid gap-3 border border-line bg-white/40 p-4">
          <p className="text-2xs">1. Scan this with your authenticator app.</p>
          <div className="w-fit bg-white p-2" aria-label="QR code" dangerouslySetInnerHTML={{ __html: setup.qr }} />
          <p className="text-2xs text-muted">
            Can’t scan? Enter this key: <span className="font-mono text-ink">{setup.secret}</span>
          </p>
          <label className="grid gap-1.5 text-2xs">
            2. Enter the 6-digit code the app shows
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={`${inputCls} w-40 font-mono tracking-[0.2em]`} />
          </label>
          <button type="button" className={`${btn.primary} w-fit`} disabled={pending || value.replace(/\s/g, "").length !== 6} onClick={() => run(async () => {
            const r = await confirmTwoStep(value);
            if (r.error) return setError(r.error);
            setEnabled(true);
            setSetup(null);
            setValue("");
            setCodes(r.codes ?? null);
          })}>
            Turn on
          </button>
        </div>
      )}

      {enabled && !mode && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} onClick={() => setMode("codes")}>
            New recovery codes
          </button>
          <button type="button" className={btn.ghost} onClick={() => setMode("off")}>
            Turn off
          </button>
        </div>
      )}

      {enabled && mode && (
        <div className="grid gap-3 border border-line bg-white/40 p-4">
          <label className="grid gap-1.5 text-2xs">
            {mode === "off" ? "Your password" : "A current code from your app"}
            <input
              type={mode === "off" ? "password" : "text"}
              autoComplete={mode === "off" ? "current-password" : "one-time-code"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${inputCls} ${mode === "off" ? "" : "w-40 font-mono tracking-[0.2em]"}`}
            />
          </label>
          <div className="flex gap-2">
            <button type="button" className={btn.primary} disabled={pending || !value} onClick={() => run(async () => {
              const r = mode === "off" ? await stopTwoStep(value) : await newCodes(value);
              if (r.error) return setError(r.error);
              setValue("");
              if (mode === "off") {
                setEnabled(false);
                setCodes(null);
              } else setCodes(r.codes ?? null);
              setMode("");
            })}>
              {mode === "off" ? "Turn off two-step sign-in" : "Make new codes"}
            </button>
            <button type="button" className={btn.ghost} onClick={() => { setMode(""); setValue(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
