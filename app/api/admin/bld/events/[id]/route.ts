import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getVenue, venueName } from "@/lib/venues";
import {
    BLD_USER_ID,
    DEFAULT_TIME_ZONE,
    eventInstants,
    eventTimesForPage,
    getLessonsDb,
    isId,
    isMyEventType,
    lessonForPage,
    lessonsFromPage,
    recordTaught,
    type StoredEvent,
} from "@/lib/lessons";

type Ctx = { params: Promise<{ id: string }> };

function clean(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}

async function loadMine(id: string) {
    const db = await getLessonsDb();
    const ev = await db.collection<StoredEvent & { _id: string }>("events").findOne({ _id: id });
    if (!ev || !ev.eventTypeId || !(await isMyEventType(db, ev.eventTypeId))) return { db, ev: null };
    return { db, ev };
}

export async function GET(_req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { db, ev } = await loadMine(id);
    if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const et = await db.collection<{ _id: string; title?: string; level?: string; price?: string; venueId?: string }>("event_types").findOne({ _id: ev.eventTypeId! });
    const venue = et?.venueId ? await getVenue(et.venueId) : null;
    const tz = ev.timeZone || DEFAULT_TIME_ZONE;

    return NextResponse.json({
        _id: String(ev._id),
        eventTypeId: ev.eventTypeId ?? "",
        date: ev.date ?? "",
        ...eventTimesForPage(ev),
        isCancelled: !!ev.isCancelled,
        cancelNote: ev.cancelNote ?? null,
        substitute: ev.substitute ?? null,
        specialNote: ev.specialNote ?? null,
        lessons: (ev.lessons ?? []).map((l) => lessonForPage(l, tz)),
        eventType: et ? { _id: String(et._id), title: et.title ?? "", level: et.level ?? "", price: et.price ?? "" } : null,
        venue,
    });
}

export async function PATCH(req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    try {
        const body = await req.json().catch(() => ({}));
        const { db, ev } = await loadMine(id);
        if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const now = new Date();
        // Planning or editing an event is the instructor's activity, so it's validated (decision 17).
        const patch: Record<string, unknown> = { updatedAt: now, verifiedAt: now, verifiedBy: BLD_USER_ID };
        const tz = ev.timeZone || DEFAULT_TIME_ZONE;

        let times = { startAt: ev.startAt, endAt: ev.endAt };
        if (typeof body.startTime === "string" || typeof body.endTime === "string") {
            const current = eventTimesForPage(ev);
            const next = eventInstants(ev.date, body.startTime ?? current.startTime, body.endTime ?? current.endTime, tz, body.endDayOffset);
            if (!next) return NextResponse.json({ error: "Times must be like '6:30 PM'" }, { status: 400 });
            times = next;
            Object.assign(patch, next);
        }
        if (typeof body.isCancelled === "boolean") patch.isCancelled = body.isCancelled;
        if (body.cancelNote === null || typeof body.cancelNote === "string") patch.cancelNote = clean(body.cancelNote);
        if (body.substitute === null || typeof body.substitute === "string") patch.substitute = clean(body.substitute);
        if (body.specialNote === null || typeof body.specialNote === "string") patch.specialNote = clean(body.specialNote);

        if (body.lessons !== undefined) {
            const lessons = lessonsFromPage(body.lessons, { date: ev.date, ...times, timeZone: tz }, ev.lessons ?? []);
            patch.lessons = lessons;

            // History for lessons newly marked taught (keyed on the lesson id, so re-saving never duplicates)
            const before = new Map((ev.lessons ?? []).map((l) => [l._id, l.committed]));
            const newlyTaught = lessons.filter((l) => l.committed && !before.get(l._id));
            if (newlyTaught.length) {
                const et = await db.collection<{ _id: string; venueId?: string }>("event_types").findOne({ _id: ev.eventTypeId! });
                const venueId = et?.venueId ? String(et.venueId) : null;
                await recordTaught(db, { ...ev, ...times }, newlyTaught, venueId, venueId ? await venueName(venueId) : "Unknown venue");
            }
        }

        const res = await db.collection<{ _id: string; [key: string]: unknown }>("events").updateOne({ _id: id }, { $set: patch });
        if (res.matchedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
