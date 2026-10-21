import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isYmd, parseTime12ToMinutes } from "@/lib/time";
import { BLD_USER_ID, eventInstants, getLessonsDb, isId, isMyEventType, lessonsFromPage, newId, venueTimeZone, type StoredEvent } from "@/lib/lessons";

function clean(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}

// POST: create or update the stored event for an event type on a date (one per date, as the site and the
// instructor dashboard match them).
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));

        const eventTypeId = String(body.eventTypeId ?? "").trim();
        const date = String(body.date ?? "").trim();
        const startTime = String(body.startTime ?? "").trim();
        const endTime = String(body.endTime ?? "").trim();
        const isCancelled = !!body.isCancelled;
        const cancelNote = clean(body.cancelNote);
        const substitute = clean(body.substitute);
        const specialNote = clean(body.specialNote);

        if (!isId(eventTypeId)) return NextResponse.json({ error: "Invalid eventTypeId" }, { status: 400 });
        if (!isYmd(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });

        const startM = parseTime12ToMinutes(startTime);
        const endM = parseTime12ToMinutes(endTime);
        if (startM === null) return NextResponse.json({ error: "startTime must be like '6:30 PM'" }, { status: 400 });
        if (endM === null) return NextResponse.json({ error: "endTime must be like '8:00 PM'" }, { status: 400 });
        if (endM <= startM) return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });

        const db = await getLessonsDb();
        if (!(await isMyEventType(db, eventTypeId))) return NextResponse.json({ error: "Event type not found" }, { status: 404 });
        const et = await db.collection<{ _id: string; venueId?: string }>("event_types").findOne({ _id: eventTypeId });
        if (!et) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

        const timeZone = await venueTimeZone(et.venueId);
        const times = eventInstants(date, startTime, endTime, timeZone)!;
        const events = db.collection<StoredEvent & { _id: string }>("events");
        const existing = await events.findOne({ eventTypeId, date });
        const lessons = lessonsFromPage(body.lessons, { date, ...times, timeZone }, existing?.lessons ?? []).map((l) => ({ ...l, committed: false }));
        const now = new Date();

        const res = await events.updateOne(
            { eventTypeId, date },
            {
                $setOnInsert: { _id: newId(), eventTypeId, date, substituteInstructorId: null, createdAt: now },
                $set: {
                    ...times, timeZone, isCancelled, cancelNote, substitute, specialNote, lessons,
                    updatedAt: now, verifiedAt: now, verifiedBy: BLD_USER_ID,
                },
            },
            { upsert: true },
        );

        const doc = await events.findOne({ eventTypeId, date }, { projection: { _id: 1 } });
        if (!doc) return NextResponse.json({ error: "Failed to resolve eventId" }, { status: 500 });
        return NextResponse.json({ ok: true, eventId: String(doc._id), created: !!res.upsertedId });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
