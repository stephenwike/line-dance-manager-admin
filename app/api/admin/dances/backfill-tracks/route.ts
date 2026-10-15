import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";
import { ObjectId } from "mongodb";
import { JSDOM } from "jsdom";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AdminImporter/1.0)",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
};

async function scrapeTrackInfo(url: string): Promise<{ songTitle: string; artist: string }> {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const doc = new JSDOM(await res.text()).window.document;

    const songLinkEl = Array.from(doc.querySelectorAll(".sheetinfomusic a"))
        .find((el) => !el.querySelector("img") && (el.textContent?.trim() ?? "").length > 0);
    let songTitle = songLinkEl?.textContent?.trim() ?? "";

    const artistChildren = doc.querySelector(".sheetinfomusic")?.children;
    let artist = artistChildren
        ? Array.from(artistChildren)
              .map((x) => {
                  if (x.firstChild) x.removeChild(x.firstChild);
                  return x.textContent?.trim().replace(/^-\s*/, "").split(":")[0]?.trim() ?? "";
              })
              .filter(Boolean)[0] ?? ""
        : "";

    if (!songTitle || !artist) {
        for (const span of Array.from(doc.querySelectorAll(".sheetinfomusic span"))) {
            const text = (span.textContent ?? "").trim().replace(/\s+/g, " ");
            const match = text.match(/^(.+?)\s+by\s+(.+)$/i);
            if (match) {
                if (!songTitle) songTitle = match[1].trim();
                if (!artist) artist = match[2].trim();
                break;
            }
        }
    }

    return { songTitle, artist };
}

// ── GET /api/admin/dances/backfill-tracks ─────────────────────────────────────
// Returns dances that have neither a primaryTrack FK nor raw songArtists pairs.

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getMainDb();
    const dances = await db.collection("dances")
        .find({
            $or: [{ primaryTrack: "" }, { primaryTrack: { $exists: false } }],
            $and: [
                { $or: [{ songArtists: { $exists: false } }, { songArtists: { $size: 0 } }] },
            ],
        } as never)
        .project({ _id: 1, danceName: 1, stepsheet: 1 })
        .sort({ danceName: 1 })
        .toArray();

    return NextResponse.json({
        total: dances.length,
        dances: dances.map(d => ({
            id: d._id.toString(),
            danceName: d.danceName as string,
            stepsheet: d.stepsheet as string,
        })),
    });
}

// ── POST /api/admin/dances/backfill-tracks ────────────────────────────────────
// Cascade: use existing songArtists if present, otherwise scrape the stepsheet.

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { danceId, stepsheetUrl } = await req.json().catch(() => ({}));
    if (!danceId) {
        return NextResponse.json({ error: "danceId is required" }, { status: 400 });
    }

    const db = await getMainDb();

    // ── 1. Re-check: skip if primaryTrack was already set by a concurrent request ──
    // Dance ids are strings; fall back to ObjectId for legacy dances not yet migrated.
    const dances = db.collection("dances");
    const dance =
        await dances.findOne({ _id: String(danceId) } as never) ??
        (ObjectId.isValid(String(danceId)) ? await dances.findOne({ _id: new ObjectId(String(danceId)) }) : null);
    if (!dance) return NextResponse.json({ status: "error", message: "Dance not found" });
    const danceKey = { _id: dance._id };
    if (dance.primaryTrack && dance.primaryTrack !== "") {
        return NextResponse.json({ status: "skipped", message: "Already has track" });
    }

    // ── 2. Song info already recorded: nothing to backfill ───────────────────────
    // Unmatched songs stay in songArtists; no placeholder track is created (ldco-database decision 7).
    const existingPairs = Array.isArray(dance.songArtists) ? dance.songArtists as { song: string; artist: string }[] : [];
    if (existingPairs.length > 0) {
        return NextResponse.json({ status: "skipped", message: "Already has song info" });
    }

    // ── 3. Scrape the stepsheet page ───────────────────────────────────────────
    if (!stepsheetUrl) {
        return NextResponse.json({ status: "skipped", message: "No stepsheet URL to scrape" });
    }

    let songTitle: string, artist: string;
    try {
        ({ songTitle, artist } = await scrapeTrackInfo(stepsheetUrl as string));
    } catch (e) {
        return NextResponse.json({
            status: "error",
            message: e instanceof Error ? e.message : "Scrape failed",
        });
    }

    if (!songTitle) {
        return NextResponse.json({ status: "skipped", message: "No track info on page" });
    }

    await db.collection("dances").updateOne(
        danceKey,
        { $set: { songArtists: [{ song: songTitle, artist }] } }
    );

    return NextResponse.json({
        status: "updated",
        track: `${songTitle} — ${artist}`,
    });
}
