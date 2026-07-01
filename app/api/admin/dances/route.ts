import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getMainDb();
    const dances = await db.collection("pending_dances")
        .find({})
        .sort({ submittedAt: 1 })
        .toArray();

    return NextResponse.json(dances.map((d) => ({
        id: d._id.toString(),
        danceName: d.danceName,
        songTitle: d.songTitle,
        artist: d.artist,
        choreographer: d.choreographer,
        count: d.count,
        wall: d.wall,
        difficulty: d.difficulty,
        stepsheetUrl: d.stepsheetUrl ?? d.stepsheet ?? null,
        submittedByUserId: d.submittedByUserId ?? null,
        submittedAt: d.submittedAt,
    })));
}
