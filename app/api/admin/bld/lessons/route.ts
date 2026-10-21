import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";
import { BLD_INSTRUCTOR_ID, getLessonsDb, newId } from "@/lib/lessons";

function isIsoLike(s: string) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(s);
}

// POST /api/admin/bld/lessons
// Body: { venue, date (ISO with offset), danceId?, danceName? }
// Adds a taught lesson straight to the history (ldco-lessons.lessons), with no event plan behind it.
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));

        const danceId = typeof body.danceId === "string" && body.danceId.trim() ? body.danceId.trim() : null;
        const danceName = typeof body.danceName === "string" && body.danceName.trim() ? body.danceName.trim() : null;
        const venue = typeof body.venue === "string" ? body.venue.trim() : "";
        const date = typeof body.date === "string" ? body.date.trim() : "";

        if (!danceId && !danceName) {
            return NextResponse.json({ error: "danceId or danceName is required" }, { status: 400 });
        }
        if (!venue) {
            return NextResponse.json({ error: "venue is required" }, { status: 400 });
        }
        if (!isIsoLike(date)) {
            return NextResponse.json(
                { error: "date must be ISO with timezone offset (e.g. 2025-12-20T17:00:00-07:00)" },
                { status: 400 }
            );
        }

        // The page sends the venue's name; record its id too when the name matches a venue.
        const match = await (await getMainDb()).collection<{ _id: string; [key: string]: unknown }>("venues").findOne({ venuename: venue }, { projection: { _id: 1 } });

        const db = await getLessonsDb();
        await db.collection<{ _id: string; [key: string]: unknown }>("lessons").insertOne({
            _id: newId(),
            ...(danceId ? { danceId } : { danceName }),
            venue,
            date: new Date(date),
            instructorId: BLD_INSTRUCTOR_ID,
            venueId: match ? String(match._id) : null,
            eventId: null,
            lessonId: null,
        });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
