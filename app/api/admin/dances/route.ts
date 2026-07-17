import { NextResponse } from "next/server";
import { ObjectId, Db } from "mongodb";
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

// ── Shared helpers (mirrors logic in dances/[id]/route.ts) ───────────────────

type TrackDoc = { _id: string } & Record<string, unknown>;

interface TrackInput {
    spotifyId?: string;
    spotifyUri?: string;
    name: string;
    artists: string[];
    isrc?: string;
    duration_ms?: number;
    explicit?: boolean;
    preview_url?: string | null;
}

function generateManualTrackId(name: string, artists: string[]): string {
    const combined = `${name.toLowerCase().replace(/\s+/g, "-")}|${artists
        .map((a) => a.toLowerCase().replace(/\s+/g, "-"))
        .join(".")}`;
    return crypto.createHash("sha1").update(combined).digest("hex").substring(0, 24);
}

async function resolveChoreographer(db: Db, name: string): Promise<string> {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await db
        .collection("choreographers")
        .findOne({ name: { $regex: new RegExp(`^${escaped}$`, "i") } });
    if (existing) return existing._id.toString();
    const id = new ObjectId().toHexString();
    await db.collection("choreographers").insertOne({ _id: id as never, name: name.trim() });
    return id;
}

async function upsertTrack(db: Db, t: TrackInput): Promise<string> {
    const trackId = t.spotifyId ?? generateManualTrackId(t.name, t.artists);
    const tracks = db.collection<TrackDoc>("tracks");
    const existing = await tracks.findOne({ _id: trackId });
    if (!existing) {
        await tracks.insertOne({
            _id: trackId,
            name: t.name,
            artists: t.artists,
            isrc: t.isrc ?? "",
            uri: t.spotifyUri ?? "",
            ...(t.duration_ms != null && { duration_ms: t.duration_ms }),
            ...(t.explicit != null && { explicit: t.explicit }),
            ...(t.preview_url !== undefined && { preview_url: t.preview_url }),
        });
    }
    return trackId;
}

// ── GET /api/admin/dances ─────────────────────────────────────────────────────

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

// ── POST /api/admin/dances — create a dance directly (admin-entered) ──────────

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const { track, overrides, additionalTracks } = body;

        if (!overrides?.danceName?.trim()) {
            return NextResponse.json({ error: "danceName is required" }, { status: 400 });
        }

        const db = await getMainDb();

        // Resolve choreographers
        const choreographerNames: string[] = Array.isArray(overrides?.choreographers)
            ? overrides.choreographers.filter(Boolean)
            : [];
        const choreographerIds = await Promise.all(
            choreographerNames.map((n: string) => resolveChoreographer(db, n))
        );

        // Upsert primary track
        let primaryTrackId = "";
        if (track?.name) {
            primaryTrackId = await upsertTrack(db, track as TrackInput);
        }

        // Upsert additional tracks
        const additionalTrackIds: string[] = [];
        if (Array.isArray(additionalTracks)) {
            for (const at of additionalTracks as TrackInput[]) {
                if (at?.name) additionalTrackIds.push(await upsertTrack(db, at));
            }
        }

        const danceId = new ObjectId();
        const allTrackIds = [...new Set([primaryTrackId, ...additionalTrackIds].filter(Boolean))];

        await db.collection("dances").insertOne({
            _id: danceId,
            danceName: overrides.danceName.trim(),
            choreographers: choreographerIds,
            stepsheet: overrides?.stepsheetUrl?.trim() || "",
            difficulty: overrides?.difficulty?.trim() || "Beginner",
            primaryTrack: primaryTrackId,
            tracks: allTrackIds,
        });

        return NextResponse.json({ ok: true, danceId: danceId.toHexString() });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
