import type { ComponentProps, ReactNode } from "react";

/* Shared admin building blocks (Tailwind). */

export const btn = {
  primary:
    "inline-flex h-9 items-center justify-center gap-2 border border-ink bg-ink px-4 text-2xs text-paper transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex h-9 items-center justify-center gap-2 border border-ink px-4 text-2xs transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50",
  ghost: "inline-flex h-9 items-center justify-center gap-2 px-3 text-2xs text-muted transition-colors hover:text-ink",
  danger:
    "inline-flex h-9 items-center justify-center gap-2 border border-brand/60 px-4 text-2xs text-brand transition-colors hover:bg-brand hover:text-white disabled:opacity-50",
};

export const inputCls =
  "h-10 w-full border border-line bg-white/60 px-3 text-body outline-none transition-colors placeholder:text-muted/70 focus:border-ink focus:bg-white";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line bg-paper/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:mb-8 lg:px-10 lg:py-5">
      <div>
        <h1 className="mono text-title">{title}</h1>
        {description && <p className="mt-1.5 text-2xs text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-2xs font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-2xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputCls} h-auto min-h-24 py-2 leading-relaxed ${props.className ?? ""}`} />;
}


export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="min-w-0 border border-line bg-white/40">
      {title && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const STATUS_STYLE: Record<string, string> = {
  published: "bg-[#3d7a4a]/12 text-[#2f6339]",
  scheduled: "bg-[#a08a62]/18 text-[#6e5a35]",
  draft: "bg-ink/8 text-ink-2",
  archived: "bg-ink/5 text-muted",
  admin: "bg-ink text-paper",
  editor: "bg-ink/8 text-ink-2",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs capitalize ${STATUS_STYLE[value] ?? "bg-ink/8"}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {label ?? value}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center border border-dashed border-line px-6 py-16 text-center">
      <p className="text-body">{title}</p>
      {children && <div className="mt-2 text-2xs text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: ReactNode }) {
  const cls = tone === "error" ? "border-brand/40 bg-brand/5" : tone === "success" ? "border-[#3d7a4a]/40 bg-[#3d7a4a]/8" : "border-line bg-paper-2/60";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border px-4 py-3 text-2xs ${cls}`}>
      {children}
    </div>
  );
}

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Kolkata",
  });
}
