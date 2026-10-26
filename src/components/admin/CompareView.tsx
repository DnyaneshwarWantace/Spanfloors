"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreSection, restoreVersion } from "@/app/admin/(panel)/content/preview-actions";
import type { FieldChange, SectionChange } from "@/server/revision-diff";
import { PreviewFrame } from "./PreviewModal";
import { btn, Notice } from "./ui";

const STATUS: Record<SectionChange["status"], { label: string; cls: string }> = {
  added: { label: "Added", cls: "bg-[#3d7a4a]/12 text-[#2f6339]" },
  removed: { label: "Removed", cls: "bg-brand/10 text-brand" },
  changed: { label: "Changed", cls: "bg-[#a08a62]/18 text-[#6e5a35]" },
  moved: { label: "Moved", cls: "bg-ink/8 text-ink-2" },
  same: { label: "Same", cls: "text-muted" },
};

export default function CompareView({
  contentId,
  type,
  older,
  newer,
  fields,
  sections,
}: {
  contentId: string;
  type: string;
  older: { revisionId: string; label: string; previewId: string };
  newer: { label: string; previewId: string };
  fields: FieldChange[];
  sections: SectionChange[];
}) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const changed = sections.filter((s) => s.status !== "same");

  const bringBack = (sectionId: string) =>
    start(async () => {
      const r = await restoreSection(older.revisionId, sectionId);
      setMsg(r.error ? { tone: "error", text: r.error } : { tone: "success", text: "Section brought back. The page was saved as a new version." });
      if (!r.error) router.push(`/admin/content/${contentId}/?type=${type}`);
    });

  return (
    <div className="grid gap-6">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <section className="min-w-0 border border-line bg-white/40 p-4">
          <h2 className="mb-3 text-2xs font-semibold tracking-[0.06em] uppercase">Sections</h2>
          {changed.length === 0 ? (
            <p className="text-2xs text-muted">No section changes.</p>
          ) : (
            <ul className="grid gap-1.5">
              {changed.map((s) => (
                <li key={s.id} className="flex min-w-0 flex-wrap items-center gap-2 text-2xs">
                  <span className={`px-1.5 py-0.5 ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {(s.status === "removed" || s.status === "changed") && (
                    <button type="button" className="underline disabled:opacity-50" disabled={pending} onClick={() => bringBack(s.id)}>
                      {s.status === "removed" ? "Bring it back" : "Use the older version"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="min-w-0 border border-line bg-white/40 p-4">
          <h2 className="mb-3 text-2xs font-semibold tracking-[0.06em] uppercase">Other changes</h2>
          {fields.length === 0 ? (
            <p className="text-2xs text-muted">Title, SEO and settings are the same.</p>
          ) : (
            <dl className="grid gap-2 text-2xs">
              {fields.map((f) => (
                <div key={f.field} className="min-w-0">
                  <dt className="font-medium">{f.label}</dt>
                  <dd className="break-words text-muted">
                    <span className="line-through">{f.before}</span> → <span className="text-ink">{f.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="group" aria-label="Screen size">
          {(["desktop", "phone"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className="h-8 border border-line px-3 text-2xs capitalize aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper">
              {d}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={btn.secondary}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await restoreVersion(older.revisionId);
              if (r.error) setMsg({ tone: "error", text: r.error });
              else router.push(`/admin/content/${contentId}/?type=${type}`);
            })
          }
        >
          Restore the whole older version
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        {[older, newer].map((v) => (
          <figure key={v.previewId} className="min-w-0">
            <figcaption className="mb-2 text-2xs text-muted">{v.label}</figcaption>
            <div className={device === "phone" ? "mx-auto max-w-[390px]" : ""}>
              <PreviewFrame src={`/preview/${v.previewId}/?frame=1`} device={device} height={2400} />
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
