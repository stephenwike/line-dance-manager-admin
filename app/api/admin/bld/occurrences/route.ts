import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { endTimeFromStartAndDuration } from "@/lib/time";
import { DEFAULT_TIME_ZONE, eventTimesForPage, getLessonsDb, lessonForPage, myEventTypeIds, to12h, type StoredEvent } from "@/lib/lessons";

type DOW = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
const DOW_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function ymd(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function* eachDay(start: Date, end: Date) {
    const d = new Date(start); d.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(0, 0, 0, 0);
    while (d <= e) { yield new Date(d); d.setDate(d.getDate() + 1); }
}

function clampRange(rangeStart: Date, rangeEnd: Date, fStart?: string, fEnd?: string | null) {
    const a = new Date(rangeStart), b = new Date(rangeEnd);
    if (fStart) { const fs = new Date(fStart + "T00:00:00"); if (fs > a) a.setTime(fs.getTime()); }
    if (fEnd) { const fe = new Date(fEnd + "T23:59:59"); if (fe < b) b.setTime(fe.getTime()); }
    return { start: a, end: b };
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
    const first = new Date(year, month, 1);
    const delta = (weekday - first.getDay() + 7) % 7;
    const candidate = new Date(year, month, 1 + delta + (nth - 1) * 7);
    return candidate.getMonth() === month ? candidate : null;
}

type PageLesson = ReturnType<typeof lessonForPage>;

function computeStatus(ev: { isCancelled?: boolean; lessons: PageLesson[] } | undefined): "UNPLANNED" | "PLANNED" | "CANCELLED" {
    if (!ev) return "UNPLANNED";
    if (ev.isCancelled) return "CANCELLED";
    if (ev.lessons.length === 0) return "UNPLANNED";
    if (ev.lessons.some((l) => !String(l?.dance ?? "").trim())) return "UNPLANNED";
    return "PLANNED";
}

// GET ?from&to[&onlyUnplanned=true]: Stephen's dates in a range, projected from running frequencies and
// matched to stored events, with "5:00 PM"-style times for the planning pages.
export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    const onlyUnplanned = searchParams.get("onlyUnplanned") === "true";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return NextResponse.json({ error: "from and to are required (YYYY-MM-DD)" }, { status: 400 });
    }

    const rangeStart = new Date(from + "T00:00:00");
    const rangeEnd = new Date(to + "T00:00:00");

    try {
        const db = await getLessonsDb();
        const mine = await myEventTypeIds(db);

        const [etDocs, freqDocs, eventDocs] = await Promise.all([
            db.collection("event_types").find({ _id: { $in: mine }, isActive: { $ne: false } } as never)
                .project({ title: 1, level: 1, price: 1, venueId: 1 }).toArray(),
            db.collection("frequencies").find({ eventTypeId: { $in: mine }, isActive: { $ne: false } }).toArray(),
            db.collection<StoredEvent & { _id: string }>("events").find({ eventTypeId: { $in: mine }, date: { $gte: from, $lte: to } }).toArray(),
        ]);

        const etById = new Map(etDocs.map((et) => [String(et._id), et]));

        // Stored events by event type and date (one per date)
        const eventByDateKey = new Map<string, StoredEvent & { _id: string }>();
        for (const ev of eventDocs) eventByDateKey.set(`${ev.eventTypeId}|${ev.date}`, ev);

        const occurrences: Array<Record<string, unknown> & { key: string; eventTypeId: string; date: string; startTime: string }> = [];

        for (const f of freqDocs) {
            const etId = String(f.eventTypeId);
            const et = etById.get(etId);
            if (!et) continue;

            const { start, end } = clampRange(rangeStart, rangeEnd, f.startDate, f.endDate ?? null);
            if (start > end) continue;

            const startTime = to12h(f.startTime);
            const makeOcc = (date: string) => ({
                key: `${etId}|${date}|${startTime}`,
                eventTypeId: etId,
                frequencyId: String(f._id),
                date,
                startTime,
                endTime: endTimeFromStartAndDuration(startTime, f.durationMinutes),
                durationMinutes: f.durationMinutes,
                eventType: { _id: etId, title: et.title, level: et.level, price: et.price, venueId: et.venueId ? String(et.venueId) : null },
            });

            if (f.kind === "WEEKLY") {
                const wanted = new Set(((f.byDay as DOW[]) ?? []).map((d) => DOW_INDEX[d]));
                for (const d of eachDay(start, end)) if (wanted.has(d.getDay())) occurrences.push(makeOcc(ymd(d)));
            }

            if (f.kind === "MONTHLY_NTH_WEEKDAY") {
                const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
                const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
                while (cursor <= endMonth) {
                    const target = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), DOW_INDEX[f.weekday as DOW], f.nth);
                    if (target && target >= start && target <= end) occurrences.push(makeOcc(ymd(target)));
                    cursor.setMonth(cursor.getMonth() + 1);
                }
            }

            if (f.kind === "ONE_TIME" && f.startDate) {
                const target = new Date(f.startDate + "T00:00:00");
                if (target >= start && target <= end) occurrences.push(makeOcc(ymd(target)));
            }
        }

        const out = occurrences
            .map((o) => {
                const ev = eventByDateKey.get(`${o.eventTypeId}|${o.date}`);
                const tz = ev?.timeZone || DEFAULT_TIME_ZONE;
                const lessons = (ev?.lessons ?? []).map((l) => lessonForPage(l, tz));
                const times = ev ? eventTimesForPage(ev) : null;
                return {
                    key: o.key,
                    eventTypeId: o.eventTypeId,
                    frequencyId: o.frequencyId as string,
                    date: o.date,
                    startTime: o.startTime,
                    durationMinutes: o.durationMinutes as number,
                    eventType: o.eventType,
                    eventId: ev?._id ?? null,
                    endTime: times?.endTime ?? (o.endTime as string | null),
                    isCancelled: !!ev?.isCancelled,
                    cancelNote: ev?.cancelNote ?? null,
                    substitute: ev?.substitute ?? null,
                    lessons,
                    status: computeStatus(ev ? { isCancelled: ev.isCancelled, lessons } : undefined),
                };
            })
            .filter((x) => (onlyUnplanned ? x.status === "UNPLANNED" : true))
            .sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)));

        return NextResponse.json(out);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
