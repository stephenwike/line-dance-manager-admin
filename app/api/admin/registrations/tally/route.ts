import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = new URL(req.url).searchParams.get("event") || "intermediate-social-2026-09-12";

    const db = await getMainDb();

    const registrations = await db.collection("event_registrations")
        .find({ event }, { projection: { name: 1, requests: 1 } })
        .toArray();

    // Collect all unique danceIds for a single bulk lookup
    const danceIds = new Set<string>();
    for (const reg of registrations) {
        for (const req of reg.requests ?? []) {
            if (req.danceId) danceIds.add(req.danceId);
        }
    }

    const danceNameById = new Map<string, string>();
    if (danceIds.size > 0) {
        const dances = await db.collection("dances")
            .find({ _id: { $in: Array.from(danceIds).map(id => new ObjectId(id)) } })
            .project({ danceName: 1 })
            .toArray();
        for (const d of dances) {
            danceNameById.set(String(d._id), d.danceName ?? "Unknown");
        }
    }

    // Tally: group by danceId if present, else by normalized text
    const tally = new Map<string, {
        key: string;
        danceId: string | null;
        displayName: string;
        count: number;
        requestors: string[];
    }>();

    for (const reg of registrations) {
        for (const req of reg.requests ?? []) {
            const text = (req.text ?? "").trim();
            if (!text) continue;

            const key = req.danceId
                ? `id:${req.danceId}`
                : `text:${text.toLowerCase()}`;

            if (!tally.has(key)) {
                const displayName = req.danceId
                    ? (danceNameById.get(req.danceId) ?? text)
                    : text;
                tally.set(key, { key, danceId: req.danceId ?? null, displayName, count: 0, requestors: [] });
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
