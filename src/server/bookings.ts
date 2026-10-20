import "server-only";
import { and, gte, inArray, isNotNull, lte, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSetting } from "./settings";

export type BookingType = "video_call" | "visit";

type BookingConfig = {
  timezone: string;
  slotMinutes: number;
  minNoticeHours: number;
  daysAhead: number;
  hours: Record<BookingType, Record<string, string[]>>;
  blockedDates: string[];
};

const DEFAULTS: BookingConfig = {
  timezone: "Asia/Kolkata",
  slotMinutes: 30,
  minNoticeHours: 4,
  daysAhead: 30,
  hours: { video_call: {}, visit: {} },
  blockedDates: [],
};

export async function bookingConfig(): Promise<BookingConfig> {
  try {
    const parsed = JSON.parse((await getSetting("bookings.config")) ?? "{}");
    return { ...DEFAULTS, ...parsed, hours: { ...DEFAULTS.hours, ...(parsed.hours ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

/** UTC instant for a wall-clock time in a timezone (e.g. 2026-10-16 10:30 in Asia/Kolkata). */
function zonedTime(date: string, hhmm: string, tz: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const shown = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
  const utcShown = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (shown.getTime() - utcShown.getTime()));
}

function localDate(d: Date, tz: string) {
  return d.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
}

/** Available slot start times (ISO strings), grouped by local date. */
export async function availableSlots(type: BookingType, opts: { from?: Date; days?: number } = {}) {
  const cfg = await bookingConfig();
  const now = new Date();
  const earliest = new Date(now.getTime() + cfg.minNoticeHours * 3600_000);
  const days = Math.min(opts.days ?? cfg.daysAhead, cfg.daysAhead, 60);
  const start = opts.from && opts.from > now ? opts.from : now;
  const end = new Date(start.getTime() + days * 86400_000);

  const taken = await db
    .select({ slot: schema.leads.slotStart })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.type, type),
        isNotNull(schema.leads.slotStart),
        inArray(schema.leads.status, ["new", "contacted", "converted"]),
        gte(schema.leads.slotStart, start),
        lte(schema.leads.slotStart, end),
      ),
    );
  const takenSet = new Set(taken.map((t) => t.slot!.getTime()));

  const out: Record<string, string[]> = {};
  for (let i = 0; i <= days; i++) {
    const day = new Date(start.getTime() + i * 86400_000);
    const date = localDate(day, cfg.timezone);
    if (cfg.blockedDates.includes(date)) continue;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const range of cfg.hours[type]?.[String(weekday)] ?? []) {
      const [from, to] = range.split("-");
      let t = zonedTime(date, from, cfg.timezone);
      const stop = zonedTime(date, to, cfg.timezone);
      while (t.getTime() + cfg.slotMinutes * 60_000 <= stop.getTime()) {
        if (t >= earliest && !takenSet.has(t.getTime())) (out[date] ??= []).push(t.toISOString());
        t = new Date(t.getTime() + cfg.slotMinutes * 60_000);
      }
    }
  }
  return { timezone: cfg.timezone, slotMinutes: cfg.slotMinutes, days: out };
}

/** True if this exact slot is currently offered (used to validate a submitted booking). */
export async function isSlotAvailable(type: BookingType, slot: Date) {
  const { days } = await availableSlots(type, { from: new Date(slot.getTime() - 86400_000), days: 2 });
  return Object.values(days).some((list) => list.includes(slot.toISOString()));
}
