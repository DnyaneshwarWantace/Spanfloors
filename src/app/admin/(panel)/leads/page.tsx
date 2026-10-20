import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { LEAD_LABELS, type LeadType } from "@/server/forms";
import { Badge, btn, EmptyState, formatDate, inputCls, PageHeader } from "@/components/admin/ui";
import { leadRows, leadWhere } from "./query";
import { retryTwenty } from "./actions";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
const PER_PAGE = 40;

const STATUS_TONE: Record<string, string> = { new: "scheduled", contacted: "draft", converted: "published", closed: "archived", cancelled: "archived", spam: "archived" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const filters = { ...sp, assigned: sp.assigned === "me" ? me.id : sp.assigned };
  const page = Math.max(Number(sp.page) || 1, 1);
  const where = leadWhere(filters);

  const [rows, [{ n: total }], byType, users, [{ n: newCount }], [{ n: waiting }]] = await Promise.all([
    leadRows(where, PER_PAGE, (page - 1) * PER_PAGE),
    db.select({ n: count() }).from(schema.leads).where(where),
    db
      .select({ type: schema.leads.type, n: count() })
      .from(schema.leads)
      .where(sql`${schema.leads.status} <> 'spam'`)
      .groupBy(schema.leads.type),
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.active, true)),
    db.select({ n: count() }).from(schema.leads).where(eq(schema.leads.status, "new")),
    db.select({ n: count() }).from(schema.leads).where(inArray(schema.leads.twentyStatus, ["pending", "failed", "off"])),
  ]);

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...over }).filter((e): e is [string, string] => Boolean(e[1])));
    return `?${p}`;
  };
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${newCount} new · every enquiry, sample request, booking and application from the website.`}
        actions={
          <a href={`/admin/leads/export/${qs({ page: undefined })}`} className={btn.secondary}>
            Export CSV
          </a>
        }
      />

      {waiting > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#a0661f]/40 bg-[#a0661f]/8 px-4 py-3 text-2xs">
          <span>
            <strong className="font-medium">{waiting} lead{waiting === 1 ? "" : "s"} not in Twenty yet.</strong> They’re saved here and retry automatically every few minutes.
          </span>
          <form action={retryTwenty}>
            <button className={btn.secondary}>Retry all now</button>
          </form>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 border-b border-line">
        <Link href={qs({ type: undefined, page: undefined })} aria-current={!sp.type ? "page" : undefined} className="-mb-px border-b-2 border-transparent pb-2 text-2xs text-muted aria-[current=page]:border-ink aria-[current=page]:text-ink">
          All
        </Link>
        {(Object.keys(LEAD_LABELS) as LeadType[]).map((t) => (
          <Link
            key={t}
            href={qs({ type: t, page: undefined })}
            aria-current={sp.type === t ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent pb-2 text-2xs text-muted hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
          >
            {LEAD_LABELS[t]} <span className="tabular-nums">({byType.find((b) => b.type === t)?.n ?? 0})</span>
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2 text-2xs">
        {sp.type && <input type="hidden" name="type" value={sp.type} />}
        <input name="q" defaultValue={sp.q} placeholder="Search name, email, phone, city…" className={`${inputCls} h-9 w-64 text-2xs`} aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className={`${inputCls} h-9 w-auto text-2xs`} aria-label="Status">
          <option value="">All statuses (except spam)</option>
          {["new", "contacted", "converted", "closed", "cancelled", "spam"].map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <select name="assigned" defaultValue={sp.assigned ?? ""} className={`${inputCls} h-9 w-auto text-2xs`} aria-label="Assigned to">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <label className="grid gap-1">
          From
          <input type="date" name="from" defaultValue={sp.from} className={`${inputCls} h-9 w-auto text-2xs`} />
        </label>
        <label className="grid gap-1">
          To
          <input type="date" name="to" defaultValue={sp.to} className={`${inputCls} h-9 w-auto text-2xs`} />
        </label>
        <button className={`${btn.secondary} h-9`}>Filter</button>
        <Link href="/admin/leads/" className={btn.ghost}>
          Reset
        </Link>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No leads match these filters.">New website enquiries appear here as soon as they’re submitted.</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[60rem] text-left text-2xs">
            <thead className="bg-paper-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Received</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Details</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Assigned</th>
                <th className="px-4 py-2.5 font-medium">Twenty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = r.data as Record<string, unknown>;
                const detail = r.slotStart
                  ? `Booked ${formatDate(r.slotStart, true)}`
                  : Array.isArray(d.products)
                    ? `${(d.products as unknown[]).length} sample${(d.products as unknown[]).length > 1 ? "s" : ""}`
                    : (d.company as string) || r.message?.slice(0, 70) || "—";
                return (
                  <tr key={r.id} className={`border-t border-line hover:bg-paper-2/50 ${r.status === "new" ? "font-medium" : ""}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(r.createdAt, true)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/leads/${r.id}/`} className="text-body hover:underline">
                        {r.name}
                      </Link>
                      <div className="font-normal text-muted">{[r.phone, r.email, r.city].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3">{LEAD_LABELS[r.type as LeadType]}</td>
                    <td className="max-w-72 truncate px-4 py-3 font-normal text-muted">{detail}</td>
                    <td className="px-4 py-3">
                      <Badge value={STATUS_TONE[r.status]} label={r.status} />
                    </td>
                    <td className="px-4 py-3 font-normal text-muted">{r.assignee ?? "—"}</td>
                    <td className="px-4 py-3 font-normal">
                      {r.twentyStatus === "sent" ? <span className="text-[#2f6339]">✓ Sent</span> : r.twentyStatus === "failed" ? <span className="text-brand">✕ Retrying</span> : <span className="text-muted">Waiting</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-2xs">
          <span className="text-muted">
            Page {page} of {pages} · {total} leads
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qs({ page: String(page - 1) })} className={btn.secondary}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={qs({ page: String(page + 1) })} className={btn.secondary}>
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
