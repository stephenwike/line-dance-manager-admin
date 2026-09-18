import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb, getEventsDb } from "@/lib/db";

// One-time migration: copies event_registrations from ldco → ldco-events
// and seeds the events collection. Safe to run multiple times (upserts by _id).
// DELETE THIS ROUTE after migration is confirmed.
export async function POST() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [mainDb, eventsDb] = await Promise.all([getMainDb(), getEventsDb()]);

    // 1. Seed event metadata
    await eventsDb.collection("events").updateOne(
        { slug: "intermediate-social-2026-09-12" },
        {
            $setOnInsert: {
                slug: "intermediate-social-2026-09-12",
                title: "Intermediate Line Dance Social",
                shortTitle: "Int LD Social",
                date: "Saturday, September 19, 2026",
                dateShort: "Sep 19",
                time: "12:00 PM – 4:00 PM",
                venueName: "Midnight Toad",
                venueAddress: "5302 S Federal Cir # A\nLittleton, CO 80123",
                active: true,
                createdAt: new Date(),
            },
        },
        { upsert: true }
    );

    // 2. Copy registrations
    const registrations = await mainDb.collection("event_registrations").find({}).toArray();
    let migrated = 0;
    let skipped = 0;

    for (const doc of registrations) {
        const result = await eventsDb.collection("event_registrations").updateOne(
            { _id: doc._id },
            { $setOnInsert: doc },
            { upsert: true }
        );
        if (result.upsertedCount > 0) migrated++;
        else skipped++;
    }

    return NextResponse.json({
        ok: true,
        migrated,
        skipped,
        message: `Migrated ${migrated} new registrations, skipped ${skipped} already present.`,
    });
}
