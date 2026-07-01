import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

function clean(v: unknown) {
    return typeof v === "string" ? v.trim() : "";
}

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getBldDb();
    const docs = await db.collection("event_types")
        .find({})
        .project({ title: 1, level: 1, price: 1, venueId: 1, isActive: 1, defaultStartTime: 1, defaultDurationMinutes: 1, isOneOff: 1 })
        .sort({ title: 1 })
        .toArray();

    return NextResponse.json(docs.map((et) => ({
        _id: String(et._id),
        title: et.title ?? "",
        level: et.level ?? "",
        price: et.price ?? "",
        venueId: et.venueId ? String(et.venueId) : null,
        isActive: typeof et.isActive === "boolean" ? et.isActive : true,
        defaultStartTime: et.defaultStartTime ?? "",
        defaultDurationMinutes: Number(et.defaultDurationMinutes ?? 0),
        isOneOff: !!et.isOneOff,
    })));
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));

        const title = clean(body.title);
        const venueId = clean(body.venueId);
        const level = clean(body.level);
        const price = clean(body.price);
        const defaultStartTime = clean(body.defaultStartTime);
        const defaultDurationMinutes = Number(body.defaultDurationMinutes ?? 0);
        const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

        if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
        if (!ObjectId.isValid(venueId)) return NextResponse.json({ error: "A venue is required" }, { status: 400 });

        const db = await getBldDb();
        const venue = await db.collection("venues").findOne({ _id: new ObjectId(venueId) });
        if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

        const res = await db.collection("event_types").insertOne({
            title, level, price,
            venueId: new ObjectId(venueId),
            defaultStartTime, defaultDurationMinutes,
            isActive,
            createdAt: new Date(),
        });

        return NextResponse.json({ ok: true, eventTypeId: String(res.insertedId) });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
