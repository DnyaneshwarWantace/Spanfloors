"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { logActivity, requireUser } from "@/server/auth";
import { pushLead, retryPendingLeads } from "@/server/twenty-leads";

const STATUSES = ["new", "contacted", "converted", "closed", "cancelled", "spam"] as const;

export async function updateLead(form: FormData) {
  const user = await requireUser();
  const id = z.uuid().parse(form.get("id"));
  const status = form.get("status");
  const assignedTo = form.get("assignedTo");
  const set: Partial<typeof schema.leads.$inferInsert> = { updatedAt: new Date() };
  if (typeof status === "string" && (STATUSES as readonly string[]).includes(status)) set.status = status as (typeof STATUSES)[number];
  if (typeof assignedTo === "string") set.assignedTo = assignedTo ? z.uuid().parse(assignedTo) : null;
  const [before] = await db.select({ status: schema.leads.status, name: schema.leads.name }).from(schema.leads).where(eq(schema.leads.id, id));
  if (!before) return;
  await db.update(schema.leads).set(set).where(eq(schema.leads.id, id));
  if (set.status && set.status !== before.status) {
    await db.insert(schema.leadNotes).values({ leadId: id, userId: user.id, body: `Status changed: ${before.status} → ${set.status}` });
  }
  await logActivity(user.id, "update", "lead", id, `Updated lead ${before.name}${set.status ? ` (${set.status})` : ""}`);
  revalidatePath(`/admin/leads/${id}/`);
  revalidatePath("/admin/leads/");
}

export async function addLeadNote(form: FormData) {
  const user = await requireUser();
  const id = z.uuid().parse(form.get("id"));
  const body = z.string().trim().min(1).max(4000).safeParse(form.get("body"));
  if (!body.success) return;
  await db.insert(schema.leadNotes).values({ leadId: id, userId: user.id, body: body.data });
  await db.update(schema.leads).set({ updatedAt: new Date() }).where(eq(schema.leads.id, id));
  revalidatePath(`/admin/leads/${id}/`);
}

/** Sends one lead (or all waiting leads) to Twenty now. */
export async function retryTwenty(form: FormData) {
  const user = await requireUser();
  const id = form.get("id");
  if (typeof id === "string" && id) {
    await pushLead(z.uuid().parse(id));
    revalidatePath(`/admin/leads/${id}/`);
  } else {
    const r = await retryPendingLeads(100);
    await logActivity(user.id, "sync", "lead", null, `Retried sending leads to Twenty: ${r.sent} of ${r.tried} sent`);
  }
  revalidatePath("/admin/leads/");
  revalidatePath("/admin/");
}
