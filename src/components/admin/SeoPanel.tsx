"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Dropdown from "@/components/ui/Dropdown";
import { checkSeoForm } from "@/app/admin/(panel)/content/seo-actions";
import { pagespeedCheck, writeSeoWithAi, type PagespeedResult } from "@/app/admin/(panel)/content/seo-tools";
import type { SeoReport } from "@/server/seo-check";
import { SCHEMA_TYPES } from "@/server/aeo";
import MediaLibrary from "./MediaLibrary";
import { btn, Field, inputCls } from "./ui";

const HOST = "www.spanfloors.com";

function Counter({ value, ideal }: { value: string; ideal: [number, number] }) {
  const n = value.length;
  const tone = n === 0 ? "text-muted" : n < ideal[0] || n > ideal[1] ? "text-[#a0661f]" : "text-[#2f6339]";
  return <span className={`text-2xs tabular-nums ${tone}`}>{n} / {ideal[1]}</span>;
}

type Platform = "whatsapp" | "telegram" | "facebook" | "x";

/** How the link looks when shared, drawn after each app's own card. */
function ShareCard({ platform, title, description, image }: { platform: Platform; title: string; description: string; image: string }) {
  if (platform === "whatsapp") {
    return (
      <div className="bg-[#e5ddd5] p-3">
        <div className="ml-auto max-w-[17rem] overflow-hidden rounded-lg bg-[#dcf8c6] p-1 shadow-sm">
          <div className="overflow-hidden rounded-md bg-[#cfe9ba]">
            <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" />
            <div className="px-2 py-1.5">
              <div className="line-clamp-2 text-[0.8rem] leading-snug font-semibold text-[#111]">{title}</div>
              <div className="line-clamp-2 text-[0.72rem] leading-snug text-[#555]">{description}</div>
              <div className="mt-0.5 text-[0.68rem] text-[#777]">{HOST}</div>
            </div>
          </div>
          <div className="px-1.5 pt-1 text-[0.75rem] break-all text-[#027eb5]">https://{HOST}/…</div>
        </div>
      </div>
    );
  }
  if (platform === "telegram") {
    return (
      <div className="bg-[#8fb0d3]/40 p-3">
        <div className="max-w-[17rem] rounded-xl bg-white p-2 shadow-sm">
          <div className="text-[0.75rem] break-all text-[#2481cc]">https://{HOST}/…</div>
          <div className="mt-1 border-l-2 border-[#2481cc] pl-2">
            <div className="text-[0.72rem] font-semibold text-[#2481cc]">Span Floors</div>
            <div className="line-clamp-2 text-[0.78rem] leading-snug font-semibold text-[#111]">{title}</div>
            <div className="line-clamp-3 text-[0.72rem] leading-snug text-[#333]">{description}</div>
            <img src={image} alt="" className="mt-1.5 aspect-[1.91/1] w-full rounded-md object-cover" />
          </div>
        </div>
      </div>
    );
  }
  if (platform === "facebook") {
    return (
      <div className="border border-[#dadde1] bg-white">
        <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" />
        <div className="bg-[#f0f2f5] px-3 py-2">
          <div className="text-[0.68rem] tracking-wide text-[#606770] uppercase">{HOST}</div>
          <div className="line-clamp-2 text-[0.85rem] leading-snug font-semibold text-[#1d2129]">{title}</div>
          <div className="line-clamp-1 text-[0.75rem] text-[#606770]">{description}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[#cfd9de] bg-white">
      <div className="relative">
        <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" />
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 text-[0.7rem] text-white">{HOST}</span>
      </div>
      <div className="px-3 py-2 text-[0.75rem] text-[#536471]">
        <div className="line-clamp-1 text-[#0f1419]">{title}</div>
      </div>
    </div>
  );
}

const STATUS_DOT = { good: "bg-[#3d7a4a]", warn: "bg-[#c08a2a]", bad: "bg-brand" } as const;

export type SeoInitial = {
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  robots: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: { id: string; url: string } | null;
  schemaType: string;
};

export default function SeoPanel({
  initial,
  title,
  excerpt,
  path,
  type,
  photo,
  formRef,
  changeTick,
  contentId,
  isLive,
}: {
  initial: SeoInitial;
  title: string;
  excerpt: string;
  path: string;
  type: "post" | "page";
  /** The page's own photo (featured image) for the automatic share card. */
  photo: string | null;
  formRef: RefObject<HTMLFormElement | null>;
  /** Changes whenever the form changes, so the checklist re-runs. */
  changeTick: number;
  contentId: string | null;
  isLive: boolean;
}) {
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [focusKeyword, setFocusKeyword] = useState(initial.focusKeyword);
  const [noindex, setNoindex] = useState(/noindex/.test(initial.robots));
  const [schemaType, setSchemaType] = useState(initial.schemaType);
  // Advanced settings stay folded unless one of them is already in use.
  const advancedOpen = Boolean(initial.canonicalUrl || /noindex/.test(initial.robots) || initial.schemaType);
  const [ogTitle, setOgTitle] = useState(initial.ogTitle);
  const [ogDescription, setOgDescription] = useState(initial.ogDescription);
  const [ogImage, setOgImage] = useState(initial.ogImage);
  const [picking, setPicking] = useState(false);
  const [platform, setPlatform] = useState<Platform>("whatsapp");
  const [report, setReport] = useState<SeoReport | null>(null);
  const [ai, setAi] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const [psi, setPsi] = useState<{ busy: boolean; result?: PagespeedResult; strategy: "mobile" | "desktop" }>({ busy: false, strategy: "mobile" });
  const run = useRef(0);

  // Re-check a moment after the editor stops typing.
  useEffect(() => {
    const n = ++run.current;
    const t = setTimeout(() => {
      if (!formRef.current) return;
      checkSeoForm(new FormData(formRef.current))
        .then((r) => n === run.current && setReport(r))
        .catch(() => undefined);
    }, 900);
    return () => clearTimeout(t);
  }, [changeTick, seoTitle, seoDescription, focusKeyword, noindex, ogImage, formRef]);

  const effTitle = seoTitle || `${title || "Untitled"} - Span Floors`;
  const effDesc = seoDescription || excerpt || "Add a meta description to control this text.";
  const shareTitle = ogTitle || effTitle;
  const shareDesc = ogDescription || effDesc;
  const card = `/og/?${new URLSearchParams({ title: (title || "Span Floors").slice(0, 110), kicker: type === "post" ? "Span Floors blog" : "Span Floors", ...(photo ? { img: photo } : {}) })}`;
  const shareImage = ogImage?.url ?? card;

  const writeWithAi = async () => {
    if (!formRef.current) return;
    setAi({ busy: true });
    const r = await writeSeoWithAi(new FormData(formRef.current)).catch(() => ({ error: "The AI didn't answer. Try again." }) as { error: string });
    if ("title" in r && r.title) {
      setSeoTitle(r.title);
      setSeoDescription(r.description);
      setAi({ busy: false });
    } else setAi({ busy: false, error: (r as { error?: string }).error ?? "No suggestion." });
  };

  return (
    <>
      <input type="hidden" name="ogImageMediaId" value={ogImage?.id ?? ""} />
      <input type="hidden" name="schemaType" value={schemaType} />

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border border-line bg-white/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">How it looks on Google</h2>
          <button type="button" className={`${btn.ghost} h-7 px-0`} onClick={writeWithAi} disabled={ai.busy} title="Suggest a title and description from the page's own text">
            {ai.busy ? "Writing…" : "Write with AI"}
          </button>
        </div>
        {ai.error && <p className="text-2xs text-brand">{ai.error}</p>}
        <div className="min-w-0 border border-line bg-white p-3" aria-label="Google result preview">
          <div className="truncate text-2xs text-[#4d5156]">
            {HOST}
            {path.replace(/\/$/, "").replaceAll("/", " › ")}
          </div>
          <div className="mt-0.5 line-clamp-1 text-[1.05rem] leading-snug text-[#1a0dab]">{effTitle}</div>
          <div className="mt-0.5 line-clamp-2 text-2xs leading-snug text-[#4d5156]">{effDesc}</div>
        </div>
        <Field label="Main search phrase" htmlFor="focusKeyword" hint="What people type into Google to find this, e.g. “engineered wood flooring Delhi”.">
          <input id="focusKeyword" name="focusKeyword" value={focusKeyword} maxLength={80} onChange={(e) => setFocusKeyword(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Title on Google" htmlFor="seoTitle" hint="Leave empty to use the page title.">
          <input id="seoTitle" name="seoTitle" value={seoTitle} maxLength={120} onChange={(e) => setSeoTitle(e.target.value)} placeholder={`${title} - Span Floors`} className={inputCls} />
          <Counter value={seoTitle} ideal={[30, 60]} />
        </Field>
        <Field label="Text under the title" htmlFor="seoDescription" hint="One or two sentences that make people click.">
          <textarea id="seoDescription" name="seoDescription" value={seoDescription} maxLength={320} onChange={(e) => setSeoDescription(e.target.value)} rows={3} className={`${inputCls} h-auto py-2`} />
          <Counter value={seoDescription} ideal={[70, 160]} />
        </Field>
        <details className="group border-t border-line pt-2" open={advancedOpen}>
          <summary className="cursor-pointer text-2xs text-muted hover:text-ink">More options{noindex ? " · hidden from Google" : ""}</summary>
          <div className="mt-3 grid gap-3">
            {type === "page" && (
              <Field label="Page type for Google" htmlFor="schemaTypeDd">
                <Dropdown id="schemaTypeDd" aria-label="Page type for Google" value={schemaType} onChange={setSchemaType} options={SCHEMA_TYPES.map((t) => ({ value: t.value, label: t.label, hint: t.hint }))} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-2xs">
              <input type="checkbox" name="noindex" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} />
              Keep this page out of Google
            </label>
            <Field label="Main address for Google (optional)" htmlFor="canonicalUrl" hint="Only when the same content lives at another address.">
              <input id="canonicalUrl" name="canonicalUrl" defaultValue={initial.canonicalUrl} placeholder="Leave empty for this page’s own address" className={inputCls} />
            </Field>
          </div>
        </details>
      </section>

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border border-line bg-white/40 p-4">
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">How it looks when shared</h2>
        <div className="flex flex-wrap gap-1" role="group" aria-label="App">
          {(
            [
              ["whatsapp", "WhatsApp"],
              ["telegram", "Telegram"],
              ["facebook", "Facebook / LinkedIn"],
              ["x", "X"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={platform === k} onClick={() => setPlatform(k)} className="h-7 border border-line px-2 text-2xs aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper">
              {l}
            </button>
          ))}
        </div>
        <ShareCard platform={platform} title={shareTitle} description={shareDesc} image={shareImage} />
        <div className="grid gap-2">
          <span className="text-2xs font-medium">Share image</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn.secondary} onClick={() => setPicking(true)}>
              {ogImage ? "Change" : "Choose image"}
            </button>
            {ogImage && (
              <button type="button" className={btn.ghost} onClick={() => setOgImage(null)}>
                Use the automatic card
              </button>
            )}
          </div>
          <p className="text-2xs text-muted">{ogImage ? "Best at 1200 × 630 pixels." : "Automatic: a branded card with the page title and featured image."}</p>
        </div>
        <details className="border-t border-line pt-2" open={Boolean(initial.ogTitle || initial.ogDescription)}>
          <summary className="cursor-pointer text-2xs text-muted hover:text-ink">Use different words when shared</summary>
          <div className="mt-3 grid gap-3">
            <Field label="Share title (optional)" htmlFor="ogTitle">
              <input id="ogTitle" name="ogTitle" value={ogTitle} maxLength={120} onChange={(e) => setOgTitle(e.target.value)} placeholder={effTitle} className={inputCls} />
            </Field>
            <Field label="Share description (optional)" htmlFor="ogDescription">
              <textarea id="ogDescription" name="ogDescription" value={ogDescription} maxLength={300} onChange={(e) => setOgDescription(e.target.value)} rows={2} placeholder={effDesc} className={`${inputCls} h-auto py-2`} />
            </Field>
          </div>
        </details>
      </section>

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border border-line bg-white/40 p-4" aria-live="polite">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Google check</h2>
          {report && <span className={`text-title tabular-nums ${report.score >= 80 ? "text-[#2f6339]" : report.score >= 55 ? "text-[#a0661f]" : "text-brand"}`}>{report.score}</span>}
        </div>
        {!report ? (
          <p className="text-2xs text-muted">Checking…</p>
        ) : (
          <>
            {report.checks.some((c) => c.status !== "good") ? (
              <ul className="grid gap-1.5">
                {report.checks.filter((c) => c.status !== "good").map((c) => (
                  <li key={c.id} className="flex gap-2 text-2xs leading-snug">
                    <span aria-hidden="true" className={`mt-1 size-2 shrink-0 rounded-full ${STATUS_DOT[c.status]}`} />
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-2xs text-[#2f6339]">Ready for Google ✓</p>
            )}
            {report.checks.some((c) => c.status === "good") && (
              <details>
                <summary className="cursor-pointer text-2xs text-muted hover:text-ink">{report.checks.filter((c) => c.status === "good").length} things are already fine</summary>
                <ul className="mt-2 grid gap-1.5">
                  {report.checks.filter((c) => c.status === "good").map((c) => (
                    <li key={c.id} className="flex gap-2 text-2xs leading-snug text-muted">
                      <span aria-hidden="true" className={`mt-1 size-2 shrink-0 rounded-full ${STATUS_DOT[c.status]}`} />
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        <div className="grid gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btn.secondary}
              disabled={!isLive || psi.busy}
              title={isLive ? undefined : "Google can only check a page that is live"}
              onClick={async () => {
                setPsi((p) => ({ ...p, busy: true, result: undefined }));
                const result = await pagespeedCheck(path, psi.strategy).catch(() => ({ ok: false, error: "The check didn't finish. Try again." }) as PagespeedResult);
                setPsi((p) => ({ ...p, busy: false, result }));
              }}
            >
              {psi.busy ? "Google is checking…" : "Check with Google"}
            </button>
            <Dropdown size="sm" aria-label="Device" value={psi.strategy} onChange={(v) => setPsi((p) => ({ ...p, strategy: v as "mobile" | "desktop" }))} options={[{ value: "mobile", label: "Phone" }, { value: "desktop", label: "Desktop" }]} />
          </div>
          {psi.result && !psi.result.ok && <p className="text-2xs text-brand">{psi.result.error}</p>}
          {psi.result?.ok && (() => {
            const ok = psi.result;
            return (
            <div className="grid gap-2 text-2xs">
              <div className="grid grid-cols-4 gap-1 text-center">
                {(["seo", "performance", "accessibility", "bestPractices"] as const).map((k) => {
                  const v = ok.scores[k];
                  return (
                    <div key={k} className="border border-line bg-white px-1 py-1.5">
                      <div className={`text-body tabular-nums ${v == null ? "" : v >= 90 ? "text-[#2f6339]" : v >= 50 ? "text-[#a0661f]" : "text-brand"}`}>{v ?? "–"}</div>
                      <div className="text-muted">{k === "bestPractices" ? "Best practice" : k === "seo" ? "SEO" : k[0].toUpperCase() + k.slice(1)}</div>
                    </div>
                  );
                })}
              </div>
              {ok.issues.length > 0 && (
                <ul className="grid list-disc gap-1 pl-4">
                  {ok.issues.slice(0, 6).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </div>
            );
          })()}
        </div>
      </section>

      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 sm:p-6" onClick={() => setPicking(false)}>
          <div role="dialog" aria-modal="true" aria-label="Share image" className="max-h-[85vh] w-full max-w-5xl overflow-y-auto bg-paper p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono text-title">Share image</h2>
              <button type="button" className={btn.ghost} onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            <MediaLibrary
              picker
              initialKind="image"
              onPick={(m) => {
                setOgImage({ id: m.id, url: m.url });
                setPicking(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
