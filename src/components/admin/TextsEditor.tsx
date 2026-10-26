"use client";

import { useState, useTransition } from "react";
import { saveConfig } from "@/app/admin/(panel)/settings/config-actions";
import { btn, inputCls, Notice } from "./ui";

/** Admin → Shared texts: words used on many pages. Empty boxes use the default shown as a placeholder. */
export default function TextsEditor({ defaults, saved, groups }: { defaults: Record<string, string>; saved: Record<string, string>; groups: Record<string, string> }) {
  const [values, setValues] = useState(saved);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const keys = Object.keys(defaults);
  const byGroup = Object.keys(groups).map((g) => ({ g, keys: keys.filter((k) => k.startsWith(`${g}.`)) }));
  const nice = (k: string) =>
    k
      .split(".")
      .slice(1)
      .join(" ")
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
      {byGroup.map(({ g, keys: ks }) => (
        <section key={g} className="grid gap-4 border border-line bg-white/40 p-5">
          <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">{groups[g]}</h2>
          {ks.map((k) => (
            <label key={k} className="grid gap-1.5 text-2xs font-medium">
              {nice(k)}
              <input value={values[k] ?? ""} maxLength={300} placeholder={defaults[k]} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} className={inputCls} />
            </label>
          ))}
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btn.primary}
          disabled={pending}
          onClick={() => start(async () => {
            const r = await saveConfig("config.texts", values);
            setMsg(r.error ? { tone: "error", text: r.error } : { tone: "success", text: "Saved. Empty boxes use the default text." });
          })}
        >
          {pending ? "Saving…" : "Save texts"}
        </button>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </div>
  );
}
