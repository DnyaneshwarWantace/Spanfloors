import "server-only";
import { and, desc, eq, gte, ilike, isNull, lte, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";

export type LeadFilters = { type?: string; status?: string; q?: string; assigned?: string; from?: string; to?: string };

const TYPES = ["enquiry", "sample", "download", "dealer", "video_call", "visit", "landing"];
const STATUSES = ["new", "contacted", "converted", "closed", "cancelled", "spam"];

export function leadWhere(f: LeadFilters) {
  const w: SQL[] = [];
  if (f.type && TYPES.includes(f.type)) w.push(eq(schema.leads.type, f.type as (typeof schema.leads.type.enumValues)[number]));
  if (f.status && STATUSES.includes(f.status)) w.push(eq(schema.leads.status, f.status as (typeof schema.leads.status.enumValues)[number]));
  else if (!f.status) w.push(or(...STATUSES.filter((s) => s !== "spam").map((s) => eq(schema.leads.status, s as "new")))!);
  if (f.assigned === "me" || /^[0-9a-f-]{36}$/.test(f.assigned ?? "")) w.push(eq(schema.leads.assignedTo, f.assigned!));
  if (f.assigned === "none") w.push(isNull(schema.leads.assignedTo));
  if (f.q) {
    const q = `%${f.q.trim()}%`;
    w.push(or(ilike(schema.leads.name, q), ilike(schema.leads.email, q), ilike(schema.leads.phone, q), ilike(schema.leads.city, q), ilike(schema.leads.message, q))!);
  }
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) w.push(gte(schema.leads.createdAt, new Date(`${f.from}T00:00:00+05:30`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) w.push(lte(schema.leads.createdAt, new Date(`${f.to}T23:59:59+05:30`)));
  return w.length ? and(...w) : undefined;
}

export function leadRows(where: SQL | undefined, limit: number, offset = 0) {
  return db
    .select({
      id: schema.leads.id,
      type: schema.leads.type,
      status: schema.leads.status,
      name: schema.leads.name,
      email: schema.leads.email,
      phone: schema.leads.phone,
      profession: schema.leads.profession,
      city: schema.leads.city,
      message: schema.leads.message,
      data: schema.leads.data,
      slotStart: schema.leads.slotStart,
      sourcePath: schema.leads.sourcePath,
      utm: schema.leads.utm,
      createdAt: schema.leads.createdAt,
      assignee: schema.users.name,
      twentyStatus: schema.leads.twentyStatus,
    })
    .from(schema.leads)
    .leftJoin(schema.users, eq(schema.users.id, schema.leads.assignedTo))
    .where(where)
    .orderBy(desc(schema.leads.createdAt))
    .limit(limit)
    .offset(offset);
}
