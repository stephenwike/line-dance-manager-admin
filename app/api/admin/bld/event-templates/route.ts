import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

function clean(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}

function normalizeLessons(input: unknown) {
    if (!Array.isArray(input)) return [];
    return input.map((l) => ({
        time: clean(l?.time),
        dance: clean(l?.dance),
        level: clean(l?.level),
        link: clean(l?.link),
    }));
}

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const eventTypeId = searchParams.get("eventTypeId");

    const db = await getBldDb();
    const filter: Record<string, unknown> = {};
    if (eventTypeId && ObjectId.isValid(eventTypeId)) {
        filter.eventTypeId = new ObjectId(eventTypeId);
    }

    const docs = await db.collection("event_templates").find(filter)
        .sort({ eventTypeId: 1, name: 1 })
        .toArray();

    return NextResponse.json(docs.map((d) => ({
        _id: String(d._id),
        eventTypeId: String(d.eventTypeId),
        name: d.name ?? "",
        isDefault: !!d.isDefault,
        lessons: Array.isArray(d.lessons) ? d.lessons : [],
    })));
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const eventTypeId = clean(body.eventTypeId);
    const name = clean(body.name);

    if (!eventTypeId || !ObjectId.isValid(eventTypeId)) {
        return NextResponse.json({ error: "Invalid eventTypeId" }, { status: 400 });
    }
    if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const isDefault = !!body.isDefault;
    const db = await getBldDb();
    const etOid = new ObjectId(eventTypeId);

    if (isDefault) {
        await db.collection("event_templates").updateMany(
            { eventTypeId: etOid, isDefault: true },
            { $set: { isDefault: false } }
        );
    }

    const result = await db.collection("event_templates").insertOne({
        eventTypeId: etOid,
        name,
        isDefault,
        lessons: normalizeLessons(body.lessons),
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, _id: String(result.insertedId) });
}
