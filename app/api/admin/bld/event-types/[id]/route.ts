import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getVenue } from "@/lib/venues";
import { BLD_USER_ID, getLessonsDb, isId, isMyEventType, to12h, to24h } from "@/lib/lessons";

function clean(v: unknown) {
    return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const db = await getLessonsDb();
    if (!(await isMyEventType(db, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const doc = await db.collection<{ _id: string; [key: string]: unknown }>("event_types").findOne({ _id: id });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
        _id: String(doc._id),
        title: doc.title ?? "",
        level: doc.level ?? "",
        price: doc.price ?? "",
        venueId: doc.venueId ? String(doc.venueId) : null,
        defaultStartTime: to12h(doc.defaultStartTime),
        defaultDurationMinutes: doc.defaultDurationMinutes ?? 0,
        isActive: !!doc.isActive,
    });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    try {
        const body = await req.json().catch(() => ({}));

        const title = clean(body.title);
        const venueId = clean(body.venueId);
        const level = clean(body.level);
        const price = clean(body.price);
        const defaultStartTime = to24h(body.defaultStartTime);
        const defaultDurationMinutes = Number(body.defaultDurationMinutes ?? 0);
        const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

        if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
        if (!venueId) return NextResponse.json({ error: "A venue is required" }, { status: 400 });
        if (!(await getVenue(venueId))) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

        const db = await getLessonsDb();
        if (!(await isMyEventType(db, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const now = new Date();
        const result = await db.collection<{ _id: string; [key: string]: unknown }>("event_types").updateOne(
            { _id: id },
            // Editing it is the instructor's activity, so it's validated (decision 17).
            { $set: { title, level, price, venueId, defaultStartTime, defaultDurationMinutes, isActive, updatedAt: now, verifiedAt: now, verifiedBy: BLD_USER_ID } },
        );

        if (result.matchedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
