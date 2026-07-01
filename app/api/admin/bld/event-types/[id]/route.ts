import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

function clean(v: unknown) {
    return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const db = await getBldDb();
    const doc = await db.collection("event_types").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
        _id: String(doc._id),
        title: doc.title ?? "",
        level: doc.level ?? "",
        price: doc.price ?? "",
        venueId: doc.venueId ? String(doc.venueId) : null,
        defaultStartTime: doc.defaultStartTime ?? "",
        defaultDurationMinutes: doc.defaultDurationMinutes ?? 0,
        isActive: !!doc.isActive,
    });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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
        const result = await db.collection("event_types").updateOne(
            { _id: new ObjectId(id) },
            { $set: { title, level, price, venueId: new ObjectId(venueId), defaultStartTime, defaultDurationMinutes, isActive, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
