import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { callPoster } from "@/lib/poster";

// Each class's post style (theme, photo, wording), from the poster, which owns the themes and photos.
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const r = await callPoster("/api/styles", "GET");
    if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json({ ...r, posterUrl: process.env.WEBHOOKS_URL?.replace(/\/$/, "") ?? null });
}
