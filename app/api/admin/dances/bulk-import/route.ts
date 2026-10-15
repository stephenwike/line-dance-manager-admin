import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";
import { ObjectId, Db } from "mongodb";
import { JSDOM } from "jsdom";

// ── Scrape a single CopperKnob stepsheet page ─────────────────────────────────

async function scrapeStepsheet(url: string) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AdminImporter/1.0)",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const doc = new JSDOM(await res.text()).window.document;

    const difficultyChildren = doc.querySelector(".sheetinfolevel")?.children;
    const difficulty = difficultyChildren
        ? (Array.from(difficultyChildren).map((x) => x.textContent ?? "")[1] ?? "")
        : "";

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

    const danceName = doc.querySelector(".box h2")?.textContent?.trim() ?? "";

    const linkedChoreographers = Array.from(
        doc.querySelectorAll(".sheetinfochoregrapher span a")
    ).map((el) => el.textContent?.trim() ?? "").filter(Boolean);

    const choreographers = linkedChoreographers.length > 0
        ? linkedChoreographers
        : Array.from(doc.querySelectorAll(".sheetinfochoregrapher span"))
              .map((el) => el.textContent?.trim() ?? "")
              .filter(Boolean);

    return { danceName, choreographers, difficulty, songTitle, artist };
}

// ── Resolve choreographer name → ID (create if missing) ──────────────────────

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

// ── POST /api/admin/dances/bulk-import ────────────────────────────────────────
// Process one dance at a time. Rate limiting is handled client-side.

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { stepsheetUrl, choreographerOverride } = await req.json().catch(() => ({}));
    if (!stepsheetUrl || typeof stepsheetUrl !== "string") {
        return NextResponse.json({ error: "stepsheetUrl is required" }, { status: 400 });
    }

    const db = await getMainDb();

    // ── 1. Check if this URL already exists in the dances collection ───────────
    const existsByUrl = await db.collection("dances").findOne({ stepsheet: stepsheetUrl } as never);
    if (existsByUrl) {
        return NextResponse.json({
            status: "exists",
            danceName: existsByUrl.danceName as string,
        });
    }

    // ── 2. Scrape the stepsheet page ───────────────────────────────────────────
    let scraped: Awaited<ReturnType<typeof scrapeStepsheet>>;
    try {
        scraped = await scrapeStepsheet(stepsheetUrl);
    } catch (e) {
        return NextResponse.json({
            status: "error",
            danceName: null,
            message: e instanceof Error ? e.message : "Scrape failed",
        });
    }

    const { danceName, choreographers: scrapedChoreos, difficulty, songTitle, artist } = scraped;
    if (!danceName) {
        return NextResponse.json({ status: "error", danceName: null, message: "Could not parse dance name" });
    }

    // ── 3. Resolve choreographer names to IDs ──────────────────────────────────
    // Prefer scraped names (captures all collaborators); fall back to override if scrape found nothing
    const choreographerNames = scrapedChoreos.filter(Boolean).length > 0
        ? scrapedChoreos.filter(Boolean)
        : choreographerOverride
        ? [choreographerOverride]
        : [];

    const choreographerIds = await Promise.all(
        choreographerNames.map((n: string) => resolveChoreographer(db, n))
    );

    // ── 4. Check if a dance with this name + same choreographer already exists ──
    const existsByName = choreographerIds.length > 0
        ? await db.collection("dances").findOne({
            danceName: { $regex: new RegExp(`^${danceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
            choreographers: choreographerIds[0],
          } as never)
        : null;

    if (existsByName) {
        // Dance exists under a different URL — add the new URL as an alternate
        const existing = existsByName;
        const existingUrls: string[] = Array.isArray(existing.stepsheetUrls) ? existing.stepsheetUrls as string[] : [];
        if (!existingUrls.includes(stepsheetUrl)) {
            await db.collection("dances").updateOne(
                { _id: existing._id },
                { $addToSet: { stepsheetUrls: stepsheetUrl } } as never
            );
        }
        return NextResponse.json({
            status: "url_added",
            danceName: existing.danceName as string,
            message: `Alternate URL added (primary: ${existing.stepsheet as string})`,
        });
    }

    // ── 5. Keep the scraped song on the dance ─────────────────────────────────
    // No track is matched here, so no track document is created (no placeholder tracks);
    // primaryTrack stays empty until a real track is matched (ldco-database decision 7).
    const songArtists: { song: string; artist: string }[] = songTitle ? [{ song: songTitle, artist }] : [];

    // ── 6. Create the new dance ────────────────────────────────────────────────
    // ldco ids are strings (ldco-database decision 5), never ObjectIds
    await db.collection("dances").insertOne({
        _id: new ObjectId().toHexString() as never,
        danceName: danceName.trim(),
        choreographers: choreographerIds,
        stepsheet: stepsheetUrl,
        stepsheetUrls: [],
        difficulty: difficulty?.trim() || "Beginner",
        primaryTrack: "",
        tracks: [],
        songArtists,
    });

    return NextResponse.json({ status: "created", danceName });
}
