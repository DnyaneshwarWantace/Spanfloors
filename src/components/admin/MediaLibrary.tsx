"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Dropdown from "@/components/ui/Dropdown";
import { deleteMedia, listMedia, mediaAvailability, updateMedia, uploadMedia, type MediaItem } from "@/app/admin/(panel)/media/actions";
import { btn, inputCls } from "./ui";

type Kind = "all" | "image" | "document" | "video";

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b ? `${Math.round(b / 1e3)} KB` : "—");

function Thumb({ m }: { m: MediaItem }) {
  if (!m.available) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-paper-2 p-2 text-center text-2xs leading-snug text-muted" title="This file hasn’t been copied from the old website yet">
        <span>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto mb-1 size-4" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" />
          </svg>
          Not imported yet
        </span>
      </div>
    );
  }
  if (m.mime.startsWith("image/")) {
    return (
      <img
        src={m.url}
        alt={m.alt}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
      />
    );
  }
  return (
    <div className="absolute inset-0 grid place-items-center bg-paper-2 text-2xs text-muted uppercase">{m.mime.split("/")[1]?.slice(0, 4)}</div>
  );
}

/**
 * Media library grid. In "picker" mode clicking an item calls onPick instead of opening details.
 */
export default function MediaLibrary({ picker = false, onPick, initialKind = "all" }: { picker?: boolean; onPick?: (m: MediaItem) => void; initialKind?: Kind }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>(initialKind);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [availability, setAvailability] = useState<{ total: number; available: number } | null>(null);
  useEffect(() => {
    mediaAvailability().then(setAvailability).catch(() => {});
  }, []);
  const [loading, startLoad] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(
    (p = 1) =>
      startLoad(async () => {
        const res = await listMedia({ q: q.trim() || undefined, kind, page: p, perPage: picker ? 36 : 48 });
        setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(p);
      }),
    [q, kind, picker],
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), 250);
    return () => clearTimeout(t);
  }, [load]);

  const upload = (files: FileList | File[]) => {
    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    startUpload(async () => {
      const res = await uploadMedia(form);
      setErrors(res.errors);
      setItems((prev) => [...res.items, ...prev]);
      setTotal((t) => t + res.items.length);
      if (picker && res.items[0] && onPick) onPick(res.items[0]);
    });
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
      }}
      className={`relative ${dragging ? "outline-2 outline-offset-4 outline-ink outline-dashed" : ""}`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file name or alt text…" className={`${inputCls} h-9 w-64`} aria-label="Search media" />
        <Dropdown
          size="sm"
          className="w-44"
          aria-label="File type"
          value={kind}
          onChange={(v) => setKind(v as Kind)}
          options={[
            { value: "all", label: "All files" },
            { value: "image", label: "Images" },
            { value: "document", label: "Documents (PDF)" },
            { value: "video", label: "Videos" },
          ]}
        />
        <span className="text-2xs text-muted tabular-nums">{total.toLocaleString("en-IN")} files</span>
        {availability && availability.available < availability.total && (
          <span className="text-2xs text-[#a0661f] tabular-nums" title="Records imported from the old website whose files still need copying (main WordPress backup).">
            · {availability.available.toLocaleString("en-IN")} of {availability.total.toLocaleString("en-IN")} files on this server
          </span>
        )}
        <div className="ml-auto">
          <input ref={fileInput} type="file" multiple hidden accept="image/*,application/pdf,video/mp4" onChange={(e) => e.target.files && upload(e.target.files)} />
          <button type="button" className={btn.primary} onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload files"}
          </button>
        </div>
      </div>

      <p className="mb-4 text-2xs text-muted">Drag files anywhere here to upload. JPG, PNG, WebP, GIF, AVIF, PDF or MP4, up to 25 MB each.</p>
      {errors.length > 0 && (
        <div role="alert" className="mb-4 border border-brand/40 bg-brand/5 px-4 py-3 text-2xs">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <div className={`grid gap-3 ${picker ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"}`}>
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => (picker && onPick ? m.available && onPick(m) : setSelected(m))}
            disabled={picker && !m.available}
            className={`group text-left ${selected?.id === m.id ? "outline-2 outline-offset-2 outline-ink" : ""}`}
            title={m.filename}
          >
            <div className="relative aspect-square overflow-hidden bg-paper-2">
              <Thumb m={m} />
            </div>
            <div className="mt-1 truncate text-2xs text-muted group-hover:text-ink">{m.filename}</div>
          </button>
        ))}
      </div>

      {items.length < total && (
        <div className="mt-6 text-center">
          <button type="button" className={btn.secondary} onClick={() => load(page + 1)} disabled={loading}>
            {loading ? "Loading…" : `Load more (${(total - items.length).toLocaleString("en-IN")} left)`}
          </button>
        </div>
      )}

      {!picker && selected && (
        <Details
          key={selected.id}
          m={selected}
          onClose={() => setSelected(null)}
          onSaved={(m) => setItems((prev) => prev.map((x) => (x.id === m.id ? m : x)))}
          onDeleted={(id) => {
            setItems((prev) => prev.filter((x) => x.id !== id));
            setTotal((t) => t - 1);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function Details({ m, onClose, onSaved, onDeleted }: { m: MediaItem; onClose: () => void; onSaved: (m: MediaItem) => void; onDeleted: (id: string) => void }) {
  const [alt, setAlt] = useState(m.alt);
  const [caption, setCaption] = useState(m.caption);
  const [saving, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside role="dialog" aria-label={m.filename} className="h-full w-full max-w-md overflow-y-auto bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-body break-all">{m.filename}</h2>
          <button onClick={onClose} className={btn.ghost} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="relative mb-4 aspect-[4/3] overflow-hidden bg-paper-2">
          {m.available && m.mime.startsWith("image/") ? <img src={m.url} alt={m.alt} className="absolute inset-0 size-full object-contain" /> : <Thumb m={m} />}
        </div>
        <dl className="mb-5 grid grid-cols-[6rem_1fr] gap-y-1 text-2xs">
          <dt className="text-muted">Type</dt>
          <dd>{m.mime}</dd>
          <dt className="text-muted">Size</dt>
          <dd>{fmtSize(m.size)}</dd>
          {m.width && (
            <>
              <dt className="text-muted">Dimensions</dt>
              <dd>
                {m.width} × {m.height}px
              </dd>
            </>
          )}
          <dt className="text-muted">URL</dt>
          <dd className="break-all">{m.url}</dd>
        </dl>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-2xs font-medium">
            Alt text (describes the image for search engines and screen readers)
            <input value={alt} onChange={(e) => setAlt(e.target.value)} className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-2xs font-medium">
            Caption
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className={`${inputCls} h-20 py-2`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className={btn.primary}
              disabled={saving}
              onClick={() =>
                start(async () => {
                  await updateMedia(m.id, { alt, caption });
                  onSaved({ ...m, alt, caption });
                })
              }
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className={btn.secondary}
              onClick={async () => {
                await navigator.clipboard.writeText(location.origin + m.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy URL"}
            </button>
            {confirmDelete ? (
              <button className={btn.danger} onClick={() => start(async () => (await deleteMedia(m.id), onDeleted(m.id)))}>
                Confirm delete
              </button>
            ) : (
              <button className={btn.ghost} onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            )}
          </div>
          {confirmDelete && <p className="text-2xs text-brand">Deleting removes the file everywhere it’s used. This can’t be undone.</p>}
        </div>
      </aside>
    </div>
  );
}
