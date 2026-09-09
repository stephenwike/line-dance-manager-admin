import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const event = url.searchParams.get("event") || "intermediate-social-2026-09-12";
    const removedOnly = url.searchParams.get("removedOnly") === "true";

    const db = await getMainDb();

    const statusFilter = removedOnly
        ? { attendeeStatus: "removed" }
        : { attendeeStatus: { $ne: "removed" } };

    const registrations = await db.collection("event_registrations")
        .find({ event, ...statusFilter }, { projection: { name: 1, requests: 1 } })
        .toArray();

    // Collect all unique danceIds for a single bulk lookup
    const danceIds = new Set<string>();
    for (const reg of registrations) {
        for (const req of reg.requests ?? []) {
            if (req.danceId) danceIds.add(req.danceId);
        }
    }

    interface DanceInfo { danceName: string; songName: string | null; songArtist: string | null; durationMs: number | null; }
    const danceInfoById = new Map<string, DanceInfo>();

    if (danceIds.size > 0) {
        const dances = await db.collection<{ _id: string; danceName: string; primaryTrack?: string; tracks?: string[] }>("dances")
            .find({ _id: { $in: Array.from(danceIds) } })
            .project({ danceName: 1, primaryTrack: 1, tracks: 1 })
            .toArray();

        // Use primaryTrack if set, otherwise fall back to first entry in tracks array
        const trackIds = dances
            .map(d => d.primaryTrack || (Array.isArray(d.tracks) ? d.tracks[0] : undefined))
            .filter(Boolean) as string[];
        const trackById = new Map<string, { name: string; artists: string[]; duration_ms?: number }>();
        if (trackIds.length > 0) {
            const tracks = await db.collection("tracks")
                .find({ _id: { $in: trackIds } })
                .project({ name: 1, artists: 1, duration_ms: 1 })
                .toArray();
            for (const t of tracks) {
                trackById.set(String(t._id), { name: t.name, artists: t.artists ?? [], duration_ms: t.duration_ms });
            }
        }

        for (const d of dances) {
            const effectiveTrackId = d.primaryTrack || (Array.isArray(d.tracks) ? d.tracks[0] : undefined);
            const track = effectiveTrackId ? trackById.get(effectiveTrackId) : undefined;
            danceInfoById.set(String(d._id), {
                danceName: d.danceName ?? "Unknown",
                songName: track?.name ?? null,
                songArtist: track?.artists?.join(", ") ?? null,
                durationMs: track?.duration_ms ?? null,
            });
        }
    }

    // Tally: group by danceId if present, else by normalized text
    const tally = new Map<string, {
        key: string;
        danceId: string | null;
        displayName: string;
        count: number;
        requestors: string[];
        songName: string | null;
        songArtist: string | null;
        durationMs: number | null;
    }>();

    for (const reg of registrations) {
        for (const req of reg.requests ?? []) {
            const text = (req.text ?? "").trim();
            if (!text) continue;

            const key = req.danceId
                ? `id:${req.danceId}`
                : `text:${text.toLowerCase()}`;

            if (!tally.has(key)) {
                const info = req.danceId ? danceInfoById.get(req.danceId) : undefined;
                const displayName = info?.danceName ?? text;
                tally.set(key, {
                    key,
                    danceId: req.danceId ?? null,
                    displayName,
                    count: 0,
                    requestors: [],
                    songName: info?.songName ?? null,
                    songArtist: info?.songArtist ?? null,
                    durationMs: info?.durationMs ?? null,
                });
            }

            const entry = tally.get(key)!;
            entry.count++;
            entry.requestors.push(reg.name ?? "Unknown");
        }
    }

    const sorted = Array.from(tally.values())
        .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));

    const totalRequests = sorted.reduce((s, e) => s + e.count, 0);
    const registrantsWithRequests = registrations.filter(r => (r.requests ?? []).length > 0).length;

    return NextResponse.json({
        eventSlug: event,
        totalRegistrations: registrations.length,
        registrantsWithRequests,
        totalRequests,
        dances: sorted,
    });
}

// Bulk-rename or link a text-based request across all registrations for an event
export async function PATCH(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { event, fromText, toText, danceId, danceName } =
        body as { event: string; fromText: string; toText?: string; danceId?: string; danceName?: string };

    if (!event || !fromText) {
        return NextResponse.json({ error: "Missing event or fromText" }, { status: 400 });
    }

    const db = await getMainDb();

    // Case-insensitive regex so casing differences between registrants don't break matching
    const fromRegex = { $regex: `^${fromText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };

    if (danceId && danceName) {
        // Link mode: set danceId and canonical name on all matching unlinked requests
        const result = await db.collection("event_registrations").updateMany(
            { event, "requests.text": fromRegex },
            { $set: { "requests.$[req].danceId": danceId, "requests.$[req].text": danceName } },
            // Match any request with this text that isn't already linked (null or missing danceId)
            { arrayFilters: [{ "req.text": fromRegex, $or: [{ "req.danceId": null }, { "req.danceId": { $exists: false } }] }] }
        );
        return NextResponse.json({ modifiedCount: result.modifiedCount });
    }

    if (toText?.trim()) {
        // Rename mode: update the text only
        const result = await db.collection("event_registrations").updateMany(
            { event, "requests.text": fromRegex },
            { $set: { "requests.$[req].text": toText.trim() } },
            { arrayFilters: [{ "req.text": fromRegex }] }
        );
        return NextResponse.json({ modifiedCount: result.modifiedCount });
    }

    return NextResponse.json({ error: "Provide toText for rename or danceId+danceName for linking" }, { status: 400 });
}
