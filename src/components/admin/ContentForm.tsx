"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import Link from "next/link";
import RichEditor from "./RichEditor";
import MediaLibrary from "./MediaLibrary";
import { btn, Field, inputCls, Notice } from "./ui";
import { saveContent, type SaveState } from "@/app/admin/(panel)/content/actions";
import type { ReusableItem } from "@/app/admin/(panel)/content/builder-actions";
import SectionsEditor from "./builder/SectionsEditor";
import SeoPanel from "./SeoPanel";
import AeoPanel from "./AeoPanel";
import RelatedPostsPicker from "./RelatedPostsPicker";
import { cleanAeo, type Aeo } from "@/server/aeo";
import PreviewModal from "./PreviewModal";
import VersionHistory from "./VersionHistory";
import { editingHeartbeat, editingLeft, previewFromForm } from "@/app/admin/(panel)/content/preview-actions";
import type { Section } from "@/sections/types";

export type ContentFormData = {
  id: string | null;
  type: "post" | "page";
  title: string;
  path: string;
  body: string;
  excerpt: string;
  status: "draft" | "review" | "published" | "scheduled" | "archived";
  publishedAt: string | null;
  /** Optional end date: the item stops being live after this. */
  unpublishAt?: string | null;
  featured: { id: string; url: string; available?: boolean } | null;
  seoTitle: string;
  seoDescription: string;
  robots: string;
  canonicalUrl: string;
  tags: string[];
  updatedAt: string | null;
  layout: Section[];
  focusKeyword?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: { id: string; url: string } | null;
  schemaType?: string;
  aeo?: Aeo;
  /** Set for fixed site pages (home, blog, collections): the URL can't change. */
  systemKey?: string | null;
  /** Posts only: byline, the author profiles to choose from, and hand-picked related posts. */
  authorName?: string | null;
  authorChoices?: string[];
  related?: { id: string; title: string }[];
};

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s${Date.now().toString(36)}`);

/** Warns before leaving the page while there are unsaved changes (browser close/reload and admin links). */
function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || a.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}

const SITE = "www.spanfloors.com";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function suggestPath(title: string, type: "post" | "page") {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug ? (type === "post" ? `/blog/${slug}/` : `/${slug}/`) : "";
}


type EditorProps = {
  initial: ContentFormData;
  missingImages?: string[];
  canPublish?: boolean;
  reusable?: ReusableItem[];
  canReuse?: boolean;
};

/* ---------- Safety copy in this browser (so a closed tab or a crash never loses work) ---------- */

type Backup = { savedAt: number; fields: Record<string, string> };
const BACKUP_FIELDS = ["title", "path", "body", "layout", "excerpt", "seoTitle", "seoDescription", "focusKeyword", "ogTitle", "ogDescription", "tags", "aeo", "authorName"];
const backupKey = (initial: ContentFormData) => `sf-draft:${initial.id ?? `new-${initial.type}`}`;

function readBackup(key: string): Backup | null {
  try {
    const raw = localStorage.getItem(key);
    const b = raw ? (JSON.parse(raw) as Backup) : null;
    return b && typeof b.savedAt === "number" && b.fields ? b : null;
  } catch {
    return null;
  }
}

function writeBackup(key: string, form: HTMLFormElement) {
  try {
    const fd = new FormData(form);
    const fields = Object.fromEntries(BACKUP_FIELDS.filter((k) => fd.has(k)).map((k) => [k, String(fd.get(k) ?? "")]));
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), fields } satisfies Backup));
  } catch {}
}

function clearBackup(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/** The saved copy laid over what the server sent. */
function applyBackup(initial: ContentFormData, f: Record<string, string>): ContentFormData {
  const json = <T,>(v: string | undefined, fallback: T): T => {
    try {
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    ...initial,
    title: f.title ?? initial.title,
    path: f.path || initial.path,
    body: f.body ?? initial.body,
    layout: json<Section[]>(f.layout, initial.layout),
    excerpt: f.excerpt ?? initial.excerpt,
    seoTitle: f.seoTitle ?? initial.seoTitle,
    seoDescription: f.seoDescription ?? initial.seoDescription,
    focusKeyword: f.focusKeyword ?? initial.focusKeyword,
    ogTitle: f.ogTitle ?? initial.ogTitle,
    ogDescription: f.ogDescription ?? initial.ogDescription,
    tags: f.tags != null ? f.tags.split(",").map((t) => t.trim()).filter(Boolean) : initial.tags,
    aeo: f.aeo ? cleanAeo(json(f.aeo, {})) : initial.aeo,
    authorName: f.authorName != null ? f.authorName || null : initial.authorName,
  };
}

/**
 * The page and post editor. Wraps the form with a safety copy: while you edit, a copy is kept in this
 * browser; if the tab closed before saving, reopening the page offers to bring the changes back.
 */
export default function ContentForm(props: EditorProps) {
  const key = backupKey(props.initial);
  const [found, setFound] = useState<Backup | null>(null);
  const [initial, setInitial] = useState(props.initial);
  const [round, setRound] = useState(0);
  useEffect(() => {
    // A new page or post that was just created: its "new" copy is now saved for real.
    if (props.initial.id && new URLSearchParams(window.location.search).has("created")) clearBackup(`sf-draft:new-${props.initial.type}`);
    const b = readBackup(key);
    const serverTime = props.initial.updatedAt ? new Date(props.initial.updatedAt).getTime() : 0;
    // Only offer a copy made after the last save, and only if it differs from what is saved.
    if (b && b.savedAt > serverTime && BACKUP_FIELDS.some((k) => k in b.fields && b.fields[k] !== fieldOf(props.initial, k))) setFound(b);
    else if (b) clearBackup(key);
  }, [key, props.initial]);

  return (
    <>
      {found && (
        <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#a0661f]/50 bg-[#a0661f]/10 px-4 py-3 text-2xs">
          <span>
            <strong className="font-medium">Unsaved changes found</strong> from {new Date(found.savedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} on this computer. Bring them back?
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                setInitial(applyBackup(props.initial, found.fields));
                setRound((r) => r + 1);
                setFound(null);
              }}
            >
              Restore my changes
            </button>
            <button
              type="button"
              className={btn.ghost}
              onClick={() => {
                clearBackup(key);
                setFound(null);
              }}
            >
              Discard
            </button>
          </span>
        </div>
      )}
      <Editor key={round} {...props} initial={initial} backup={key} restored={round > 0} />
    </>
  );
}

/** A field's value as the form would send it, to tell whether a safety copy differs. */
function fieldOf(c: ContentFormData, k: string): string {
  switch (k) {
    case "layout":
      return JSON.stringify(c.layout);
    case "tags":
      return c.tags.join(", ");
    case "aeo":
      return JSON.stringify(c.aeo ?? {});
    default:
      return String((c as Record<string, unknown>)[k] ?? "");
  }
}

function Editor({
  initial,
  missingImages = [],
  canPublish = true,
  reusable = [],
  canReuse = false,
  backup,
  restored = false,
}: EditorProps & { backup: string; restored?: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveContent, {});
  const isPage = initial.type === "page";
  // Imported pages keep their old body until it is turned into sections.
  const [legacyBody, setLegacyBody] = useState(isPage ? initial.body : "");
  const [layout, setLayout] = useState<Section[]>(initial.layout);
  const [layoutKey, setLayoutKey] = useState(0);
  const [showExtra, setShowExtra] = useState(!isPage && initial.layout.length > 0);
  const [dirty, setDirty] = useState(restored);
  // Bumped on every change so the SEO checklist re-runs.
  const [changeTick, setChangeTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedWarning(dirty);
  useEffect(() => {
    if (state.ok) {
      setDirty(false);
      clearBackup(backup);
    }
  }, [state, backup]);
  // Keep a safety copy in this browser every few seconds while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const t = setInterval(() => formRef.current && writeBackup(backup, formRef.current), 4000);
    const now = () => formRef.current && writeBackup(backup, formRef.current);
    window.addEventListener("pagehide", now);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", now);
    };
  }, [dirty, backup]);

  // Preview of the current (unsaved) state.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const openPreview = async () => {
    if (!formRef.current) return;
    setPreviewing(true);
    setPreviewError("");
    const r = await previewFromForm(new FormData(formRef.current)).catch(() => ({ id: undefined, error: "Couldn't make the preview. Try again." }));
    setPreviewing(false);
    if (r.id) setPreviewId(r.id);
    else setPreviewError(r.error ?? "Couldn't make the preview.");
  };

  // Who else has this page open, and whether someone saved it after this editor was loaded.
  const [loadedAt, setLoadedAt] = useState(initial.updatedAt ?? "");
  const [others, setOthers] = useState<{ name: string; secondsAgo: number }[]>([]);
  const [savedElsewhere, setSavedElsewhere] = useState(false);
  const [force, setForce] = useState(false);
  useEffect(() => {
    if (state.ok && state.updatedAt) {
      setLoadedAt(state.updatedAt);
      setSavedElsewhere(false);
      setForce(false);
    }
  }, [state]);
  useEffect(() => {
    const id = initial.id;
    if (!id) return;
    let alive = true;
    const beat = () =>
      editingHeartbeat(id)
        .then((r) => {
          if (!alive) return;
          setOthers(r.others);
          if (r.updatedAt && loadedAt && new Date(r.updatedAt).getTime() > new Date(loadedAt).getTime() + 1000) setSavedElsewhere(true);
        })
        .catch(() => undefined);
    beat();
    const t = setInterval(beat, 30_000);
    const leave = () => editingLeft(id).catch(() => undefined);
    window.addEventListener("pagehide", leave);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [initial.id, loadedAt]);

  const convertBody = () => {
    const text: Section = { id: newId(), type: "text", data: { kicker: "", heading: "", body: legacyBody, width: "narrow" } };
    setLayout((l) => [text, ...l]);
    setLegacyBody("");
    setLayoutKey((k) => k + 1);
    setDirty(true);
  };
  const [title, setTitle] = useState(initial.title);
  const [path, setPath] = useState(initial.path);
  const [pathTouched, setPathTouched] = useState(Boolean(initial.id));
  const [status, setStatus] = useState(initial.status);
  const [featured, setFeatured] = useState(initial.featured);
  const [picking, setPicking] = useState(false);
  const [excerpt, setExcerpt] = useState(initial.excerpt);

  const shownPath = pathTouched ? path : suggestPath(title, initial.type) || path;
  const label = initial.type === "post" ? "blog post" : "page";

  return (
    <form
      ref={formRef}
      action={action}
      onInput={() => {
        setDirty(true);
        setChangeTick((t) => t + 1);
      }}
      className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <input type="hidden" name="type" value={initial.type} />
      <input type="hidden" name="robots" value={initial.robots} />
      <input type="hidden" name="featuredMediaId" value={featured?.id ?? ""} />
      <input type="hidden" name="loadedAt" value={loadedAt} />
      <input type="hidden" name="force" value={force ? "1" : ""} />

      {/* Main column */}
      <div className="grid min-w-0 content-start gap-5">
        {others.length > 0 && (
          <Notice>
            <b>{others.map((o) => o.name).join(" and ")}</b> {others.length === 1 ? "is" : "are"} also editing this {initial.type === "post" ? "post" : "page"} right now. Agree who saves first, or changes may be overwritten.
          </Notice>
        )}
        {savedElsewhere && !state.conflict && (
          <Notice tone="error">Someone else saved this {initial.type === "post" ? "post" : "page"} after you opened it. Reload to see their changes before you save.</Notice>
        )}
        {state.conflict && (
          <Notice tone="error">
            <p>{state.error}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={btn.secondary} onClick={() => window.location.reload()}>
                Reload their version
              </button>
              <button
                type="button"
                className={btn.danger}
                onClick={() => {
                  setForce(true);
                  requestAnimationFrame(() => formRef.current?.requestSubmit());
                }}
              >
                Save mine anyway
              </button>
            </div>
          </Notice>
        )}
        {state.error && !state.conflict && <Notice tone="error">{state.error}</Notice>}
        {state.ok && <Notice tone="success">Saved {state.savedAt ? new Date(state.savedAt).toLocaleTimeString("en-IN", { timeStyle: "short" }) : ""}.</Notice>}
        {state.warnings && state.warnings.length > 0 && (
          <Notice>
            <p className="mb-1 font-medium">Saved, but some sections are missing content. Fill these in before publishing:</p>
            <ul className="list-disc pl-5">
              {state.warnings.slice(0, 8).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Notice>
        )}

        <textarea
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={`${initial.type === "post" ? "Post" : "Page"} title`}
          aria-label="Title"
          required
          rows={1}
          className="field-sizing-content w-full resize-none border-0 border-b border-line bg-transparent pb-3 text-display leading-tight outline-none placeholder:text-muted/60 focus:border-ink"
        />

        <div className="flex flex-wrap items-center gap-2 text-2xs">
          <span className="text-muted">URL:</span>
          <span className="text-muted">{SITE}</span>
          <input
            name="path"
            value={shownPath}
            readOnly={Boolean(initial.systemKey)}
            title={initial.systemKey ? "This site page's address can't be changed." : undefined}
            onChange={(e) => {
              setPathTouched(true);
              setPath(e.target.value);
            }}
            className={`${inputCls} h-8 w-auto min-w-0 flex-1 font-mono text-2xs ${initial.systemKey ? "bg-paper-2 text-muted" : ""}`}
            aria-label="Web address"
          />
        </div>

        {isPage ? (
          <>
            {initial.systemKey && (
              <Notice>
                This is a fixed site page. Its product list or blog list is built automatically. Sections you add show below it; add a “Product list” section to choose where the products sit, so sections above it show above the products. On collection pages the Excerpt is the intro under the heading.
              </Notice>
            )}
            {legacyBody ? (
              <section className="grid gap-3 border border-line bg-white/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Imported content</h2>
                    <p className="mt-1 text-2xs text-muted">This page came from the old website as one block of text. Turn it into a Text section to edit it with the page builder.</p>
                  </div>
                  <button type="button" className={btn.secondary} onClick={convertBody}>
                    Turn into sections
                  </button>
                </div>
                <RichEditor name="body" initialHtml={legacyBody} missingImages={missingImages} onChange={setLegacyBody} placeholder={`Write the ${label}…`} />
              </section>
            ) : (
              <input type="hidden" name="body" value="" />
            )}
            <div className="grid gap-2">
              <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Page sections</h2>
              <SectionsEditor key={layoutKey} initial={layout} kind={initial.systemKey ? "system" : "page"} reusable={reusable} canReuse={canReuse} onChange={(l) => (setLayout(l), setDirty(true), setChangeTick((t) => t + 1))} />
            </div>
          </>
        ) : (
          <>
            <RichEditor name="body" initialHtml={initial.body} missingImages={missingImages} placeholder={`Write the ${label}…`} onChange={() => (setDirty(true), setChangeTick((t) => t + 1))} />
            {showExtra ? (
              <div className="grid gap-2">
                <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Extra sections after the article</h2>
                <SectionsEditor initial={layout} kind="post" reusable={reusable} canReuse={canReuse} onChange={(l) => (setLayout(l), setDirty(true))} />
              </div>
            ) : (
              <>
                <input type="hidden" name="layout" value="[]" />
                <button type="button" className={`${btn.ghost} w-fit`} onClick={() => setShowExtra(true)}>
                  + Add extra sections after the article (call to action, products, questions…)
                </button>
              </>
            )}
          </>
        )}
        <AeoPanel initial={initial.aeo ?? cleanAeo({})} type={initial.type} />
      </div>

      {/* Sidebar */}
      <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
        <section className="min-w-0 border border-line bg-white/40 p-4">
          <h2 className="mb-3 text-2xs font-semibold tracking-[0.06em] uppercase">Publish</h2>
          <div className="grid gap-3">
            <Field label="Status" htmlFor="status">
              <Dropdown
                id="status"
                name="status"
                value={status}
                onChange={(v) => setStatus(v as typeof status)}
                options={
                  canPublish
                    ? [
                        { value: "draft", label: "Draft", hint: "Not visible on the website" },
                        { value: "review", label: "Waiting for review", hint: "Written, not yet approved" },
                        { value: "published", label: "Published", hint: "Live on the website" },
                        { value: "scheduled", label: "Scheduled", hint: "Goes live at the publish date" },
                        { value: "archived", label: "Archived", hint: "Hidden, kept for reference" },
                      ]
                    : [
                        { value: "draft", label: "Draft", hint: "Only you and editors see it" },
                        { value: "review", label: "Send for review", hint: "An editor checks and publishes it" },
                      ]
                }
              />
            </Field>
            <Field label={status === "scheduled" ? "Publish on" : "Publish date"} htmlFor="publishedAt" hint={status === "scheduled" ? "Goes live automatically at this time (India time)." : undefined}>
              <input id="publishedAt" name="publishedAt" type="datetime-local" defaultValue={toLocalInput(initial.publishedAt)} className={inputCls} />
            </Field>
            {canPublish && (
              <Field label="Take offline on (optional)" htmlFor="unpublishAt" hint="For offers and campaigns: the page stops showing after this time.">
                <input id="unpublishAt" name="unpublishAt" type="datetime-local" defaultValue={toLocalInput(initial.unpublishAt ?? null)} className={inputCls} />
              </Field>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className={`${btn.primary} flex-1`} disabled={pending}>
                {pending ? "Saving…" : !canPublish && status === "review" ? "Send for review" : initial.id ? "Save changes" : `Create ${label}`}
              </button>
              <button type="button" className={btn.secondary} onClick={openPreview} disabled={previewing}>
                {previewing ? "Opening…" : "Preview"}
              </button>
              {initial.id && status === "published" && (
                <Link href={shownPath} target="_blank" className={btn.ghost}>
                  View live ↗
                </Link>
              )}
            </div>
            {previewError && <p className="text-2xs text-brand">{previewError}</p>}
            {initial.updatedAt && <p className="text-2xs text-muted">Last saved {new Date(initial.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>}
          </div>
        </section>

        {initial.id && <VersionHistory contentId={initial.id} type={initial.type} />}

        <section className="min-w-0 border border-line bg-white/40 p-4">
          <h2 className="mb-3 text-2xs font-semibold tracking-[0.06em] uppercase">Main photo</h2>
          {featured ? (
            <div className="grid gap-2">
              <div className="relative aspect-[16/10] overflow-hidden bg-paper-2">
                {featured.available === false ? (
                  <div className="absolute inset-0 grid place-items-center p-3 text-center text-2xs text-muted">
                    Featured image not imported yet. It will appear once the old website files are imported.
                  </div>
                ) : (
                  <img src={featured.url} alt="" className="absolute inset-0 size-full object-cover" />
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className={btn.secondary} onClick={() => setPicking(true)}>
                  Change
                </button>
                <button type="button" className={btn.ghost} onClick={() => setFeatured(null)}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="grid aspect-[16/10] w-full place-items-center border border-dashed border-line text-2xs text-muted hover:border-ink hover:text-ink">
              Choose image
            </button>
          )}
        </section>

        <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border border-line bg-white/40 p-4">
          <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Summary</h2>
          <Field label="Short summary" htmlFor="excerpt" hint="Shown on blog listings. Leave empty to use the first lines.">
            <textarea id="excerpt" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className={`${inputCls} h-auto py-2`} />
          </Field>
          {initial.type === "post" && (
            <Field label="Topics (tags)" htmlFor="tags" hint="Comma separated, e.g. Guides, Engineered wood">
              <input id="tags" name="tags" defaultValue={initial.tags.join(", ")} className={inputCls} />
            </Field>
          )}
          {initial.type === "post" && (
            <Field label="Author" htmlFor="authorName" hint="Profiles are set up under Blog authors.">
              <Dropdown
                id="authorName"
                name="authorName"
                defaultValue={initial.authorName ?? ""}
                options={[
                  { value: "", label: "Span Floors (no named author)" },
                  ...[...new Set([...(initial.authorChoices ?? []), ...(initial.authorName ? [initial.authorName] : [])])].map((a) => ({ value: a, label: a })),
                ]}
              />
            </Field>
          )}
          {initial.type === "post" && (
            <div className="grid gap-1.5">
              <span className="text-2xs font-medium">Related posts</span>
              <span className="text-2xs text-muted">Shown first under the article. Without picks, posts sharing a tag are shown.</span>
              <RelatedPostsPicker initial={initial.related ?? []} selfId={initial.id} />
            </div>
          )}
        </section>

        <SeoPanel
          initial={{
            seoTitle: initial.seoTitle,
            seoDescription: initial.seoDescription,
            focusKeyword: initial.focusKeyword ?? "",
            robots: initial.robots,
            canonicalUrl: initial.canonicalUrl,
            ogTitle: initial.ogTitle ?? "",
            ogDescription: initial.ogDescription ?? "",
            ogImage: initial.ogImage ?? null,
            schemaType: initial.schemaType ?? "",
          }}
          title={title}
          excerpt={excerpt}
          path={shownPath}
          type={initial.type}
          photo={featured && featured.available !== false ? featured.url : null}
          formRef={formRef}
          changeTick={changeTick}
          contentId={initial.id}
          isLive={initial.status === "published"}
        />
      </aside>

      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => setPicking(false)}>
          <div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono text-title">Main photo</h2>
              <button type="button" className={btn.ghost} onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            <MediaLibrary
              picker
              initialKind="image"
              onPick={(m) => {
                setFeatured({ id: m.id, url: m.url });
                setPicking(false);
              }}
            />
          </div>
        </div>
      )}
      {previewId && <PreviewModal previewId={previewId} title="Preview (unsaved changes included)" onClose={() => setPreviewId(null)} />}
    </form>
  );
}
