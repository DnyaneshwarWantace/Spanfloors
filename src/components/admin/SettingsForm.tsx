"use client";

import { useActionState, useState, useTransition } from "react";
import { saveSettingsGroup, testTwentyConnection, type SettingsState } from "@/app/admin/(panel)/settings/actions";
import { btn, inputCls, Notice } from "./ui";

export type SettingRow = { key: string; group: string; label: string; secret: boolean; source: string; value: string };
export type SettingSection = { title: string; description?: string; keys: string[] };

const SOURCE: Record<string, string> = { admin: "Saved here", env: "From server .env", default: "Default", unset: "Not set" };

export default function SettingsForm({ group, rows, sections, showTwentyTest = false }: { group: string; rows: SettingRow[]; sections: SettingSection[]; showTwentyTest?: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsGroup, {});
  const [test, setTest] = useState<SettingsState | null>(null);
  const [testing, startTest] = useTransition();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return (
    <form action={action} className="grid max-w-3xl gap-6">
      <input type="hidden" name="_group" value={group} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="success">Settings saved.</Notice>}

      {sections.map((s) => (
        <section key={s.title} className="border border-line bg-white/40">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">{s.title}</h2>
            {s.description && <p className="mt-1 text-2xs text-muted">{s.description}</p>}
          </div>
          <div className="grid gap-5 p-5">
            {s.keys.map((key) => {
              const r = byKey.get(key);
              if (!r) return null;
              return (
                <div key={key} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor={key} className="text-2xs font-medium">
                      {r.label}
                    </label>
                    <span className="text-2xs text-muted">{SOURCE[r.source]}</span>
                  </div>
                  {r.secret ? (
                    <>
                      <input
                        id={key}
                        name={key}
                        type="password"
                        autoComplete="off"
                        placeholder={r.value ? `Current: ${r.value} — leave blank to keep` : "Paste the key"}
                        className={`${inputCls} font-mono`}
                      />
                      {r.source === "admin" && (
                        <label className="flex items-center gap-2 text-2xs text-muted">
                          <input type="checkbox" name={`${key}__clear`} /> Remove the saved value
                        </label>
                      )}
                    </>
                  ) : r.value.trim().startsWith("{") || key.endsWith(".config") || key.endsWith(".recipients") ? (
                    <textarea id={key} name={key} defaultValue={r.value.startsWith("{") ? JSON.stringify(JSON.parse(r.value), null, 2) : r.value} rows={8} spellCheck={false} className={`${inputCls} h-auto py-2 font-mono text-2xs`} />
                  ) : (
                    <input id={key} name={key} defaultValue={r.value} className={inputCls} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button className={btn.primary} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {showTwentyTest && (
          <button type="button" className={btn.secondary} disabled={testing} onClick={() => startTest(async () => setTest(await testTwentyConnection()))}>
            {testing ? "Testing…" : "Test Twenty connection"}
          </button>
        )}
        {test && <span className={`text-2xs ${test.error ? "text-brand" : "text-[#2f6339]"}`}>{test.error ?? test.tested}</span>}
      </div>
    </form>
  );
}
