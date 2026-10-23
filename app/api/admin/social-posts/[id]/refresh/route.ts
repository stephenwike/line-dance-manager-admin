import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { callPoster } from "@/lib/poster";

type Ctx = { params: Promise<{ id: string }> };

// After a plan is saved from Social Posts: have the poster redraft this post now (it never publishes here).
export async function POST(_req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const r = await callPoster(`/api/posts/${encodeURIComponent(id)}/refresh`);
    if (r.error) return NextResponse.json({ error: `${r.error}; the post updates on the next tick` }, { status: 502 });
    return NextResponse.json(r);
}
