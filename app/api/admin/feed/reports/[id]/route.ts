import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getFeedDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const db = await getFeedDb();

    let report;
    try {
        report = await db.collection("session_reports").findOne({ _id: new ObjectId(id) });
    } catch {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tracks = (Array.isArray(report.playedTracks) ? report.playedTracks : []).map(
        (t: {
            danceName?: string; danceId?: string; songName?: string; artist?: string;
            difficulty?: string; stepsheet?: string; danceType?: string;
            isSongSwap?: boolean; swapSongName?: string; swapArtist?: string;
            playedAt?: Date; requesterCount?: number; totalTips?: number;
            requesters?: { requesterName?: string; tipCents?: number }[];
        }, i: number) => ({
            position: i + 1,
            danceName: t.danceName ?? null,
            danceId: t.danceId ?? null,
            songName: t.songName ?? null,
            artist: t.artist ?? null,
            difficulty: t.difficulty ?? null,
            stepsheet: t.stepsheet ?? null,
            danceType: t.danceType ?? null,
            isSongSwap: t.isSongSwap ?? false,
            swapSongName: t.swapSongName ?? null,
            swapArtist: t.swapArtist ?? null,
            playedAt: t.playedAt ?? null,
            requesterCount: t.requesterCount ?? 0,
            totalTipCents: t.totalTips ?? 0,
            requesters: (t.requesters ?? []).map((r) => ({
                name: r.requesterName ?? null,
                tipCents: r.tipCents ?? 0,
            })),
        })
    );

    return NextResponse.json({ tracks });
}
