"use client";

import { useState } from "react";
import type { Aeo } from "@/server/aeo";
import { btn, inputCls } from "./ui";

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Answer engines: the short answer AI search quotes, key takeaways, and questions with answers
 * (shown on the page and sent to Google as FAQ data).
 */
export default function AeoPanel({ initial, type }: { initial: Aeo; type: "post" | "page" }) {
  const [answer, setAnswer] = useState(initial.answer);
  const [takeaways, setTakeaways] = useState<string[]>(initial.takeaways);
  const [faqs, setFaqs] = useState(initial.faqs);
  const [reviewedAt, setReviewedAt] = useState(initial.reviewedAt ?? "");
  const [open, setOpen] = useState(Boolean(initial.answer || initial.takeaways.length || initial.faqs.length));
  const wc = words(answer);
  const value = JSON.stringify({ answer, takeaways: takeaways.filter((t) => t.trim()), faqs: faqs.filter((f) => f.q.trim() && f.a.trim()), reviewedAt: reviewedAt || null });

  return (
    <section className="grid min-w-0 gap-4 border border-line bg-white/40 p-4">
      <input type="hidden" name="aeo" value={value} />
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center justify-between text-left">
        <span>
          <span className="block text-2xs font-semibold tracking-[0.06em] uppercase">Google & AI answers</span>
          <span className="block text-2xs text-muted">Optional: a short answer, key points and questions that Google, ChatGPT and others can quote.</span>
        </span>
        <span className="text-2xs text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <>
          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="aeo-answer" className="text-2xs font-medium">
                Short answer
              </label>
              <span className={`text-2xs tabular-nums ${wc === 0 ? "text-muted" : wc < 30 || wc > 70 ? "text-[#a0661f]" : "text-[#2f6339]"}`}>{wc} words · aim for 40–60</span>
            </div>
            <textarea id="aeo-answer" value={answer} maxLength={600} rows={3} onChange={(e) => setAnswer(e.target.value)} className={`${inputCls} h-auto py-2`} placeholder={type === "post" ? "Answer the headline in two or three sentences, complete on their own." : "What this page offers, in two or three sentences."} />
            <p className="text-2xs text-muted">{type === "post" ? "Shown in a box at the top of the post." : "Shown after the page sections, with the questions below it."}</p>
          </div>

          <div className="grid gap-1.5">
            <span className="text-2xs font-medium">Key takeaways ({takeaways.length}/8)</span>
            {takeaways.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Takeaway ${i + 1}`} value={t} maxLength={200} onChange={(e) => setTakeaways((l) => l.map((x, j) => (j === i ? e.target.value : x)))} className={`${inputCls} min-w-0 flex-1`} />
                <button type="button" className={btn.ghost} onClick={() => setTakeaways((l) => l.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            {takeaways.length < 8 && (
              <button type="button" className={`${btn.secondary} w-fit`} onClick={() => setTakeaways((l) => [...l, ""])}>
                + Add a takeaway
              </button>
            )}
          </div>

          <div className="grid gap-2">
            <span className="text-2xs font-medium">Questions and answers ({faqs.length}/20)</span>
            {faqs.map((f, i) => (
              <div key={i} className="grid gap-2 border border-line bg-paper p-3">
                <input aria-label={`Question ${i + 1}`} placeholder="Question people ask" value={f.q} maxLength={200} onChange={(e) => setFaqs((l) => l.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} className={inputCls} />
                <textarea aria-label={`Answer ${i + 1}`} placeholder="Short, complete answer (40–80 words)" value={f.a} maxLength={1200} rows={3} onChange={(e) => setFaqs((l) => l.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} className={`${inputCls} h-auto py-2`} />
                <button type="button" className={`${btn.ghost} w-fit px-0`} onClick={() => setFaqs((l) => l.filter((_, j) => j !== i))}>
                  Remove question
                </button>
              </div>
            ))}
            {faqs.length < 20 && (
              <button type="button" className={`${btn.secondary} w-fit`} onClick={() => setFaqs((l) => [...l, { q: "", a: "" }])}>
                + Add a question
              </button>
            )}
          </div>

          <label className="grid w-fit gap-1.5 text-2xs font-medium">
            Last reviewed (shows readers and Google the facts are current)
            <input type="date" value={reviewedAt} onChange={(e) => setReviewedAt(e.target.value)} className={inputCls} />
          </label>
        </>
      )}
    </section>
  );
}
