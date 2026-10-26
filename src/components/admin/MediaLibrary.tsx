"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Dropdown from "@/components/ui/Dropdown";
import {
  bulkDeleteMedia,
  bulkUpdateMedia,
  deleteMedia,
  getUsage,
  listFolders,
  listMedia,
  mediaAvailability,
  replaceMedia,
  updateMedia,
  uploadMedia,
  type MediaFilter,
  type MediaItem,
} from "@/app/admin/(panel)/media/actions";
import type { Usage } from "@/server/media-usage";
import { btn, inputCls } from "./ui";

type Kind = "all" | "image" | "document" | "video";

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b ? `${Math.round(b / 1e3)} KB` : "—");
const thumb = (m: MediaItem) => (/\.(jpe?g|png|webp|avif)$/i.test(m.url) ? `${m.url}?w=320` : m.url);
const ALL = "\u0000all";

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
    return <img src={thumb(m)} alt={m.alt} loading="lazy" className="absolute inset-0 size-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />;
  }
  return <div className="absolute inset-0 grid place-items-center bg-paper-2 text-2xs text-muted uppercase">{m.mime.split("/")[1]?.slice(0, 4)}</div>;
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
  const [folder, setFolder] = useState<string>(ALL);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [folders, setFolders] = useState<{ folder: string; n: number }[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<{ tone: "error" | "info"; text: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [availability, setAvailability] = useState<{ total: number; available: number } | null>(null);
  const [loading, startLoad] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [busy, startBusy] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshFolders = useCallback(() => listFolders().then(setFolders).catch(() => {}), []);
  useEffect(() => {
    mediaAvailability().then(setAvailability).catch(() => {});
    refreshFolders();
  }, [refreshFolders]);

  const load = useCallback(
    (p = 1) =>
      startLoad(async () => {
        const res = await listMedia({ q: q.trim() || undefined, kind, page: p, perPage: picker ? 36 : 48, folder: folder === ALL ? null : folder, filter });
        setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(p);
      }),
    [q, kind, picker, folder, filter],
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), 250);
    return () => clearTimeout(t);
  }, [load]);

  const upload = (files: FileList | File[]) => {
    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    if (folder !== ALL) form.append("folder", folder);
    startUpload(async () => {
      const res = await uploadMedia(form);
      setMessages([...res.errors.map((text) => ({ tone: "error" as const, text })), ...res.reused.map((text) => ({ tone: "info" as const, text }))]);
      setItems((prev) => [...res.items.filter((i) => !prev.some((p) => p.id === i.id)), ...prev]);
      setTotal((t) => t + res.items.length - res.reused.length);
      refreshFolders();
      if (picker && res.items[0] && onPick) onPick(res.items[0]);
    });
  };

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const folderOptions = [
    { value: ALL, label: "All folders" },
    { value: "", label: "No folder", hint: String(folders.find((f) => f.folder === "")?.n ?? 0) },
    ...folders.filter((f) => f.folder).map((f) => ({ value: f.folder, label: f.folder, hint: String(f.n) })),
  ];

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
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file name or alt text…" className={`${inputCls} h-9 w-full sm:w-64`} aria-label="Search media" />
        <Dropdown
          size="sm"
          className="w-40"
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
        <Dropdown size="sm" className="w-52" aria-label="Folder" value={folder} onChange={setFolder} options={folderOptions} />
        {!picker && (
          <Dropdown
            size="sm"
            className="w-56"
            aria-label="Show"
            value={filter}
            onChange={(v) => setFilter(v as MediaFilter)}
            options={[
              { value: "all", label: "Everything" },
              { value: "unused", label: "Not used anywhere", hint: "Safe to delete" },
              { value: "missing", label: "Not imported yet", hint: "File not on this server" },
              { value: "noalt", label: "Photos without description" },
              { value: "placeholder", label: "Placeholder photos" },
            ]}
          />
        )}
        <span className="text-2xs text-muted tabular-nums">{total.toLocaleString("en-IN")} files</span>
        {availability && availability.available < availability.total && (
          <span className="text-2xs text-[#a0661f] tabular-nums" title="Records imported from the old website whose files still need copying.">
            · {availability.available.toLocaleString("en-IN")} of {availability.total.toLocaleString("en-IN")} on this server
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {!picker && (
            <button
              type="button"
              className={btn.ghost}
              aria-pressed={selecting}
              onClick={() => {
                setSelecting((s) => !s);
                setChecked(new Set());
              }}
            >
              {selecting ? "Done selecting" : "Select"}
            </button>
          )}
          <input ref={fileInput} type="file" multiple hidden accept="image/*,application/pdf,video/mp4" onChange={(e) => e.target.files && upload(e.target.files)} />
          <button type="button" className={btn.primary} onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : folder !== ALL && folder ? `Upload to “${folder}”` : "Upload files"}
          </button>
        </div>
      </div>

      <p className="mb-4 text-2xs text-muted">Drag files anywhere here to upload. JPG, PNG, WebP, GIF, AVIF, PDF or MP4, up to 25 MB each. Location data is removed from photos, and the same file uploaded twice is reused.</p>
      {messages.length > 0 && (
        <div role="status" className="mb-4 grid gap-1 border border-line bg-paper-2/60 px-4 py-3 text-2xs">
          {messages.map((m) => (
            <div key={m.text} className={m.tone === "error" ? "text-brand" : ""}>
              {m.text}
            </div>
          ))}
        </div>
      )}

      {selecting && (
        <BulkBar
          count={checked.size}
          busy={busy}
          onAll={() => setChecked(new Set(items.map((i) => i.id)))}
          onNone={() => setChecked(new Set())}
          onFolder={(f) =>
            startBusy(async () => {
              const r = await bulkUpdateMedia([...checked], { folder: f });
              setMessages([{ tone: "info", text: `Moved ${r.updated} file${r.updated === 1 ? "" : "s"} to ${f ? `“${f}”` : "no folder"}.` }]);
              refreshFolders();
              load(1);
            })
          }
          onAlt={(alt) =>
            startBusy(async () => {
              const r = await bulkUpdateMedia([...checked], { alt, onlyEmptyAlt: true });
              setMessages([{ tone: "info", text: `Added the description to ${r.updated} photo${r.updated === 1 ? "" : "s"} that had none.` }]);
              load(1);
            })
          }
          onDelete={() =>
            startBusy(async () => {
              const r = await bulkDeleteMedia([...checked]);
              setMessages([{ tone: "info", text: `Deleted ${r.deleted} file${r.deleted === 1 ? "" : "s"}.${r.skipped ? ` ${r.skipped} were kept because pages use them.` : ""}` }]);
              setChecked(new Set());
              refreshFolders();
              load(1);
            })
          }
          folders={folders.map((f) => f.folder).filter(Boolean)}
        />
      )}

      <div className={`grid gap-3 ${picker ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"}`}>
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => (selecting ? toggle(m.id) : picker && onPick ? m.available && onPick(m) : setSelected(m))}
            disabled={picker && !m.available}
            aria-pressed={selecting ? checked.has(m.id) : undefined}
            className={`group relative text-left ${selected?.id === m.id || checked.has(m.id) ? "outline-2 outline-offset-2 outline-ink" : ""}`}
            title={m.filename}
          >
            <div className="relative aspect-square overflow-hidden bg-paper-2">
              <Thumb m={m} />
              {selecting && <span className={`absolute top-1.5 left-1.5 grid size-5 place-items-center border text-2xs ${checked.has(m.id) ? "border-ink bg-ink text-paper" : "border-ink/40 bg-white/80"}`}>{checked.has(m.id) ? "✓" : ""}</span>}
              {m.placeholder && <span className="absolute right-1.5 bottom-1.5 bg-sand px-1 text-[0.65rem]">Placeholder</span>}
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
          folders={folders.map((f) => f.folder).filter(Boolean)}
          onClose={() => setSelected(null)}
          onSaved={(m) => {
            setItems((prev) => prev.map((x) => (x.id === m.id ? m : x)));
            setSelected(m);
            refreshFolders();
          }}
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

