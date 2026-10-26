"use client";

import { useState, useTransition, type ReactNode } from "react";
import Dropdown from "@/components/ui/Dropdown";
import { saveConfig } from "@/app/admin/(panel)/settings/config-actions";
import type { Config } from "@/server/site-config";
import FieldEditor from "./builder/FieldEditor";
import MediaLibrary from "./MediaLibrary";
import { btn, inputCls, Notice } from "./ui";

/* Admin → Site settings: one card per structured setting, each saved on its own. */

type Identity = Config<"config.identity">;
type Contact = Config<"config.contact">;
type Studios = Config<"config.studios">;
type Tracking = Config<"config.tracking">;
type Cookies = Config<"config.cookies">;
type Announcement = Config<"config.announcement">;

function Card({ title, description, children, onSave }: { title: string; description?: string; children: ReactNode; onSave: () => Promise<{ ok?: boolean; error?: string }> }) {
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="min-w-0 border border-line bg-white/40">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">{title}</h2>
        {description && <p className="mt-1 text-2xs text-muted">{description}</p>}
      </div>
      <div className="grid gap-5 p-5">
        {children}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={btn.primary}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await onSave();
                setMsg(r.error ? { tone: "error", text: r.error } : { tone: "success", text: "Saved. The website shows the change now." });
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </div>
      </div>
    </section>
  );
}

