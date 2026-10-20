import { currentUser } from "@/server/auth";
import { LEAD_LABELS, type LeadType } from "@/server/forms";
import { leadRows, leadWhere } from "../query";

/** CSV export of the current inbox filters (signed-in users only). */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await leadRows(leadWhere({ ...sp, assigned: sp.assigned === "me" ? user.id : sp.assigned }), 20000);

  // Prefix cells that start with = + - @ so spreadsheets don't treat them as formulas.
  const cell = (v: unknown) => {
    let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["Received", "Type", "Status", "Name", "Phone", "Email", "Profession", "City", "Booked for", "Products", "Company", "Message", "Page", "UTM source", "UTM campaign", "Assigned"];
  const lines = rows.map((r) => {
    const d = r.data as Record<string, unknown>;
    const u = r.utm as Record<string, string>;
    return [
      r.createdAt.toISOString(),
      LEAD_LABELS[r.type as LeadType],
      r.status,
      r.name,
      r.phone,
      r.email,
      r.profession,
      r.city,
      r.slotStart?.toISOString(),
      Array.isArray(d.products) ? (d.products as { name: string }[]).map((p) => p.name).join("; ") : "",
      d.company,
      r.message,
      r.sourcePath,
      u.utm_source,
      u.utm_campaign,
      r.assignee,
    ]
      .map(cell)
      .join(",");
  });
  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="span-floors-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