function BulkBar({ count, busy, onAll, onNone, onFolder, onAlt, onDelete, folders }: { count: number; busy: boolean; onAll: () => void; onNone: () => void; onFolder: (f: string) => void; onAlt: (alt: string) => void; onDelete: () => void; folders: string[] }) {
  const [folder, setFolder] = useState("");
  const [alt, setAlt] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="sticky top-[4.6rem] z-10 mb-4 grid gap-3 border border-ink bg-paper p-3 text-2xs shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <b className="tabular-nums">{count} selected</b>
        <button type="button" className="underline" onClick={onAll}>
          Select all shown
        </button>
        <button type="button" className="underline" onClick={onNone}>
          Clear
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder name (empty = none)" className={`${inputCls} h-8 w-56`} aria-label="Folder for the selected files" />
        <button type="button" className={`${btn.secondary} h-8`} disabled={!count || busy} onClick={() => onFolder(folder)}>
          Move to folder
        </button>
        <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Description for photos without one" className={`${inputCls} h-8 min-w-0 flex-1`} aria-label="Description" />
        <button type="button" className={`${btn.secondary} h-8`} disabled={!count || !alt.trim() || busy} onClick={() => onAlt(alt)}>
          Add description
        </button>
        {confirm ? (
          <button type="button" className={`${btn.danger} h-8`} disabled={busy} onClick={() => (onDelete(), setConfirm(false))}>
            Yes, delete the unused ones
          </button>
        ) : (
          <button type="button" className={`${btn.ghost} h-8`} disabled={!count || busy} onClick={() => setConfirm(true)}>
            Delete…
          </button>
        )}
      </div>
      {folders.length > 0 && <FolderChips folders={folders} onPick={setFolder} />}
      {confirm && <p className="text-brand">Only files no page uses are deleted; used ones are kept. This can’t be undone.</p>}
    </div>
  );
}

