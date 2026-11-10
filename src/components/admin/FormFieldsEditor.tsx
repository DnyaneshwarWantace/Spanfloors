"use client";

import { useState, useTransition } from "react";
import Dropdown from "@/components/ui/Dropdown";
import { saveConfig } from "@/app/admin/(panel)/settings/config-actions";
import { FIELD_LABELS, FORM_FIELDS, FORM_LABELS, fieldModes, NEEDS_CONTACT, type FieldMode, type FormKey, type FormsConfig } from "@/lib/form-fields";
import { btn, Notice } from "./ui";

const MODES = [
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
  { value: "hidden", label: "Hidden" },
];

/** Admin → Forms: per form, which extra fields are asked and whether they must be filled. */
export default function FormFieldsEditor({ saved }: { saved: FormsConfig }) {
  const forms = Object.keys(FORM_FIELDS) as FormKey[];
  const [cfg, setCfg] = useState<Record<string, Record<string, FieldMode>>>(() => Object.fromEntries(forms.map((f) => [f, fieldModes(saved, f)])));
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      {forms.map((form) => (
        <section key={form} className="grid gap-3 border border-line bg-white/40 p-5">
          <div>
            <h3 className="text-2xs font-semibold tracking-[0.06em] uppercase">{FORM_LABELS[form]}</h3>
            <p className="mt-1 text-2xs text-muted">
              Always asked: name{form === "sample" ? ", phone, samples, delivery address and PIN code" : form === "dealer" ? ", company, phone and email" : form === "download" ? " and email" : form === "video_call" || form === "visit" ? " and a day and time" : ""}.
              {NEEDS_CONTACT.includes(form) && " Visitors give a phone or an email, so keep at least one of them."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.keys(FORM_FIELDS[form]).map((field) => (
              <div key={field} className="flex min-w-0 items-center justify-between gap-3 border-b border-line/60 py-1.5">
                <span className="text-2xs">{FIELD_LABELS[field]}</span>
                <Dropdown
                  size="sm"
                  aria-label={`${FORM_LABELS[form]}: ${FIELD_LABELS[field]}`}
                  options={MODES}
                  value={cfg[form][field]}
                  onChange={(v) => setCfg((c) => ({ ...c, [form]: { ...c[form], [field]: v as FieldMode } }))}
                  className="w-32"
                />
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btn.primary}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveConfig("config.forms", cfg);
              setMsg(r.error ? { tone: "error", text: r.error } : { tone: "success", text: "Saved. The website forms are updated." });
            })
          }
        >
          {pending ? "Saving…" : "Save form fields"}
        </button>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </div>
  );
}
