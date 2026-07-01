import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getBldDb();
    const docs = await db.collection("frequencies").find({}).toArray();

    return NextResponse.json(docs.map((f) => ({
        ...f,
        _id: String(f._id),
        eventTypeId: f.eventTypeId ? String(f.eventTypeId) : null,
    })));
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));

        const { eventTypeId, kind, byDay, nth, weekday, startTime, durationMinutes, startDate, endDate, isActive } = body;

        if (!ObjectId.isValid(eventTypeId)) return NextResponse.json({ error: "eventTypeId is required" }, { status: 400 });
        if (!["WEEKLY", "MONTHLY_NTH_WEEKDAY", "ONE_TIME"].includes(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
        if (!startTime?.trim()) return NextResponse.json({ error: "startTime is required" }, { status: 400 });
        if (!durationMinutes || durationMinutes <= 0) return NextResponse.json({ error: "durationMinutes must be positive" }, { status: 400 });

        const doc: Record<string, unknown> = {
            eventTypeId: new ObjectId(eventTypeId),
            kind,
            startTime: startTime.trim(),
            durationMinutes: Number(durationMinutes),
            isActive: typeof isActive === "boolean" ? isActive : true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (kind === "WEEKLY") doc.byDay = Array.isArray(byDay) ? byDay : [];
        if (kind === "MONTHLY_NTH_WEEKDAY") { doc.nth = Number(nth ?? 1); doc.weekday = weekday; }
        if (startDate?.trim()) doc.startDate = startDate.trim();
        if (kind !== "ONE_TIME" && endDate?.trim()) doc.endDate = endDate.trim();

        const db = await getBldDb();
        const res = await db.collection("frequencies").insertOne(doc);

        return NextResponse.json({ ok: true, frequencyId: String(res.insertedId) }, { status: 201 });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
