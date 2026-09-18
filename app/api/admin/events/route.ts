import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEventsDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getEventsDb();
    const docs = await db.collection("events")
        .find({ active: true })
        .sort({ date: -1 })
        .toArray();

    return NextResponse.json(docs.map((d) => ({
        slug: d.slug,
        title: d.title,
        shortTitle: d.shortTitle,
        date: d.date,
        dateShort: d.dateShort,
        time: d.time,
        venueName: d.venueName,
        venueAddress: d.venueAddress,
        active: d.active ?? true,
    })));
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { slug, title, shortTitle, date, dateShort, time, venueName, venueAddress } = body;

    if (!slug || !title || !date) {
        return NextResponse.json({ error: "slug, title, and date are required" }, { status: 400 });
    }

    const db = await getEventsDb();
    const existing = await db.collection("events").findOne({ slug });
    if (existing) return NextResponse.json({ error: "An event with this slug already exists" }, { status: 409 });

    await db.collection("events").insertOne({
        slug, title, shortTitle: shortTitle ?? title,
        date, dateShort: dateShort ?? date,
        time: time ?? "", venueName: venueName ?? "", venueAddress: venueAddress ?? "",
        active: true, createdAt: new Date(),
    });

    return NextResponse.json({ ok: true, slug }, { status: 201 });
}
