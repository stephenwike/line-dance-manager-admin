import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { JSDOM } from "jsdom";

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

    const searchUrl = `https://www.copperknob.co.uk/choreographers?Search=${encodeURIComponent(q)}`;

    const response = await fetch(searchUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AdminImporter/1.0)",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        return NextResponse.json({ error: `CopperKnob returned ${response.status}` }, { status: 502 });
    }

    const html = await response.text();
    const doc = new JSDOM(html).window.document;

    const seen = new Set<string>();
    const suggestions: { name: string; url: string }[] = [];

    for (const a of Array.from(doc.querySelectorAll('a[href*="/choreographer/"]'))) {
        const href = (a as HTMLAnchorElement).getAttribute("href") ?? "";
        const abs = href.startsWith("http") ? href : `https://www.copperknob.co.uk${href}`;

        // Must match /choreographer/HASH/slug pattern — not the /choreographers/ listing page
        if (!abs.match(/\/choreographer\/[A-Z0-9]+\//i)) continue;

        const canonical = abs.replace(/\/$/, "");
        if (seen.has(canonical)) continue;
        seen.add(canonical);

        const name = (a.textContent ?? "").trim();
        if (name) suggestions.push({ name, url: canonical });
    }

    return NextResponse.json(suggestions);
}
