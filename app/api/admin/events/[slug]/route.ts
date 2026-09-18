import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEventsDb } from "@/lib/db";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await params;
    const db = await getEventsDb();
    const doc = await db.collection("events").findOne({ slug });

    if (!doc) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    return NextResponse.json({
        slug: doc.slug,
        title: doc.title,
        shortTitle: doc.shortTitle,
        date: doc.date,
        dateShort: doc.dateShort,
        time: doc.time,
        venueName: doc.venueName,
        venueAddress: doc.venueAddress,
        active: doc.active ?? true,
    });
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await params;
    const body = await req.json().catch(() => ({}));

    const allowed = ["title", "shortTitle", "date", "dateShort", "time", "venueName", "venueAddress", "active"];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
        if (key in body) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const db = await getEventsDb();
    const result = await db.collection("events").updateOne({ slug }, { $set: update });
    if (result.matchedCount === 0) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}
