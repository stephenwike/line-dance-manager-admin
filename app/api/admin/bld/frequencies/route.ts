import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLessonsDb, isId, isMyEventType, myEventTypeIds, newId, to12h, to24h } from "@/lib/lessons";

// Frequencies of Stephen's event types; times go to the pages as "5:00 PM" (stored as 24-hour "17:00").
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getLessonsDb();
    const docs = await db.collection("frequencies").find({ eventTypeId: { $in: await myEventTypeIds(db) } }).toArray();

    return NextResponse.json(docs.map((f) => ({
        ...f,
        _id: String(f._id),
        eventTypeId: f.eventTypeId ? String(f.eventTypeId) : null,
        startTime: to12h(f.startTime),
    })));
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));

        const { eventTypeId, kind, byDay, nth, weekday, startTime, durationMinutes, startDate, endDate, isActive } = body;

        if (!isId(eventTypeId)) return NextResponse.json({ error: "eventTypeId is required" }, { status: 400 });
        if (!["WEEKLY", "MONTHLY_NTH_WEEKDAY", "ONE_TIME"].includes(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
        const time24 = to24h(startTime);
        if (!time24) return NextResponse.json({ error: "startTime is required (e.g. 6:30 PM)" }, { status: 400 });
        if (!durationMinutes || durationMinutes <= 0) return NextResponse.json({ error: "durationMinutes must be positive" }, { status: 400 });

        const db = await getLessonsDb();
        if (!(await isMyEventType(db, eventTypeId))) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

        const now = new Date();
        const doc: Record<string, unknown> = {
            _id: newId(),
            eventTypeId,
            kind,
            startTime: time24,
            durationMinutes: Number(durationMinutes),
            isActive: typeof isActive === "boolean" ? isActive : true,
            createdAt: now,
            updatedAt: now,
        };

        if (kind === "WEEKLY") doc.byDay = Array.isArray(byDay) ? byDay : [];
        if (kind === "MONTHLY_NTH_WEEKDAY") { doc.nth = Number(nth ?? 1); doc.weekday = weekday; }
        if (startDate?.trim()) doc.startDate = startDate.trim();
        if (kind !== "ONE_TIME" && endDate?.trim()) doc.endDate = endDate.trim();

        await db.collection("frequencies").insertOne(doc);

        return NextResponse.json({ ok: true, frequencyId: doc._id }, { status: 201 });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
