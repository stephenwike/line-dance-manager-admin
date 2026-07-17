import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";
import { isYmd, parseTime12ToMinutes } from "@/lib/time";

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

        if (!ObjectId.isValid(eventTypeId))
            return NextResponse.json({ error: "Invalid eventTypeId" }, { status: 400 });
        if (!isYmd(date))
            return NextResponse.json({ error: "Invalid date (YYYY-MM-DD)" }, { status: 400 });

        const startM = parseTime12ToMinutes(startTime);
        const endM = parseTime12ToMinutes(endTime);
        if (startM === null) return NextResponse.json({ error: "Invalid startTime (e.g. 6:30 PM)" }, { status: 400 });
        if (endM === null) return NextResponse.json({ error: "Invalid endTime (e.g. 8:00 PM)" }, { status: 400 });
        if (endDayOffset === 0 && endM <= startM)
            return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });

        const durationMinutes = endDayOffset === 1 ? endM + 24 * 60 - startM : endM - startM;

        const db = await getBldDb();
        const etObjId = new ObjectId(eventTypeId);

        const et = await db.collection("event_types").findOne({ _id: etObjId });
        if (!et) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

        const result = await db.collection("events").insertOne({
            eventTypeId: etObjId,
            date,
            startTime,
            endTime,
            endDayOffset,
            durationMinutes,
            isCancelled: false,
            cancelNote: null,
            substitute: null,
            lessons: [],
        });

        return NextResponse.json({ ok: true, eventId: String(result.insertedId) });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
