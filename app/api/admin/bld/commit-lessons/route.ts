import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { venueName } from "@/lib/venues";
import { isYmd } from "@/lib/time";
import {
    BLD_USER_ID,
    DEFAULT_TIME_ZONE,
    eventTimesForPage,
    getLessonsDb,
    isId,
    isMyEventType,
    lessonForPage,
    myEventTypeIds,
    recordTaught,
    type StoredEvent,
} from "@/lib/lessons";

// GET /api/admin/bld/commit-lessons?from=YYYY-MM-DD&to=YYYY-MM-DD
// Stephen's events in range that have at least one lesson not yet marked taught
export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";

    if (!isYmd(from) || !isYmd(to)) {
        return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
    }

    const db = await getLessonsDb();
    const events = await db.collection<StoredEvent & { _id: string }>("events").find({
        eventTypeId: { $in: await myEventTypeIds(db) },
        date: { $gte: from, $lte: to },
        isCancelled: { $ne: true },
        "lessons.committed": false,
    }).sort({ date: 1, startAt: 1 }).toArray();

    if (events.length === 0) return NextResponse.json([]);

    const etIds = [...new Set(events.map((e) => e.eventTypeId).filter(Boolean))] as string[];
    const etDocs = await db.collection<{ _id: string; title?: string; level?: string }>("event_types").find({ _id: { $in: etIds } }).toArray();
    const etMap = Object.fromEntries(etDocs.map((e) => [String(e._id), e]));

    return NextResponse.json(events.map((ev) => {
        const et = etMap[ev.eventTypeId ?? ""] ?? null;
        const times = eventTimesForPage(ev);
        const tz = ev.timeZone || DEFAULT_TIME_ZONE;
        return {
            _id: String(ev._id),
            eventTypeId: ev.eventTypeId ?? "",
            date: ev.date ?? "",
            startTime: times.startTime,
            endTime: times.endTime,
            lessons: (ev.lessons ?? []).map((l) => lessonForPage(l, tz)),
            eventType: et ? { _id: String(et._id), title: et.title ?? "", level: et.level ?? "" } : null,
        };
    }));
}

// POST /api/admin/bld/commit-lessons
// Body: { eventId: string } — marks every lesson of that event taught and writes their history
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const eventId = String(body.eventId ?? "").trim();
        if (!isId(eventId)) return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });

        const db = await getLessonsDb();
        const ev = await db.collection<StoredEvent & { _id: string }>("events").findOne({ _id: eventId });
        if (!ev || !ev.eventTypeId || !(await isMyEventType(db, ev.eventTypeId))) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const existing = ev.lessons ?? [];
        const newlyTaught = existing.filter((l) => !l.committed && !l.skipped && (l.dance || l.danceId)).map((l) => ({ ...l, committed: true }));
        const lessons = existing.map((l) => (l.skipped ? l : { ...l, committed: true }));

        if (newlyTaught.length > 0) {
            const et = await db.collection<{ _id: string; venueId?: string }>("event_types").findOne({ _id: ev.eventTypeId });
            const venueId = et?.venueId ? String(et.venueId) : null;
            await recordTaught(db, ev, newlyTaught, venueId, venueId ? await venueName(venueId) : "Unknown venue");
        }

        const now = new Date();
        await db.collection<{ _id: string; [key: string]: unknown }>("events").updateOne(
            { _id: eventId },
            { $set: { lessons, updatedAt: now, verifiedAt: now, verifiedBy: BLD_USER_ID } },
        );

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
