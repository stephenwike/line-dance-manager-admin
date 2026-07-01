import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSpotifyAccessToken } from "@/lib/spotify";

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Track ID is required." }, { status: 400 });

    const token = await getSpotifyAccessToken();
    const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    if (!res.ok) {
        return NextResponse.json({ error: "Track not found." }, { status: res.status });
    }

    return NextResponse.json(await res.json());
}
