import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";
import { Db, ObjectId, Document } from "mongodb";

// Tracks use a string _id (Spotify ID or SHA1 hash), not ObjectId.
type TrackDoc = { _id: string } & Document;
import crypto from "crypto";

interface TrackInput {
    /** Spotify track ID — used as _id when present */
    spotifyId?: string;
    spotifyUri?: string;
    name: string;
    artists: string[];
    isrc?: string;
    duration_ms?: number;
    explicit?: boolean;
    preview_url?: string | null;
}

/**
 * For manual tracks (no Spotify ID), generate a stable string _id from name+artists.
 * Existing Spotify tracks use the Spotify ID directly as _id.
 */
function generateManualTrackId(name: string, artists: string[]): string {
    const combined = `${name.toLowerCase().replace(/\s+/g, "-")}|${artists
        .map((a) => a.toLowerCase().replace(/\s+/g, "-"))
        .join(".")}`;
    return crypto.createHash("sha1").update(combined).digest("hex").substring(0, 24);
}

/**
 * Look up a choreographer by name (case-insensitive).
 * If not found, creates a new record. Returns the _id as a string.
 */
async function resolveChoreographer(db: Db, name: string): Promise<string> {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await db
        .collection("choreographers")
        .findOne({ name: { $regex: new RegExp(`^${escaped}$`, "i") } });

    if (existing) return existing._id.toString();

    const id = new ObjectId().toHexString();
    await db.collection("choreographers").insertOne({
        _id: id as never,
        name: name.trim(),
    });
    return id;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { action, overrides, track, additionalTracks } = await req.json().catch(() => ({}));

    if (!["approve", "deny"].includes(action)) {
        return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const mainDb = await getMainDb();

    // pending_dances may store _id as a plain string (SHA1) or as an ObjectId.
    // Try string first, then ObjectId.
    let objectId: ObjectId | null = null;
    try { objectId = new ObjectId(id); } catch { /* not a valid ObjectId hex */ }

    const col = mainDb.collection("pending_dances");
    const pending =
        await col.findOne({ _id: id } as never) ??
        (objectId ? await col.findOne({ _id: objectId }) : null);

    if (!pending) {
        return NextResponse.json({ error: "Pending dance not found." }, { status: 404 });
    }

    // Use whatever _id the document actually has for the approved dance.
    const approvedId = pending._id;

    if (action === "approve") {
        // ── Resolve choreographer names → IDs ─────────────────────────────────
        const choreographerNames: string[] =
            overrides?.choreographers?.length
                ? overrides.choreographers
                : pending.choreographer
                ? [pending.choreographer]
                : [];

        const choreographerIds = await Promise.all(
            choreographerNames
                .map((n: string) => n.trim())
                .filter(Boolean)
                .map((name: string) => resolveChoreographer(mainDb, name))
        );

        // ── Upsert track ──────────────────────────────────────────────────────
        let primaryTrackId = "";
        if (track) {
            const t = track as TrackInput;
            // Spotify tracks use the Spotify ID as _id (matching existing schema).
            // Manual tracks fall back to a SHA1 of name+artists.
            primaryTrackId = t.spotifyId ?? generateManualTrackId(t.name, t.artists);

            const tracks = mainDb.collection<TrackDoc>("tracks");
            const existing = await tracks.findOne({ _id: primaryTrackId });
            if (!existing) {
                await tracks.insertOne({
                    _id: primaryTrackId,
                    name: t.name,
                    artists: t.artists,
                    isrc: t.isrc ?? "",
                    uri: t.spotifyUri ?? "",
                    ...(t.duration_ms != null && { duration_ms: t.duration_ms }),
                    ...(t.explicit != null && { explicit: t.explicit }),
                    ...(t.preview_url !== undefined && { preview_url: t.preview_url }),
                });
            }
        }

        // ── Upsert additional tracks ──────────────────────────────────────────
        const additionalTrackIds: string[] = [];
        if (Array.isArray(additionalTracks) && additionalTracks.length > 0) {
            for (const at of additionalTracks as TrackInput[]) {
                const altId = at.spotifyId ?? generateManualTrackId(at.name, at.artists);
                const altTracks = mainDb.collection<TrackDoc>("tracks");
                const existingAlt = await altTracks.findOne({ _id: altId });
                if (!existingAlt) {
                    await altTracks.insertOne({
                        _id: altId,
                        name: at.name,
                        artists: at.artists,
                        isrc: at.isrc ?? "",
                        uri: at.spotifyUri ?? "",
                        ...(at.duration_ms != null && { duration_ms: at.duration_ms }),
                        ...(at.explicit != null && { explicit: at.explicit }),
                        ...(at.preview_url !== undefined && { preview_url: at.preview_url }),
                    });
                }
                additionalTrackIds.push(altId);
            }
        }

        // ── Insert dance ──────────────────────────────────────────────────────
        // Preserve the pending dance's _id so existing user marks
        // (favorites, known, refresh, flagged) remain valid after approval.
        const allTrackIds = [...new Set([primaryTrackId, ...additionalTrackIds].filter(Boolean))];
        await mainDb.collection("dances").insertOne({
            _id: approvedId,
            danceName: overrides?.danceName ?? pending.danceName,
            choreographers: choreographerIds,
            stepsheet: overrides?.stepsheetUrl || pending.stepsheetUrl || pending.stepsheet || "",
            difficulty: overrides?.difficulty ?? pending.difficulty ?? "Beginner",
            primaryTrack: primaryTrackId,
            tracks: allTrackIds,
        });
    }

    await mainDb.collection("pending_dances").deleteOne({ _id: pending._id });

    return NextResponse.json({ ok: true });
}