/** Existing folders as one-click choices (instead of the browser's own suggestion list). */
function FolderChips({ folders, onPick }: { folders: string[]; onPick: (f: string) => void }) {
  return (
    <span className="flex flex-wrap gap-1 font-normal">
      {folders.slice(0, 12).map((f) => (
        <button key={f} type="button" onClick={() => onPick(f)} className="border border-line px-1.5 py-0.5 text-[0.7rem] text-muted hover:border-ink hover:text-ink">
          {f}
        </button>
      ))}
    </span>
  );
}

/** Frames photos appear in on the site, for the preview under a photo's settings. */
const FRAMES = [
  { label: "Wide hero (desktop)", ratio: "1440 / 620" },
  { label: "Hero on a phone", ratio: "390 / 640" },
  { label: "Image and text, gallery", ratio: "4 / 3" },
  { label: "Collection card", ratio: "16 / 10" },
  { label: "Product card", ratio: "5 / 6" },
  { label: "Square", ratio: "1 / 1" },
];

function Details({ m, folders, onClose, onSaved, onDeleted }: { m: MediaItem; folders: string[]; onClose: () => void; onSaved: (m: MediaItem) => void; onDeleted: (id: string) => void }) {
  const [alt, setAlt] = useState(m.alt);
  const [caption, setCaption] = useState(m.caption);
  const [credit, setCredit] = useState(m.credit);
  const [folder, setFolder] = useState(m.folder);
  const [focal, setFocal] = useState({ x: m.focalX, y: m.focalY });
  const [fit, setFit] = useState(m.fit);
  const [placeholder, setPlaceholder] = useState(m.placeholder);
  const [usage, setUsage] = useState<Usage[] | null>(null);
  const [saving, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [version, setVersion] = useState(0);
  const replaceInput = useRef<HTMLInputElement>(null);
  const isImage = m.mime.startsWith("image/") && m.available;
  const src = `${m.url}${version ? `?r=${version}` : ""}`;

  useEffect(() => {
    getUsage(m.id).then(setUsage).catch(() => setUsage([]));
  }, [m.id]);

  const save = () =>
    start(async () => {
      await updateMedia(m.id, { alt, caption, credit, focalX: focal.x, focalY: focal.y, fit, placeholder, folder });
      onSaved({ ...m, alt, caption, credit, focalX: focal.x, focalY: focal.y, fit, placeholder, folder });
      setMsg({ tone: "ok", text: "Saved." });
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside role="dialog" aria-label={m.filename} className="h-full w-full max-w-xl overflow-y-auto bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-body break-all">{m.filename}</h2>
          <button onClick={onClose} className={btn.ghost} aria-label="Close">
            ✕
          </button>
        </div>

        {isImage ? (
          <div className="mb-2">
            <div
              className="relative cursor-crosshair overflow-hidden bg-paper-2"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setFocal({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
              }}
              title="Click the most important part of the photo"
            >
              <img src={src} alt={m.alt} className="block h-auto w-full" />
              <span aria-hidden="true" className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" style={{ left: `${focal.x}%`, top: `${focal.y}%` }} />
            </div>
            <p className="mt-1.5 text-2xs text-muted">Click the most important part of the photo. When a frame crops it, that point stays in view.</p>
          </div>
        ) : (
          <div className="relative mb-4 aspect-[4/3] overflow-hidden bg-paper-2">
            <Thumb m={m} />
          </div>
        )}

        {isImage && (
          <div className="mb-5 grid gap-3">
            <div className="flex flex-wrap gap-4 text-2xs" role="radiogroup" aria-label="How the photo fills its frame">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={fit === "cover"} onChange={() => setFit("cover")} /> Fill the frame (crop around the point)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={fit === "contain"} onChange={() => setFit("contain")} /> Show the whole photo
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FRAMES.map((f) => (
                <figure key={f.label} className="min-w-0">
                  <div className="relative overflow-hidden bg-paper-2" style={{ aspectRatio: f.ratio }}>
                    <img src={`${m.url}?w=640`} alt="" className="absolute inset-0 size-full" style={{ objectFit: fit, objectPosition: `${focal.x}% ${focal.y}%` }} />
                  </div>
                  <figcaption className="mt-1 truncate text-[0.65rem] text-muted">{f.label}</figcaption>
                </figure>
              ))}
            </div>
            {m.width != null && m.width < 1200 && <p className="text-2xs text-[#a0661f]">This photo is {m.width} pixels wide; it may look soft in wide frames. 1600+ is best for heroes.</p>}
          </div>
        )}

        <dl className="mb-5 grid grid-cols-[6rem_minmax(0,1fr)] gap-y-1 text-2xs">
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
            Description (alt text, for Google and screen readers)
            <input value={alt} onChange={(e) => setAlt(e.target.value)} className={inputCls} />
          </label>
          <label className="grid gap-1.5 text-2xs font-medium">
            Caption
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className={`${inputCls} h-20 py-2`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-2xs font-medium">
              Credit (photographer or source)
              <input value={credit} onChange={(e) => setCredit(e.target.value)} className={inputCls} />
            </label>
            <label className="grid gap-1.5 text-2xs font-medium">
              Folder
              <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="No folder" className={inputCls} />
              {folders.length > 0 && <FolderChips folders={folders} onPick={setFolder} />}
            </label>
          </div>
          {isImage && (
            <label className="flex items-center gap-2 text-2xs">
              <input type="checkbox" checked={placeholder} onChange={(e) => setPlaceholder(e.target.checked)} /> Placeholder photo (to be replaced; never used as a share image)
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button className={btn.primary} disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className={btn.secondary}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.origin + m.url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
            >
              {copied ? "Copied" : "Copy URL"}
            </button>
            <input
              ref={replaceInput}
              type="file"
              hidden
              accept={m.mime.startsWith("image/") ? "image/*" : m.mime}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const form = new FormData();
                form.append("id", m.id);
                form.append("file", f);
                start(async () => {
                  const r = await replaceMedia(form);
                  if (r.item) {
                    setVersion(Date.now());
                    onSaved({ ...r.item, alt, caption, credit, folder, focalX: focal.x, focalY: focal.y, fit, placeholder });
                    setMsg({ tone: "ok", text: "File replaced. Every page that uses it now shows the new file." });
                  } else setMsg({ tone: "error", text: r.error ?? "Couldn't replace the file." });
                });
              }}
            />
            <button className={btn.secondary} disabled={saving} onClick={() => replaceInput.current?.click()} title="Upload a new version; the address stays the same">
              Replace file…
            </button>
            {confirmDelete ? (
              <button
                className={btn.danger}
                onClick={() =>
                  start(async () => {
                    const r = await deleteMedia(m.id);
                    if (r.error) setMsg({ tone: "error", text: r.error });
                    else onDeleted(m.id);
                  })
                }
              >
                Confirm delete
              </button>
            ) : (
              <button className={btn.ghost} disabled={Boolean(usage?.length)} title={usage?.length ? "Used on pages; remove it there first" : undefined} onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            )}
          </div>
          {msg && <p className={`text-2xs ${msg.tone === "error" ? "text-brand" : "text-[#2f6339]"}`}>{msg.text}</p>}
          {confirmDelete && <p className="text-2xs text-brand">The file is not used anywhere. Deleting can’t be undone.</p>}

          <section className="border-t border-line pt-4">
            <h3 className="mb-2 text-2xs font-semibold tracking-[0.06em] uppercase">Where it’s used</h3>
            {usage === null ? (
              <p className="text-2xs text-muted">Checking…</p>
            ) : usage.length === 0 ? (
              <p className="text-2xs text-muted">Not used anywhere.</p>
            ) : (
              <ul className="grid gap-1 text-2xs">
                {usage.map((u) => (
                  <li key={u.kind + u.id} className="flex min-w-0 gap-2">
                    <span className="shrink-0 text-muted capitalize">{u.kind}</span>
                    <Link href={u.href} className="min-w-0 truncate underline">
                      {u.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
