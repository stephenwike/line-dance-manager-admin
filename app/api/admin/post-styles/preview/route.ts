import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { callPoster } from "@/lib/poster";

export const maxDuration = 30;

// The class's next post drawn with the style being edited (not saved yet).
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const r = await callPoster("/api/styles/preview", "POST", { eventTypeId: body.eventTypeId, style: body.style });
    if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json(r);
}
