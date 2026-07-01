import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

type DOW = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
const DOW_INDEX: Record<DOW, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function ymd(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseTime12h(time: string): { h: number; m: number } {
    const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) throw new Error(`Invalid time: ${time}`);
    let h = Number(match[1]);
    const m = Number(match[2]);
    const ampm = match[3].toUpperCase();
    if (h === 12) h = 0;
    if (ampm === "PM") h += 12;
    return { h, m };
}

function addMinutes(startTime: string, minutes: number): string {
    const { h, m } = parseTime12h(startTime);
    const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
    const eh = Math.floor(total / 60);
    const em = total % 60;
    const ampm = eh >= 12 ? "PM" : "AM";
    const h12 = eh % 12 || 12;
    return `${h12}:${String(em).padStart(2, "0")} ${ampm}`;
}

function* eachDay(start: Date, end: Date) {
    const d = new Date(start); d.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(0, 0, 0, 0);
    while (d <= e) { yield new Date(d); d.setDate(d.getDate() + 1); }
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
    const first = new Date(year, month, 1);
    const delta = (weekday - first.getDay() + 7) % 7;
    const day = 1 + delta + (nth - 1) * 7;
    const candidate = new Date(year, month, day);
    return candidate.getMonth() === month ? candidate : null;
}

function clampRange(rangeStart: Date, rangeEnd: Date, fStart?: string, fEnd?: string | null) {
    const a = new Date(rangeStart);
    const b = new Date(rangeEnd);
    if (fStart) { const fs = new Date(fStart + "T00:00:00"); if (fs > a) a.setTime(fs.getTime()); }
    if (fEnd) { const fe = new Date(fEnd + "T23:59:59"); if (fe < b) b.setTime(fe.getTime()); }
    return { start: a, end: b };
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const from = typeof body.from === "string" ? body.from.trim() : "";
        const to = typeof body.to === "string" ? body.to.trim() : "";

        if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return NextResponse.json({ error: "from must be YYYY-MM-DD" }, { status: 400 });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: "to must be YYYY-MM-DD" }, { status: 400 });

        const rangeStart = new Date(from + "T00:00:00");
        const rangeEnd = new Date(to + "T00:00:00");
        if (rangeStart > rangeEnd) return NextResponse.json({ error: "`from` must be on or before `to`" }, { status: 400 });

        const db = await getBldDb();

        const [freqs, activeEtDocs] = await Promise.all([
            db.collection("frequencies").find({ isActive: true }).toArray(),
            db.collection("event_types").find({ isActive: true }, { projection: { _id: 1 } }).toArray(),
        ]);

        const activeEtIds = new Set(activeEtDocs.map((d) => String(d._id)));

        const ops: object[] = [];

        for (const f of freqs) {
            if (!activeEtIds.has(String(f.eventTypeId))) continue;

            const { start, end } = clampRange(rangeStart, rangeEnd, f.startDate, f.endDate ?? null);
            if (start > end) continue;

            const endTime = addMinutes(f.startTime, f.durationMinutes);
            const etId = f.eventTypeId instanceof ObjectId ? f.eventTypeId : new ObjectId(String(f.eventTypeId));
            const base = { eventTypeId: etId, startTime: f.startTime, endTime, isCancelled: false, cancelNote: null, substitute: null };

            if (f.kind === "WEEKLY") {
                const wanted = new Set((f.byDay as DOW[] ?? []).map((d) => DOW_INDEX[d]));
                for (const d of eachDay(start, end)) {
                    if (!wanted.has(d.getDay())) continue;
                    const date = ymd(d);
                    ops.push({ updateOne: { filter: { eventTypeId: etId, date, startTime: f.startTime }, update: { $setOnInsert: { ...base, date } }, upsert: true } });
                }
            }

            if (f.kind === "MONTHLY_NTH_WEEKDAY") {
                const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
                const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
                while (cursor <= endMonth) {
                    const target = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), DOW_INDEX[f.weekday as DOW], f.nth);
                    if (target && target >= start && target <= end) {
                        const date = ymd(target);
                        ops.push({ updateOne: { filter: { eventTypeId: etId, date, startTime: f.startTime }, update: { $setOnInsert: { ...base, date } }, upsert: true } });
                    }
                    cursor.setMonth(cursor.getMonth() + 1);
                }
            }

            if (f.kind === "ONE_TIME" && f.startDate) {
                const target = new Date(f.startDate + "T00:00:00");
                if (target >= start && target <= end) {
                    const date = ymd(target);
                    ops.push({ updateOne: { filter: { eventTypeId: etId, date, startTime: f.startTime }, update: { $setOnInsert: { ...base, date } }, upsert: true } });
                }
            }
        }

        if (ops.length === 0) {
            return NextResponse.json({ ok: true, upserted: 0, matched: 0, ops: 0, note: "No active frequencies produced events in that range." });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await db.collection("events").bulkWrite(ops as any[], { ordered: false });

        return NextResponse.json({
            ok: true,
            upserted: result.upsertedCount,
            matched: result.matchedCount,
            ops: ops.length,
            note: result.upsertedCount > 0
                ? `Created ${result.upsertedCount} new event${result.upsertedCount !== 1 ? "s" : ""}.`
                : `All ${result.matchedCount} events already existed — nothing changed.`,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
