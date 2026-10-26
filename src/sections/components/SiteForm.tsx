"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Dropdown from "@/components/ui/Dropdown";

/**
 * The website's forms (enquiry, samples, brochure download, dealer, video call, studio visit). Posts to
 * /api/forms/<type>/ with the anti-bot token; every lead is saved in the admin first and then copied to Twenty.
 */

export type FormType = "enquiry" | "sample" | "download" | "dealer" | "video_call" | "visit";

const PROFESSIONS = [
  { value: "homeowner", label: "Homeowner" },
  { value: "architect", label: "Architect" },
  { value: "interior_designer", label: "Interior designer" },
  { value: "builder", label: "Builder or developer" },
  { value: "contractor", label: "Contractor" },
  { value: "dealer", label: "Dealer" },
  { value: "other", label: "Other" },
];

const SUBMIT: Record<FormType, string> = {
  enquiry: "Send enquiry",
  sample: "Request samples",
  download: "Get the download",
  dealer: "Apply to become a dealer",
  video_call: "Book the video call",
  visit: "Book the visit",
};

const DONE: Record<FormType, string> = {
  enquiry: "Thank you. Our team will call you shortly.",
  sample: "Thank you. We'll confirm your samples and delivery by phone.",
  download: "Thank you. Your download is ready below.",
  dealer: "Thank you. Our partnerships team will contact you.",
  video_call: "Booked. You'll get a confirmation with the call details.",
  visit: "Booked. We look forward to seeing you at the studio.",
};

const input = "h-11 w-full border border-current/25 bg-transparent px-3 text-body outline-none transition-colors placeholder:opacity-50 focus:border-current";

