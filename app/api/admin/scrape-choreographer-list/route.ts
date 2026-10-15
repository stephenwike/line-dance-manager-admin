import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { JSDOM } from "jsdom";

const MAX_PAGES = 100;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AdminImporter/1.0)",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
};

// Dance names ending with a 2–3 letter language code, e.g. "(fr)", "(de)", "(pt)"
const TRANSLATION_RE = /\s*\([a-z]{2,3}\)\s*$/i;

function nameFromUrl(url: string): string {
    const parts = url.replace(/\/$/, "").split("/").filter(Boolean);
    const slug = parts[parts.length - 1] ?? "";
    // If the last segment looks like a hash/id (all caps alphanumeric, short), use second-to-last
    const name = /^[A-Z0-9]{5,10}$/.test(slug) ? (parts[parts.length - 2] ?? slug) : slug;
    return name.replace(/-/g, " ");
}

async function fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.text();
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { url } = await req.json().catch(() => ({}));
    if (!url || typeof url !== "string" || !url.includes("copperknob")) {
        return NextResponse.json({ error: "A CopperKnob choreographer page URL is required." }, { status: 400 });
    }

    const baseUrl = url.split("?")[0].replace(/\/$/, "");

    const seenDanceUrls = new Set<string>();
    const seenPageUrls = new Set<string>();
    const queue: string[] = [url];
    const dances: { url: string; name: string }[] = [];

    let rawLinksFound = 0;
    let translationsSkipped = 0;

    while (queue.length > 0 && seenPageUrls.size < MAX_PAGES) {
        const pageUrl = queue.shift()!;
        if (seenPageUrls.has(pageUrl)) continue;
        seenPageUrls.add(pageUrl);

        let html: string;
        try {
            html = await fetchHtml(pageUrl);
        } catch {
            continue;
        }

        const doc = new JSDOM(html).window.document;

        // ── Collect dance links ────────────────────────────────────────────────
        for (const a of Array.from(doc.querySelectorAll('a[href*="/stepsheets/"]'))) {
            const href = (a as HTMLAnchorElement).getAttribute("href") ?? "";
            const abs = href.startsWith("http") ? href : `https://www.copperknob.co.uk${href}`;
            const canonical = abs.split("?")[0].replace(/\/$/, "");

            if (seenDanceUrls.has(canonical)) continue;
            seenDanceUrls.add(canonical);
            rawLinksFound++;

            // Use anchor text first; fall back to URL slug if empty (image/icon links)
            const name = (a.textContent ?? "").trim() || nameFromUrl(canonical);

            if (TRANSLATION_RE.test(name)) {
                translationsSkipped++;
                continue;
            }

            dances.push({ url: canonical, name });
        }

        // ── Discover pagination links ─────────────────────────────────────────
        for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
            const href = (a as HTMLAnchorElement).getAttribute("href") ?? "";
            const abs = href.startsWith("http") ? href : `https://www.copperknob.co.uk${href}`;
            if (!abs.startsWith(baseUrl)) continue;
            const qs = abs.slice(baseUrl.length);
            // CopperKnob paginates via recnum= offset; also accept ?Page=N as fallback
            if (!/[?&]recnum=\d+/.test(qs) && !/[?&][Pp]age[A-Za-z]*=\d+/.test(qs)) continue;
            if (!seenPageUrls.has(abs)) queue.push(abs);
        }
    }

    if (dances.length === 0) {
        return NextResponse.json(
            {
                error: "No stepsheet links found. Make sure this is a CopperKnob choreographer page.",
                debug: { rawLinksFound, translationsSkipped, pagesVisited: seenPageUrls.size },
            },
            { status: 422 }
        );
    }

    return NextResponse.json({
        dances,
        total: dances.length,
        debug: { rawLinksFound, translationsSkipped, pagesVisited: seenPageUrls.size },
    });
}
