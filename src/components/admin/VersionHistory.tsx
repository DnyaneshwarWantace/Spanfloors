"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listVersions, previewVersion, restoreVersion, type VersionItem } from "@/app/admin/(panel)/content/preview-actions";
import PreviewModal from "./PreviewModal";
import { btn } from "./ui";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Every saved version of a page or post: view it, compare it with now, or put it back. */
export default function VersionHistory({ contentId, type }: { contentId: string; type: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<VersionItem[] | null>(null);
  const [preview, setPreview] = useState<{ id: string; title: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const load = () => start(async () => setItems(await listVersions(contentId)));

  return (
    <section className="min-w-0 border border-line bg-white/40 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!items) load();
        }}
      >
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Version history</h2>
        <span className="text-2xs text-muted">{items ? `${items.length} saved` : open ? "Loading…" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-2">
          {msg && <p className="text-2xs text-brand">{msg}</p>}
          {items?.length === 0 && <p className="text-2xs text-muted">Versions are saved each time you save. None yet.</p>}
          <ol className="grid max-h-[26rem] gap-1 overflow-y-auto">
            {items?.map((v, i) => (
              <li key={v.id} className="border border-line bg-paper px-3 py-2 text-2xs">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-medium tabular-nums">{when(v.createdAt)}</span>
                  <span className="text-muted capitalize">{i === 0 ? "current" : v.status}</span>
                </div>
                <div className="truncate text-muted">
                  {v.by ?? "Someone"}
                  {v.note ? ` · ${v.note}` : ""}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  <button
                    type="button"
                    className="underline"
                    onClick={() =>
                      start(async () => {
                        const r = await previewVersion(v.id);
                        if (r.id) setPreview({ id: r.id, title: `Version from ${when(v.createdAt)}` });
                        else setMsg(r.error ?? "");
                      })
                    }
                  >
                    View
                  </button>
                  {i > 0 && (
                    <>
                      <Link href={`/admin/content/${contentId}/compare/?type=${type}&a=${v.id}&b=${items[0].id}`} className="underline">
                        Compare with current
                      </Link>
                      {confirm === v.id ? (
                        <span className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-brand underline"
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const r = await restoreVersion(v.id);
                                if (r.error) setMsg(r.error);
                                else {
                                  setConfirm(null);
                                  router.refresh();
                                  window.location.reload();
                                }
                              })
                            }
                          >
                            Yes, restore it
                          </button>
                          <button type="button" className="underline" onClick={() => setConfirm(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="underline" onClick={() => setConfirm(v.id)}>
                          Restore
                        </button>
                      )}
                    </>
                  )}
                </div>
                {confirm === v.id && <p className="mt-1 text-muted">The content goes back to this version. Today’s version stays in the history, so you can undo it.</p>}
              </li>
            ))}
          </ol>
          {items && items.length > 0 && (
            <button type="button" className={`${btn.ghost} w-fit px-0`} onClick={load}>
              Refresh
            </button>
          )}
        </div>
      )}
      {preview && <PreviewModal previewId={preview.id} title={preview.title} onClose={() => setPreview(null)} />}
    </section>
  );
}
