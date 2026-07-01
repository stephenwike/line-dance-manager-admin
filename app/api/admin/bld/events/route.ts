import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";
import { isYmd, parseTime12ToMinutes } from "@/lib/time";

function clean(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}

function normalizeLessons(input: unknown) {
    if (!Array.isArray(input)) return [];
    return input.map((l) => ({
        time: clean(l?.time),
        danceId: clean(l?.danceId),
        dance: clean(l?.dance),
        level: clean(l?.level),
        link: clean(l?.link),
        committed: false,
    }));
}

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
        const lessons = normalizeLessons(body.lessons);

        if (!ObjectId.isValid(eventTypeId)) return NextResponse.json({ error: "Invalid eventTypeId" }, { status: 400 });
        if (!isYmd(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });

        const startM = parseTime12ToMinutes(startTime);
        const endM = parseTime12ToMinutes(endTime);
        if (startM === null) return NextResponse.json({ error: "startTime must be like '6:30 PM'" }, { status: 400 });
        if (endM === null) return NextResponse.json({ error: "endTime must be like '8:00 PM'" }, { status: 400 });
        if (endM <= startM) return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });

        const durationMinutes = endM - startM;
        const db = await getBldDb();
        const etId = new ObjectId(eventTypeId);

        const exists = await db.collection("event_types").findOne({ _id: etId });
        if (!exists) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

        const filter = { eventTypeId: etId, date, startTime };
        const update = {
            $setOnInsert: { eventTypeId: etId, date, startTime },
            $set: { endTime, durationMinutes, isCancelled, cancelNote, substitute, lessons, updatedAt: new Date() },
        };

        const res = await db.collection("events").updateOne(filter, update, { upsert: true });

        let eventId: string | null = null;
        if (res.upsertedId) {
            eventId = String(res.upsertedId);
        } else {
            const doc = await db.collection("events").findOne(filter, { projection: { _id: 1 } });
            eventId = doc?._id ? String(doc._id) : null;
        }

        if (!eventId) return NextResponse.json({ error: "Failed to resolve eventId" }, { status: 500 });
        return NextResponse.json({ ok: true, eventId, created: !!res.upsertedId });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
