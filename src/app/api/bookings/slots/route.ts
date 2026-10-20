import { availableSlots, type BookingType } from "@/server/bookings";

/** Free booking slots: GET /api/bookings/slots?type=video_call|visit&days=14 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  if (type !== "video_call" && type !== "visit") return Response.json({ error: "type must be video_call or visit" }, { status: 400 });
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 14, 1), 60);
  return Response.json(await availableSlots(type as BookingType, { days }), { headers: { "Cache-Control": "no-store" } });
}
