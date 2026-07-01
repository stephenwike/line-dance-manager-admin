import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFeedDb } from "@/lib/db";
import { resolveUserNames } from "@/lib/feedUsers";

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const skip = parseInt(searchParams.get("skip") ?? "0", 10);

    const db = await getFeedDb();

    const [reports, total] = await Promise.all([
        db.collection("session_reports")
            .find({})
            .sort({ startedAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        db.collection("session_reports").countDocuments(),
    ]);

    const ownerIds = reports.map((r) => r.ownerId).filter(Boolean) as string[];
    const nameMap = await resolveUserNames(ownerIds);

    const mapped = reports.map((r) => ({
        id: String(r._id),
        sessionId: r.sessionId,
        ownerId: r.ownerId,
        ownerName: r.ownerId ? (nameMap[r.ownerId] ?? null) : null,
        sessionName: r.sessionName ?? null,
        startedAt: r.startedAt ?? null,
        closedAt: r.closedAt ?? null,
        actualDurationMs: r.actualDurationMs ?? null,
        stats: r.stats ?? null,
        trackCount: Array.isArray(r.playedTracks) ? r.playedTracks.length : 0,
        generatedAt: r.generatedAt ?? null,
    }));

    return NextResponse.json({ reports: mapped, total });
}
