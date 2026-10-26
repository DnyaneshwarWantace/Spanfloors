"use client";

import { useEffect, useState } from "react";
import { searchPosts } from "@/app/admin/(panel)/content/blog-actions";
import { inputCls } from "./ui";

type Post = { id: string; title: string };

/** Hand-picked "related posts" for a blog post (shown first under the article, up to 3 used). */
export default function RelatedPostsPicker({ initial, selfId }: { initial: Post[]; selfId: string | null }) {
  const [picked, setPicked] = useState<Post[]>(initial);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Post[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchPosts(q, selfId).then(setHits).catch(() => setHits([])), 200);
    return () => clearTimeout(t);
  }, [q, open, selfId]);

  const move = (i: number, d: number) =>
    setPicked((p) => {
      const n = [...p];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });

  return (
    <div className="grid gap-2">
      <input type="hidden" name="relatedIds" value={picked.map((p) => p.id).join(",")} />
      {picked.length > 0 && (
        <ol className="grid gap-1">
          {picked.map((p, i) => (
            <li key={p.id} className="flex min-w-0 items-center gap-2 border border-line bg-white/60 px-2 py-1.5 text-2xs">
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="text-muted hover:text-ink disabled:opacity-30" aria-label="Move up">↑</button>
              <button type="button" disabled={i === picked.length - 1} onClick={() => move(i, 1)} className="text-muted hover:text-ink disabled:opacity-30" aria-label="Move down">↓</button>
              <button type="button" onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))} className="text-muted hover:text-brand" aria-label={`Remove ${p.title}`}>×</button>
            </li>
          ))}
        </ol>
      )}
      {picked.length < 6 && (
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search posts to add"
            aria-label="Search related posts"
            className={inputCls}
          />
          {open && hits.filter((h) => !picked.some((p) => p.id === h.id)).length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto border border-line bg-paper shadow-lg">
              {hits
                .filter((h) => !picked.some((p) => p.id === h.id))
                .map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPicked((p) => [...p, h]);
                        setQ("");
                      }}
                      className="block w-full truncate px-3 py-2 text-left text-2xs hover:bg-paper-2"
                    >
                      {h.title}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
