import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { callPoster } from "@/lib/poster";

type Ctx = { params: Promise<{ id: string }> };

// Facebook's stored copy of a published post (image and caption), via the poster. Hidden test posts
// can't be opened on Facebook itself, so this is how to see them.
export async function GET(_req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const r = await callPoster(`/api/posts/${encodeURIComponent(id)}/facebook`, "GET");
    if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json(r);
}
