"use client";

import { useState } from "react";
import { saveAuthor } from "@/app/admin/(panel)/content/blog-actions";
import MediaLibrary from "./MediaLibrary";
import { btn, Field, inputCls } from "./ui";

type Initial = { id: string; name: string; slug: string; jobTitle: string; bio: string; links: string; photo: { id: string; url: string } | null };

export default function AuthorForm({ initial }: { initial: Initial }) {
  const [photo, setPhoto] = useState(initial.photo);
  const [picking, setPicking] = useState(false);
  return (
    <form action={saveAuthor} className="grid max-w-2xl gap-5">
      <input type="hidden" name="id" value={initial.id} />
      <input type="hidden" name="photoMediaId" value={photo?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name (as on the posts)" htmlFor="name">
          <input id="name" name="name" required defaultValue={initial.name} maxLength={80} className={inputCls} />
        </Field>
        <Field label="Page address" htmlFor="slug" hint="/blog/author/…/">
          <input id="slug" name="slug" defaultValue={initial.slug} maxLength={80} className={`${inputCls} font-mono text-2xs`} />
        </Field>
      </div>
      <Field label="Job title" htmlFor="jobTitle" hint="e.g. Founder, Span Floors">
        <input id="jobTitle" name="jobTitle" defaultValue={initial.jobTitle} maxLength={100} className={inputCls} />
      </Field>
      <Field label="Short bio" htmlFor="bio" hint="Two or three sentences: experience and what they write about.">
        <textarea id="bio" name="bio" defaultValue={initial.bio} rows={4} maxLength={1500} className={`${inputCls} h-auto py-2`} />
      </Field>
      <Field label="Profile links (one per line)" htmlFor="links" hint="LinkedIn and similar. Sent to Google so it knows who the author is.">
        <textarea id="links" name="links" defaultValue={initial.links} rows={3} className={`${inputCls} h-auto py-2 font-mono text-2xs`} />
      </Field>
      <div className="grid gap-1.5">
        <span className="text-2xs font-medium">Photo</span>
        <div className="flex flex-wrap items-center gap-3">
          {photo && <img src={`${photo.url}?w=320`} alt="" className="size-16 rounded-full object-cover" />}
          <button type="button" className={btn.secondary} onClick={() => setPicking(true)}>
            {photo ? "Change photo" : "Choose photo"}
          </button>
          {photo && (
            <button type="button" className={btn.ghost} onClick={() => setPhoto(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
      <div>
        <button className={btn.primary}>Save author</button>
      </div>
      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 sm:p-6" onClick={() => setPicking(false)}>
          <div role="dialog" aria-modal="true" aria-label="Author photo" className="max-h-[85vh] w-full max-w-5xl overflow-y-auto bg-paper p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono text-title">Author photo</h2>
              <button type="button" className={btn.ghost} onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            <MediaLibrary
              picker
              initialKind="image"
              onPick={(m) => {
                setPhoto({ id: m.id, url: m.url });
                setPicking(false);
              }}
            />
          </div>
        </div>
      )}
    </form>
  );
}
