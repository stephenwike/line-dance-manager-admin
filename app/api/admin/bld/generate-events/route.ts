import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLessonsDb, myEventTypeIds, newId, venueTimeZone, wallToUtc, parseTimeToMinutes } from "@/lib/lessons";

type DOW = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
const DOW_INDEX: Record<DOW, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function ymd(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function* eachDay(start: Date, end: Date) {
    const d = new Date(start); d.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(0, 0, 0, 0);
    while (d <= e) { yield new Date(d); d.setDate(d.getDate() + 1); }
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
    const first = new Date(year, month, 1);
    const delta = (weekday - first.getDay() + 7) % 7;
    const candidate = new Date(year, month, 1 + delta + (nth - 1) * 7);
    return candidate.getMonth() === month ? candidate : null;
}

function clampRange(rangeStart: Date, rangeEnd: Date, fStart?: string, fEnd?: string | null) {
    const a = new Date(rangeStart);
    const b = new Date(rangeEnd);
    if (fStart) { const fs = new Date(fStart + "T00:00:00"); if (fs > a) a.setTime(fs.getTime()); }
    if (fEnd) { const fe = new Date(fEnd + "T23:59:59"); if (fe < b) b.setTime(fe.getTime()); }
    return { start: a, end: b };
}

// POST: store the dates Stephen's running frequencies produce in a range, so they can carry a plan.
// Existing stored events are left alone (one per event type and date).
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

        const db = await getLessonsDb();
        const mine = await myEventTypeIds(db);

        const [freqs, activeEtDocs] = await Promise.all([
            db.collection("frequencies").find({ eventTypeId: { $in: mine }, isActive: { $ne: false } }).toArray(),
            db.collection("event_types").find({ _id: { $in: mine }, isActive: { $ne: false } } as never, { projection: { _id: 1, venueId: 1 } }).toArray(),
        ]);
        const venueByEt = new Map(activeEtDocs.map((d) => [String(d._id), d.venueId]));
        const tzByEt = new Map<string, string>();
        for (const [etId, venueId] of venueByEt) tzByEt.set(etId, await venueTimeZone(venueId));

        const ops: object[] = [];
        const now = new Date();

        for (const f of freqs) {
            const etId = String(f.eventTypeId);
            if (!venueByEt.has(etId)) continue;
            const startMin = parseTimeToMinutes(f.startTime);
            if (startMin === null) continue;
            const tz = tzByEt.get(etId)!;

            const { start, end } = clampRange(rangeStart, rangeEnd, f.startDate, f.endDate ?? null);
            if (start > end) continue;

            const add = (date: string) => ops.push({
                updateOne: {
                    filter: { eventTypeId: etId, date },
                    update: {
                        $setOnInsert: {
                            _id: newId(), eventTypeId: etId, date,
                            startAt: wallToUtc(date, startMin, tz),
                            endAt: wallToUtc(date, startMin + Number(f.durationMinutes ?? 0), tz),
                            timeZone: tz,
                            isCancelled: false, cancelNote: null, substitute: null, substituteInstructorId: null, specialNote: null,
                            lessons: [], verifiedAt: null, verifiedBy: null, createdAt: now, updatedAt: now,
                        },
                    },
                    upsert: true,
                },
            });

            if (f.kind === "WEEKLY") {
                const wanted = new Set(((f.byDay as DOW[]) ?? []).map((d) => DOW_INDEX[d]));
                for (const d of eachDay(start, end)) if (wanted.has(d.getDay())) add(ymd(d));
            }

            if (f.kind === "MONTHLY_NTH_WEEKDAY") {
                const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
                const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
                while (cursor <= endMonth) {
                    const target = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), DOW_INDEX[f.weekday as DOW], f.nth);
                    if (target && target >= start && target <= end) add(ymd(target));
                    cursor.setMonth(cursor.getMonth() + 1);
                }
            }

            if (f.kind === "ONE_TIME" && f.startDate) {
                const target = new Date(f.startDate + "T00:00:00");
                if (target >= start && target <= end) add(ymd(target));
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
