import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isYmd, parseTime12ToMinutes } from "@/lib/time";
import { BLD_USER_ID, eventInstants, getLessonsDb, isId, isMyEventType, newId, venueTimeZone } from "@/lib/lessons";

// POST: an extra date for one of Stephen's event types, outside its frequencies.
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));

        const eventTypeId = typeof body.eventTypeId === "string" ? body.eventTypeId.trim() : "";
        const date = typeof body.date === "string" ? body.date.trim() : "";
        const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
        const endTime = typeof body.endTime === "string" ? body.endTime.trim() : "";
        const endDayOffset: 0 | 1 = body.endDayOffset === 1 ? 1 : 0;

        if (!isId(eventTypeId)) return NextResponse.json({ error: "Invalid eventTypeId" }, { status: 400 });
        if (!isYmd(date)) return NextResponse.json({ error: "Invalid date (YYYY-MM-DD)" }, { status: 400 });

        const startM = parseTime12ToMinutes(startTime);
        const endM = parseTime12ToMinutes(endTime);
        if (startM === null) return NextResponse.json({ error: "Invalid startTime (e.g. 6:30 PM)" }, { status: 400 });
        if (endM === null) return NextResponse.json({ error: "Invalid endTime (e.g. 8:00 PM)" }, { status: 400 });
        if (endDayOffset === 0 && endM <= startM) return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });

        const db = await getLessonsDb();
        if (!(await isMyEventType(db, eventTypeId))) return NextResponse.json({ error: "Event type not found" }, { status: 404 });
        const et = await db.collection<{ _id: string; venueId?: string }>("event_types").findOne({ _id: eventTypeId });
        if (!et) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

        const timeZone = await venueTimeZone(et.venueId);
        const times = eventInstants(date, startTime, endTime, timeZone, endDayOffset)!;
        const now = new Date();
        const _id = newId();

        await db.collection<{ _id: string; [key: string]: unknown }>("events").insertOne({
            _id,
            eventTypeId,
            date,
            ...times,
            timeZone,
            isCancelled: false,
            cancelNote: null,
            substitute: null,
            substituteInstructorId: null,
            specialNote: null,
            lessons: [],
            verifiedAt: now,
            verifiedBy: BLD_USER_ID,
            createdAt: now,
            updatedAt: now,
        });

        return NextResponse.json({ ok: true, eventId: _id });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
