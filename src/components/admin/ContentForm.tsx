"use client";

import { useActionState, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import Link from "next/link";
import RichEditor from "./RichEditor";
import MediaLibrary from "./MediaLibrary";
import { btn, Field, inputCls, Notice } from "./ui";
import { saveContent, type SaveState } from "@/app/admin/(panel)/content/actions";

export type ContentFormData = {
  id: string | null;
  type: "post" | "page";
  title: string;
  path: string;
  body: string;
  excerpt: string;
  status: "draft" | "published" | "scheduled" | "archived";
  publishedAt: string | null;
  featured: { id: string; url: string; available?: boolean } | null;
  seoTitle: string;
  seoDescription: string;
  robots: string;
  canonicalUrl: string;
  tags: string[];
  updatedAt: string | null;
};

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

function Counter({ value, ideal }: { value: string; ideal: [number, number] }) {
  const n = value.length;
  const tone = n === 0 ? "text-muted" : n < ideal[0] || n > ideal[1] ? "text-[#a0661f]" : "text-[#2f6339]";
  return (
    <span className={`text-2xs tabular-nums ${tone}`}>
      {n} / {ideal[1]}
    </span>
  );
}

export default function ContentForm({ initial, missingImages = [] }: { initial: ContentFormData; missingImages?: string[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveContent, {});
  const [title, setTitle] = useState(initial.title);
  const [path, setPath] = useState(initial.path);
  const [pathTouched, setPathTouched] = useState(Boolean(initial.id));
  const [status, setStatus] = useState(initial.status);
  const [featured, setFeatured] = useState(initial.featured);
  const [picking, setPicking] = useState(false);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [noindex, setNoindex] = useState(/noindex/.test(initial.robots));

  const shownPath = pathTouched ? path : suggestPath(title, initial.type) || path;
  const label = initial.type === "post" ? "blog post" : "page";

  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <input type="hidden" name="type" value={initial.type} />
      <input type="hidden" name="robots" value={initial.robots} />
      <input type="hidden" name="featuredMediaId" value={featured?.id ?? ""} />

      {/* Main column */}
      <div className="grid min-w-0 content-start gap-5">
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.ok && <Notice tone="success">Saved {state.savedAt ? new Date(state.savedAt).toLocaleTimeString("en-IN", { timeStyle: "short" }) : ""}.</Notice>}

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
            onChange={(e) => {
              setPathTouched(true);
              setPath(e.target.value);
            }}
            className={`${inputCls} h-8 w-auto min-w-0 flex-1 font-mono text-2xs`}
            aria-label="URL path"
          />
        </div>

        <RichEditor name="body" initialHtml={initial.body} missingImages={missingImages} placeholder={`Write the ${label}…`} />
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
                options={[
                  { value: "draft", label: "Draft", hint: "Not visible on the website" },
                  { value: "published", label: "Published", hint: "Live on the website" },
                  { value: "scheduled", label: "Scheduled", hint: "Goes live at the publish date" },
                  { value: "archived", label: "Archived", hint: "Hidden, kept for reference" },
                ]}
              />
            </Field>
            <Field label={status === "scheduled" ? "Publish on" : "Publish date"} htmlFor="publishedAt" hint={status === "scheduled" ? "Goes live automatically at this time (India time)." : undefined}>
              <input id="publishedAt" name="publishedAt" type="datetime-local" defaultValue={toLocalInput(initial.publishedAt)} className={inputCls} />
            </Field>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className={`${btn.primary} flex-1`} disabled={pending}>
                {pending ? "Saving…" : initial.id ? "Save changes" : `Create ${label}`}
              </button>
              {initial.id && status === "published" && (
                <Link href={shownPath} target="_blank" className={btn.secondary}>
                  View ↗
                </Link>
              )}
            </div>
            {initial.updatedAt && <p className="text-2xs text-muted">Last saved {new Date(initial.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>}
          </div>
        </section>

        <section className="min-w-0 border border-line bg-white/40 p-4">
          <h2 className="mb-3 text-2xs font-semibold tracking-[0.06em] uppercase">Featured image</h2>
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
          <Field label="Excerpt" htmlFor="excerpt" hint="Shown on blog listings. Leave empty to use the first lines.">
            <textarea id="excerpt" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className={`${inputCls} h-auto py-2`} />
          </Field>
          {initial.type === "post" && (
            <Field label="Tags" htmlFor="tags" hint="Comma separated, e.g. Guides, Engineered wood">
              <input id="tags" name="tags" defaultValue={initial.tags.join(", ")} className={inputCls} />
            </Field>
          )}
        </section>

        <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border border-line bg-white/40 p-4">
          <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">SEO</h2>
          {/* Google result preview */}
          <div className="min-w-0 border border-line bg-white p-3" aria-label="Search result preview">
            <div className="truncate text-2xs text-[#4d5156]">
              {SITE}
              {shownPath.replace(/\/$/, "").replaceAll("/", " › ")}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[1.05rem] leading-snug text-[#1a0dab]">{seoTitle || `${title || "Untitled"} - Span Floors`}</div>
            <div className="mt-0.5 line-clamp-2 text-2xs leading-snug text-[#4d5156]">{seoDescription || excerpt || "Add a meta description to control this text."}</div>
          </div>
          <Field label="SEO title" htmlFor="seoTitle">
            <input id="seoTitle" name="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={`${title} - Span Floors`} className={inputCls} />
            <Counter value={seoTitle} ideal={[30, 60]} />
          </Field>
          <Field label="Meta description" htmlFor="seoDescription">
            <textarea id="seoDescription" name="seoDescription" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={3} className={`${inputCls} h-auto py-2`} />
            <Counter value={seoDescription} ideal={[70, 160]} />
          </Field>
          <label className="flex items-center gap-2 text-2xs">
            <input type="checkbox" name="noindex" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} />
            Hide from search engines (noindex)
          </label>
          <Field label="Canonical URL (optional)" htmlFor="canonicalUrl">
            <input id="canonicalUrl" name="canonicalUrl" defaultValue={initial.canonicalUrl} placeholder="Leave empty for this page’s own URL" className={inputCls} />
          </Field>
        </section>
      </aside>

      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => setPicking(false)}>
          <div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono text-title">Featured image</h2>
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
    </form>
  );
}
