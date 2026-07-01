import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSpotifyAccessToken } from "@/lib/spotify";

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(req.url).searchParams.get("q");
    if (!q) return NextResponse.json({ error: "Query parameter 'q' is required." }, { status: 400 });

    const token = await getSpotifyAccessToken();
    const res = await fetch(
        `https://api.spotify.com/v1/search?${new URLSearchParams({ q, type: "track", limit: "5" })}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        const isPremiumError = text.includes("premium");
        return NextResponse.json(
            {
                error: isPremiumError
                    ? "Spotify API requires a Premium subscription on the developer app owner's account. Update credentials in .env.local."
                    : "Spotify search failed.",
                status: res.status,
            },
            { status: 502 }
        );
    }

    const data = await res.json();
    return NextResponse.json(data.tracks?.items ?? []);
}
