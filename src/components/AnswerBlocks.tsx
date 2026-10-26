import type { Aeo } from "@/server/aeo";

/* Answer-engine content on pages and posts: a short answer with key points, and questions with answers. */

export function AnswerBox({ aeo, className = "" }: { aeo: Aeo; className?: string }) {
  if (!aeo.answer && !aeo.takeaways.length) return null;
  return (
    <aside aria-label="In short" className={`border-l-2 border-ink bg-paper-2/70 px-5 py-4 ${className}`}>
      {aeo.answer && (
        <>
          <p className="text-2xs tracking-[0.08em] text-muted uppercase">In short</p>
          <p className="mt-2 text-body leading-relaxed">{aeo.answer}</p>
        </>
      )}
      {aeo.takeaways.length > 0 && (
        <ul className={`${aeo.answer ? "mt-3" : ""} grid list-disc gap-1 pl-5 text-body leading-relaxed`}>
          {aeo.takeaways.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function QuestionList({ faqs, className = "" }: { faqs: Aeo["faqs"]; className?: string }) {
  if (!faqs.length) return null;
  return (
    <section aria-labelledby="questions" className={className}>
      <h2 id="questions" className="mono mb-6 text-title md:text-lead">
        Questions
      </h2>
      <div className="border-t border-line">
        {faqs.map((f) => (
          <details key={f.q} className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-card [&::-webkit-details-marker]:hidden">
              {f.q}
              <span aria-hidden="true" className="text-lead leading-none transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-5 leading-relaxed whitespace-pre-line text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
