"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReusable, updateReusable, type ReusableItem } from "@/app/admin/(panel)/content/builder-actions";
import { sectionDef } from "@/sections/registry";
import { btn, inputCls, Notice } from "../ui";
import { BuilderProvider } from "./context";
import FieldEditor from "./FieldEditor";

/** Edits one reusable section; saving updates every page that places it. */
export default function ReusableForm({ item, usedOn }: { item: ReusableItem; usedOn: number }) {
  const def = sectionDef(item.type);
  const [name, setName] = useState(item.name);
  const [data, setData] = useState(item.data);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!def) return <Notice tone="error">This section type no longer exists.</Notice>;

  const save = () =>
    start(async () => {
      const r = await updateReusable(item.id, name, { id: "reusable-edit", type: item.type, data });
      setMsg(r.error ? { tone: "error", text: r.error } : { tone: "success", text: usedOn ? `Saved. ${usedOn} page${usedOn === 1 ? "" : "s"} now show the change.` : "Saved." });
    });
  const remove = () =>
    start(async () => {
      const r = await deleteReusable(item.id);
      if (r.error) setMsg({ tone: "error", text: r.error });
      else router.push("/admin/reusable/");
    });

  return (
    <BuilderProvider initialValue={item.data} reusable={[]} canReuse={false}>
      <div className="grid max-w-3xl gap-5">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <label className="grid gap-1.5 text-2xs font-medium">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} />
        </label>
        <div className="grid gap-5 border border-line bg-white/50 p-4">
          <p className="text-2xs text-muted">{def.label} section</p>
          {def.fields.map((f) => (
            <FieldEditor key={f.name} field={f} id={`r-${f.name}`} value={data[f.name]} onChange={(v) => setData((d) => ({ ...d, [f.name]: v }))} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className={btn.danger} onClick={remove} disabled={pending || usedOn > 0} title={usedOn ? "Remove it from the pages that use it first" : undefined}>
            Delete
          </button>
        </div>
      </div>
    </BuilderProvider>
  );
}
