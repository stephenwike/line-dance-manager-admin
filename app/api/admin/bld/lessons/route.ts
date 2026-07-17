import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

function isIsoLike(s: string) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(s);
}

// POST /api/admin/bld/lessons
// Body: { venue, date (ISO with offset), danceId?, danceName? }
// Inserts a taught lesson directly into the lessons collection (no event plan required).
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

        const db = await getBldDb();
        const doc: Record<string, unknown> = { venue, date };
        if (danceId) doc.danceId = danceId;
        else doc.danceName = danceName;

        await db.collection("lessons").insertOne(doc);

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
