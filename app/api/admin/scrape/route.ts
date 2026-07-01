import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { JSDOM } from "jsdom";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { url } = await req.json().catch(() => ({}));
    if (!url || typeof url !== "string") {
        return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    const response = await fetch(url, {
        headers: {
            "User-Agent": "CKScraper",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        return NextResponse.json(
            { error: `Failed to fetch page: ${response.statusText}` },
            { status: response.status }
        );
    }

    const html = await response.text();
    const doc = new JSDOM(html).window.document;

    const difficultyChildren = doc.querySelector(".sheetinfolevel")?.children;
    const difficulty = difficultyChildren
        ? (Array.from(difficultyChildren).map((x) => x.textContent ?? "")[1] ?? "")
        : "";

    // Normal layout: song title is a direct <a> inside .sheetinfomusic (not an Amazon image-link)
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

    // Fallback layout: song and artist are combined in a plain span as "Song by Artist"
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

    // Linked choreographers have an <a> inside the <span>.
    // Unlinked ones (e.g. "Unknown") are plain <span> text with no <a>.
    const linkedChoreographers = Array.from(
        doc.querySelectorAll(".sheetinfochoregrapher span a")
    ).map((el) => el.textContent?.trim() ?? "").filter(Boolean);

    const choreographers = linkedChoreographers.length > 0
        ? linkedChoreographers
        : Array.from(doc.querySelectorAll(".sheetinfochoregrapher span"))
              .map((el) => el.textContent?.trim() ?? "")
              .filter(Boolean);

    const missing = [
        !danceName && "dance name",
        !songTitle && "song title",
        !artist && "artist",
        !difficulty && "difficulty",
        choreographers.length === 0 && "choreographers",
    ].filter(Boolean);

    return NextResponse.json({
        danceName: danceName || null,
        songTitle: songTitle || null,
        artist: artist || null,
        difficulty: difficulty || null,
        choreographers,
        stepsheet: url,
        missing,
    });
}
