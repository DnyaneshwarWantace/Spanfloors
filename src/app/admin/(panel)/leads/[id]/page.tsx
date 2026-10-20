import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { LEAD_LABELS, type LeadType } from "@/server/forms";
import { getSetting } from "@/server/settings";
import { btn, formatDate, inputCls, PageHeader } from "@/components/admin/ui";
import { addLeadNote, retryTwenty, updateLead } from "../actions";

export const dynamic = "force-dynamic";

const PROFESSIONS: Record<string, string> = {
  homeowner: "Homeowner",
  architect: "Architect",
  interior_designer: "Interior designer",
  builder: "Builder / developer",
  contractor: "Contractor",
  dealer: "Dealer",
  other: "Other",
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  if (v == null || v === "") return null;
  return (
    <div className="contents">
      <dt className="text-muted">{k}</dt>
      <dd className="break-words whitespace-pre-line">{v}</dd>
    </div>
  );
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
  if (!lead) notFound();

  const [notes, users, whatsappDefault] = await Promise.all([
    db
      .select({ body: schema.leadNotes.body, createdAt: schema.leadNotes.createdAt, name: schema.users.name })
      .from(schema.leadNotes)
      .leftJoin(schema.users, eq(schema.users.id, schema.leadNotes.userId))
      .where(eq(schema.leadNotes.leadId, id))
      .orderBy(asc(schema.leadNotes.createdAt)),
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.active, true)),
    getSetting("forms.whatsapp"),
  ]);

  const d = lead.data as Record<string, unknown>;
  const utm = lead.utm as Record<string, string>;
  const phoneDigits = lead.phone?.replace(/\D/g, "");
  const waNumber = phoneDigits ? (phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits) : null;
  const type = lead.type as LeadType;

  return (
    <>
      <PageHeader
        title={lead.name}
        description={
          <>
            <Link href="/admin/leads/" className="hover:underline">
              ← All leads
            </Link>{" "}
            · {LEAD_LABELS[type]} · received {formatDate(lead.createdAt, true)}
          </>
        }
        actions={
          <>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className={btn.secondary}>
                Call
              </a>
            )}
            {waNumber && (
              <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello ${lead.name}, this is Span Floors regarding your ${LEAD_LABELS[type].toLowerCase()}.`)}`} target="_blank" rel="noopener" className={btn.secondary}>
                WhatsApp
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}?subject=${encodeURIComponent("Your Span Floors request")}`} className={btn.primary}>
                Email
              </a>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-6">
          <section className="border border-line bg-white/40 p-5">
            <h2 className="mb-4 text-2xs font-semibold tracking-[0.06em] uppercase">Details</h2>
            <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-body">
              <Row k="Phone" v={lead.phone} />
              <Row k="Email" v={lead.email} />
              <Row k="Profession" v={lead.profession && PROFESSIONS[lead.profession]} />
              <Row k="City" v={lead.city} />
              <Row k="Booked for" v={lead.slotStart && <strong className="font-medium">{formatDate(lead.slotStart, true)}</strong>} />
              <Row
                k="Samples"
                v={
                  Array.isArray(d.products) && (
                    <ul className="grid gap-1">
                      {(d.products as { id: string; name: string; url: string }[]).map((p) => (
                        <li key={p.id}>
                          <a href={p.url} target="_blank" className="underline underline-offset-2">
                            {p.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )
                }
              />
              <Row k="Delivery address" v={d.address ? `${d.address}\n${d.pincode ?? ""}` : null} />
              <Row k="Company" v={d.company as string} />
              <Row k="GSTIN" v={d.gstin as string} />
              <Row k="Years in business" v={d.yearsInBusiness as number} />
              <Row k="Download" v={d.downloadId as string} />
              <Row k="Campaign" v={d.campaign as string} />
              <Row k="Message" v={lead.message} />
            </dl>
          </section>

          <section className="border border-line bg-white/40 p-5">
            <h2 className="mb-4 text-2xs font-semibold tracking-[0.06em] uppercase">Notes &amp; history</h2>
            <ol className="mb-4 grid gap-3">
              <li className="text-2xs text-muted">{formatDate(lead.createdAt, true)} · Submitted from {lead.sourcePath ?? "the website"}</li>
              {notes.map((n, i) => (
                <li key={i} className="border-l-2 border-line pl-3">
                  <div className="text-2xs text-muted">
                    {n.name ?? "System"} · {formatDate(n.createdAt, true)}
                  </div>
                  <div className="mt-0.5 text-body whitespace-pre-line">{n.body}</div>
                </li>
              ))}
            </ol>
            <form action={addLeadNote} className="grid gap-2">
              <input type="hidden" name="id" value={lead.id} />
              <textarea name="body" required rows={3} placeholder="Add a note (call outcome, follow-up date…)" className={`${inputCls} h-auto py-2`} />
              <button className={`${btn.secondary} w-fit`}>Add note</button>
            </form>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <form action={updateLead} className="grid gap-3 border border-line bg-white/40 p-4">
            <input type="hidden" name="id" value={lead.id} />
            <h2 className="text-2xs font-semibold tracking-[0.06em] uppercase">Manage</h2>
            <label className="grid gap-1.5 text-2xs font-medium">
              Status
              <select name="status" defaultValue={lead.status} className={inputCls}>
                {["new", "contacted", "converted", "closed", "cancelled", "spam"].map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-2xs font-medium">
              Assigned to
              <select name="assignedTo" defaultValue={lead.assignedTo ?? ""} className={inputCls}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <button className={btn.primary}>Save</button>
            {lead.slotStart && <p className="text-2xs text-muted">Setting a booking to Cancelled or Closed frees its time slot.</p>}
          </form>

          <section className="border border-line bg-white/40 p-4 text-2xs">
            <h2 className="mb-2 font-semibold tracking-[0.06em] uppercase">Twenty CRM</h2>
            {lead.twentyStatus === "sent" ? (
              <p className="text-[#2f6339]">
                ✓ In Twenty as a Current Lead
                {lead.twentySyncedAt && <span className="text-muted"> · {formatDate(lead.twentySyncedAt, true)}</span>}
              </p>
            ) : (
              <>
                <p className={lead.twentyStatus === "failed" ? "text-brand" : "text-muted"}>
                  {lead.twentyStatus === "failed"
                    ? `Not sent yet — Twenty returned an error (${lead.twentyAttempts} attempt${lead.twentyAttempts === 1 ? "" : "s"}). It’s saved here and keeps retrying automatically.`
                    : lead.twentyStatus === "off"
                      ? "Sending to Twenty is switched off (Integrations). Saved here; it will be sent once switched on."
                      : "Waiting to be sent."}
                </p>
                {lead.twentyError && <p className="mt-1 font-mono break-all text-muted">{lead.twentyError}</p>}
                <form action={retryTwenty} className="mt-2">
                  <input type="hidden" name="id" value={lead.id} />
                  <button className={btn.secondary}>Retry now</button>
                </form>
              </>
            )}
          </section>

          <section className="border border-line bg-white/40 p-4 text-2xs">
            <h2 className="mb-3 font-semibold tracking-[0.06em] uppercase">Source</h2>
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5">
              <Row k="Page" v={lead.sourcePath} />
              <Row k="Referrer" v={lead.referrer} />
              {Object.entries(utm).map(([k, v]) => (
                <Row key={k} k={k} v={v} />
              ))}
              <Row k="Team email" v={lead.emailedAt ? `Sent ${formatDate(lead.emailedAt, true)}` : "Not sent (set SMTP + recipients)"} />
              <Row k="WhatsApp" v={whatsappDefault ? `Company number +${whatsappDefault}` : null} />
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
