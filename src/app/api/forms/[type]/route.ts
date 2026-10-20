import { headers } from "next/headers";
import { LEAD_TYPES, submitLead, type LeadType } from "@/server/forms";

/** Public form endpoint used by every website form. Accepts JSON or regular form posts. */
export async function POST(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!(LEAD_TYPES as readonly string[]).includes(type)) return Response.json({ ok: false, error: "Unknown form" }, { status: 404 });
  if (Number(req.headers.get("content-length") ?? 0) > 64 * 1024) return Response.json({ ok: false, error: "Too large" }, { status: 413 });

  let input: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) input = await req.json();
    else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v !== "string") continue;
        if (k === "productIds") ((input.productIds as string[]) ??= []).push(v);
        else input[k] = v;
      }
      if (typeof input.consent === "string") input.consent = input.consent === "on" || input.consent === "true";
    }
  } catch {
    return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const h = await headers();
  const result = await submitLead(type as LeadType, input, {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown",
    userAgent: h.get("user-agent"),
    origin: h.get("origin"),
    referrer: h.get("referer"),
  });
  if (!result.ok) return Response.json(result, { status: result.status });
  return Response.json({ ok: true }, { status: 201 });
}