function Text({ label, value, onChange, hint, type = "text", placeholder, mono = false }: { label: string; value: string; onChange: (v: string) => void; hint?: string; type?: string; placeholder?: string; mono?: boolean }) {
  return (
    <label className="grid gap-1.5 text-2xs font-medium">
      {label}
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${mono ? "font-mono text-2xs" : ""}`} />
      {hint && <span className="font-normal text-muted">{hint}</span>}
    </label>
  );
}

function ImagePick({ label, hint, url, onPick, onClear }: { label: string; hint: string; url: string | null; onPick: (id: string, url: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-1.5">
      <span className="text-2xs font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-16 w-28 place-items-center border border-line bg-[repeating-conic-gradient(#ede8e2_0_25%,#fff_0_50%)] bg-[length:12px_12px]">{url ? <img src={url} alt="" className="max-h-14 max-w-24 object-contain" /> : <span className="text-2xs text-muted">Default</span>}</div>
        <button type="button" className={btn.secondary} onClick={() => setOpen(true)}>
          {url ? "Change" : "Choose"}
        </button>
        {url && (
          <button type="button" className={btn.ghost} onClick={onClear}>
            Use the default
          </button>
        )}
      </div>
      <span className="text-2xs text-muted">{hint}</span>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 sm:p-6" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={label} className="max-h-[85vh] w-full max-w-5xl overflow-y-auto bg-paper p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono text-title">{label}</h2>
              <button type="button" className={btn.ghost} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <MediaLibrary
              picker
              initialKind="image"
              onPick={(m) => {
                onPick(m.id, m.url);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const NETWORKS = ["instagram", "facebook", "linkedin", "youtube", "x", "pinterest"] as const;

export default function SiteConfigEditor({
  initial,
  urls,
  canEditTracking,
}: {
  initial: { identity: Identity; contact: Contact; studios: Studios; tracking: Tracking; cookies: Cookies; announcement: Announcement };
  urls: { logo: string | null; logoLight: string | null; favicon: string | null; shareImage: string | null };
  canEditTracking: boolean;
}) {
  const [identity, setIdentity] = useState(initial.identity);
  const [idUrls, setIdUrls] = useState(urls);
  const [contact, setContact] = useState(initial.contact);
  const [studios, setStudios] = useState(initial.studios);
  const [tracking, setTracking] = useState(initial.tracking);
  const [cookies, setCookies] = useState(initial.cookies);
  const [bar, setBar] = useState(initial.announcement);

  const image = (key: keyof Identity, label: string, hint: string) => (
    <ImagePick
      label={label}
      hint={hint}
      url={idUrls[key]}
      onPick={(id, url) => {
        setIdentity((v) => ({ ...v, [key]: id }));
        setIdUrls((u) => ({ ...u, [key]: url }));
      }}
      onClear={() => {
        setIdentity((v) => ({ ...v, [key]: null }));
        setIdUrls((u) => ({ ...u, [key]: null }));
      }}
    />
  );
  const updStudio = (i: number, patch: Partial<Studios[number]>) => setStudios((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
      <Card title="Logo and icons" description="Used in the header, footer, browser tab and the automatic share cards." onSave={() => saveConfig("config.identity", identity)}>
        {image("logo", "Logo", "A wide PNG or WebP with a transparent background. Leave empty for the current Span Floors logo.")}
        {image("logoLight", "Logo for dark backgrounds", "A light version for the footer.")}
        {image("favicon", "Site icon (browser tab)", "A square image, at least 64 × 64 pixels.")}
        {image("shareImage", "Default share photo", "Used in share cards for pages that have no photo of their own.")}
      </Card>

      <Card title="Contact details and social links" description="Shown in the footer, on contact sections and sent to Google." onSave={() => saveConfig("config.contact", contact)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Phone" value={contact.phone} onChange={(v) => setContact((c) => ({ ...c, phone: v }))} placeholder="+91 92120 96387" />
          <Text label="Email" type="email" value={contact.email} onChange={(v) => setContact((c) => ({ ...c, email: v }))} />
        </div>
        <div className="grid gap-2">
          <span className="text-2xs font-medium">Social links</span>
          {contact.social.map((s, i) => (
            <div key={i} className="grid grid-cols-[9rem_minmax(0,1fr)_auto] gap-2">
              <Dropdown aria-label="Network" value={s.network} onChange={(v) => setContact((c) => ({ ...c, social: c.social.map((x, j) => (j === i ? { ...x, network: v as typeof s.network } : x)) }))} options={NETWORKS.map((n) => ({ value: n, label: n === "x" ? "X (Twitter)" : n[0].toUpperCase() + n.slice(1) }))} />
              <input aria-label="Profile address" value={s.url} placeholder="https://…" onChange={(e) => setContact((c) => ({ ...c, social: c.social.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) }))} className={`${inputCls} font-mono text-2xs`} />
              <button type="button" className={btn.ghost} onClick={() => setContact((c) => ({ ...c, social: c.social.filter((_, j) => j !== i) }))}>
                Remove
              </button>
            </div>
          ))}
          {contact.social.length < 8 && (
            <button type="button" className={`${btn.secondary} w-fit`} onClick={() => setContact((c) => ({ ...c, social: [...c.social, { network: "youtube", url: "" }] }))}>
              + Add a social link
            </button>
          )}
        </div>
      </Card>

      <Card title="Experience studios" description="Where visitors can see the floors. Shown in Studios sections, on the contact page and sent to Google as local businesses." onSave={() => saveConfig("config.studios", studios)}>
        {studios.length === 0 && <p className="text-2xs text-muted">No studios yet.</p>}
        {studios.map((s, i) => (
          <div key={i} className="grid gap-3 border border-line bg-paper p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Name" value={s.name} onChange={(v) => updStudio(i, { name: v })} placeholder="Sultanpur, New Delhi" />
              <Text label="City" value={s.city} onChange={(v) => updStudio(i, { city: v })} />
            </div>
            <label className="grid gap-1.5 text-2xs font-medium">
              Address
              <textarea value={s.address} rows={2} onChange={(e) => updStudio(i, { address: e.target.value })} className={`${inputCls} h-auto py-2`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Text label="Phone" value={s.phone} onChange={(v) => updStudio(i, { phone: v })} />
              <Text label="Opening hours" value={s.hours} onChange={(v) => updStudio(i, { hours: v })} placeholder="Mo-Sa 10:30-18:30" hint="Format Google understands, e.g. Mo-Sa 10:30-18:30" />
              <div className="grid gap-1.5 text-2xs font-medium">
                Country
                <Dropdown aria-label="Country" value={s.country} onChange={(v) => updStudio(i, { country: v })} options={[{ value: "IN", label: "India" }, { value: "AE", label: "United Arab Emirates" }, { value: "NP", label: "Nepal" }, { value: "BT", label: "Bhutan" }]} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Text label="Google Maps link" value={s.mapUrl} onChange={(v) => updStudio(i, { mapUrl: v })} mono placeholder="https://maps.app.goo.gl/…" />
              <Text label="Latitude" value={s.lat == null ? "" : String(s.lat)} onChange={(v) => updStudio(i, { lat: num(v) })} mono />
              <Text label="Longitude" value={s.lng == null ? "" : String(s.lng)} onChange={(v) => updStudio(i, { lng: num(v) })} mono />
            </div>
            <div className="flex gap-2">
              <button type="button" className={btn.ghost} disabled={i === 0} onClick={() => setStudios((l) => [...l.slice(0, i - 1), l[i], l[i - 1], ...l.slice(i + 1)])}>
                Move up
              </button>
              <button type="button" className={btn.ghost} onClick={() => setStudios((l) => l.filter((_, j) => j !== i))}>
                Remove studio
              </button>
            </div>
          </div>
        ))}
        {studios.length < 12 && (
          <button type="button" className={`${btn.secondary} w-fit`} onClick={() => setStudios((l) => [...l, { name: "", address: "", city: "", country: "IN", phone: "", hours: "", mapUrl: "", lat: null, lng: null }])}>
            + Add a studio
          </button>
        )}
      </Card>

      {canEditTracking && (
        <Card title="Tracking and verification" description="Analytics and ad codes run on every page. With consent on, they wait until a visitor accepts cookies." onSave={() => saveConfig("config.tracking", tracking)}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Text label="Google Analytics 4 ID" value={tracking.ga4} onChange={(v) => setTracking((t) => ({ ...t, ga4: v.toUpperCase() }))} mono placeholder="G-XXXXXXX" />
            <Text label="Google Tag Manager ID" value={tracking.gtm} onChange={(v) => setTracking((t) => ({ ...t, gtm: v.toUpperCase() }))} mono placeholder="GTM-XXXXXX" />
            <Text label="Meta (Facebook) Pixel ID" value={tracking.metaPixel} onChange={(v) => setTracking((t) => ({ ...t, metaPixel: v.replace(/\D/g, "") }))} mono />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Google Search Console verification code" value={tracking.googleVerification} onChange={(v) => setTracking((t) => ({ ...t, googleVerification: v.replace(/.*content="([^"]+)".*/, "$1") }))} mono hint="Paste the code or the whole meta tag." />
            <Text label="Bing Webmaster verification code" value={tracking.bingVerification} onChange={(v) => setTracking((t) => ({ ...t, bingVerification: v.replace(/.*content="([^"]+)".*/, "$1") }))} mono />
          </div>
          <label className="flex items-center gap-2 text-2xs">
            <input type="checkbox" checked={tracking.requireConsent} onChange={(e) => setTracking((t) => ({ ...t, requireConsent: e.target.checked }))} />
            Ask visitors before using analytics and ad cookies (recommended)
          </label>
        </Card>
      )}

      <Card title="Cookie banner" description="Shown to new visitors when tracking codes are set and consent is required." onSave={() => saveConfig("config.cookies", cookies)}>
        <label className="flex items-center gap-2 text-2xs">
          <input type="checkbox" checked={cookies.enabled} onChange={(e) => setCookies((c) => ({ ...c, enabled: e.target.checked }))} />
          Show the cookie banner
        </label>
        <label className="grid gap-1.5 text-2xs font-medium">
          Text
          <textarea value={cookies.text} maxLength={400} rows={3} onChange={(e) => setCookies((c) => ({ ...c, text: e.target.value }))} className={`${inputCls} h-auto py-2`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Accept button" value={cookies.accept} onChange={(v) => setCookies((c) => ({ ...c, accept: v }))} />
          <Text label="Decline button" value={cookies.decline} onChange={(v) => setCookies((c) => ({ ...c, decline: v }))} />
        </div>
        <FieldEditor field={{ name: "policy", label: "Link to the privacy policy", kind: "link" }} id="cookie-policy" value={cookies.policy} onChange={(v) => setCookies((c) => ({ ...c, policy: v as Cookies["policy"] }))} />
      </Card>

      <Card title="Announcement bar" description="A thin bar above the header for offers, events or news." onSave={() => saveConfig("config.announcement", bar)}>
        <label className="flex items-center gap-2 text-2xs">
          <input type="checkbox" checked={bar.enabled} onChange={(e) => setBar((b) => ({ ...b, enabled: e.target.checked }))} />
          Show the announcement bar
        </label>
        <Text label="Text" value={bar.text} onChange={(v) => setBar((b) => ({ ...b, text: v }))} placeholder="Visit our new Dubai studio, now open" />
        <FieldEditor field={{ name: "link", label: "Link (optional)", kind: "link" }} id="bar-link" value={bar.link} onChange={(v) => setBar((b) => ({ ...b, link: v as Announcement["link"] }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Stop showing after (optional)" type="datetime-local" value={bar.until.slice(0, 16)} onChange={(v) => setBar((b) => ({ ...b, until: v }))} />
          <div className="grid gap-1.5 text-2xs font-medium">
            Colour
            <Dropdown aria-label="Colour" value={bar.tone} onChange={(v) => setBar((b) => ({ ...b, tone: v as Announcement["tone"] }))} options={[{ value: "dark", label: "Dark" }, { value: "brand", label: "Span red" }, { value: "light", label: "Light" }]} />
          </div>
        </div>
      </Card>
    </div>
  );
}