function F({ label, name, error, children, wide = false }: { label: string; name: string; error?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`grid gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={`f-${name}`} className="text-2xs">
        {label}
      </label>
      {children}
      {error && (
        <p id={`f-${name}-err`} className="text-2xs text-brand">
          {error}
        </p>
      )}
    </div>
  );
}

type Slots = { timezone: string; days: Record<string, string[]> };

function SlotPicker({ type, value, onChange }: { type: "video_call" | "visit"; value: string; onChange: (v: string) => void }) {
  const [slots, setSlots] = useState<Slots | null>(null);
  const [day, setDay] = useState("");
  useEffect(() => {
    fetch(`/api/bookings/slots?type=${type}&days=14`)
      .then((r) => r.json())
      .then((s: Slots) => {
        setSlots(s);
        setDay(Object.keys(s.days)[0] ?? "");
      })
      .catch(() => setSlots({ timezone: "Asia/Kolkata", days: {} }));
  }, [type]);
  if (!slots) return <p className="text-2xs opacity-70">Loading available times…</p>;
  const days = Object.keys(slots.days);
  if (!days.length) return <p className="text-2xs opacity-70">No times are free in the next two weeks. Send an enquiry instead and we'll call you.</p>;
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: slots.timezone });
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day">
        {days.map((d) => (
          <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)} className="h-9 border border-current/25 px-3 text-2xs aria-pressed:border-current aria-pressed:bg-current/10">
            {fmtDay(d)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time">
        {(slots.days[day] ?? []).map((t) => (
          <button key={t} type="button" aria-pressed={t === value} onClick={() => onChange(t)} className="h-9 border border-current/25 px-3 text-2xs tabular-nums aria-pressed:border-current aria-pressed:bg-current/10">
            {fmtTime(t)}
          </button>
        ))}
      </div>
    </div>
  );
}

export type FormTexts = Partial<Record<string, string>>;

export default function SiteForm({
  type,
  products = [],
  downloadId,
  downloadUrl,
  compact = false,
  texts = {},
}: {
  /** Words from Admin → Shared texts (form.submit.*, form.done.*, form.privacy, form.error). */
  texts?: FormTexts;
  type: FormType;
  /** For the samples form: products to choose from. */
  products?: { id: string; name: string }[];
  downloadId?: string;
  downloadUrl?: string;
  compact?: boolean;
}) {
  const [token, setToken] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ profession: "homeowner" });
  const [picked, setPicked] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  useEffect(() => {
    fetch("/api/forms/token/")
      .then((r) => r.json())
      .then((j) => setToken(j.token ?? ""))
      .catch(() => undefined);
  }, []);

  const set = (k: string) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const field = (name: string, label: string, opts: { type?: string; required?: boolean; wide?: boolean; auto?: string; placeholder?: string } = {}) => (
    <F label={`${label}${opts.required ? "" : " (optional)"}`} name={name} error={errors[name]} wide={opts.wide}>
      <input
        id={`f-${name}`}
        name={name}
        type={opts.type ?? "text"}
        required={opts.required}
        autoComplete={opts.auto}
        placeholder={opts.placeholder}
        value={values[name] ?? ""}
        onChange={set(name)}
        aria-invalid={Boolean(errors[name]) || undefined}
        aria-describedby={errors[name] ? `f-${name}-err` : undefined}
        className={input}
      />
    </F>
  );

  const fields = type;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if ((type === "video_call" || type === "visit") && !values.slot) {
      setErrors({ slot: "Choose a day and time." });
      return;
    }
    setState("sending");
    setErrors({});
    setError("");
    const website = (new FormData(e.currentTarget).get("website") as string) ?? "";
    const body: Record<string, unknown> = { ...values, website, _t: token, consent: true };
    if (type === "sample") body.productIds = picked;
    if (type === "download" && downloadId) body.downloadId = downloadId;
    if (type === "dealer" && values.yearsInBusiness === "") delete body.yearsInBusiness;
    try {
      const res = await fetch(`/api/forms/${type}/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setState("done");
        return;
      }
      setErrors(j.fields ?? {});
      setError(j.error ?? (texts["form.error"] || "Something went wrong. Please try again, or call us."));
    } catch {
      setError("Couldn't send. Check your connection and try again.");
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <div role="status" className="grid gap-4 border border-current/20 p-6">
        <p className="text-card">{texts[`form.done.${type}`] || DONE[type]}</p>
        {type === "download" && downloadUrl && (
          <a href={downloadUrl} className="inline-flex h-11 w-fit items-center border border-current px-5 text-2xs" target="_blank" rel="noopener">
            Open the download
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
      {/* Honeypot: real visitors never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="f-website">Website</label>
        <input id="f-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {field("name", "Name", { required: true, auto: "name" })}
      {fields === "dealer" && field("company", "Company", { required: true, auto: "organization" })}
      {field("phone", "Phone", { type: "tel", required: ["sample", "dealer"].includes(type), auto: "tel", placeholder: "+91" })}
      {field("email", "Email", { type: "email", required: ["download", "dealer"].includes(type), auto: "email" })}

      {(fields === "enquiry" || fields === "video_call" || fields === "visit") && (
        <F label="I am a" name="profession">
          <Dropdown id="f-profession" options={PROFESSIONS} value={values.profession} onChange={(v) => setValues((s) => ({ ...s, profession: v }))} aria-label="I am a" />
        </F>
      )}
      {(fields === "enquiry" || fields === "dealer") && field("city", "City", { auto: "address-level2" })}
      {fields === "dealer" && field("gstin", "GSTIN")}
      {fields === "dealer" && field("yearsInBusiness", "Years in business", { type: "number" })}

      {fields === "sample" && (
        <>
          <F label="Samples (up to 5)" name="productIds" error={errors.productIds} wide>
            <div className="grid max-h-56 gap-1 overflow-y-auto border border-current/25 p-2 sm:grid-cols-2">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-1 text-2xs">
                  <input
                    type="checkbox"
                    checked={picked.includes(p.id)}
                    disabled={!picked.includes(p.id) && picked.length >= 5}
                    onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((i) => i !== p.id)))}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </F>
          {field("address", "Delivery address", { required: true, wide: true, auto: "street-address" })}
          {field("pincode", "PIN code", { required: true, auto: "postal-code" })}
        </>
      )}

      {(fields === "video_call" || fields === "visit") && (
        <F label="Day and time" name="slot" error={errors.slot} wide>
          <SlotPicker type={fields} value={values.slot ?? ""} onChange={(v) => setValues((s) => ({ ...s, slot: v }))} />
        </F>
      )}

      {fields !== "download" && (
        <F label="Message (optional)" name="message" wide>
          <textarea id="f-message" name="message" rows={3} value={values.message ?? ""} onChange={set("message")} className={`${input} h-auto py-2`} />
        </F>
      )}

      <div className="grid gap-3 sm:col-span-2">
        {error && (
          <p role="alert" className="text-2xs text-brand">
            {error}
          </p>
        )}
        <button type="submit" disabled={state === "sending" || !token} className="inline-flex h-11 w-fit items-center border border-current bg-current/0 px-6 text-2xs transition-colors hover:bg-current/10 disabled:opacity-50">
          {state === "sending" ? "Sending…" : texts[`form.submit.${type}`] || SUBMIT[type]}
        </button>
        <p className="text-2xs opacity-60">{texts["form.privacy"] || "We use your details only to reply to you."}</p>
      </div>
    </form>
  );
}
