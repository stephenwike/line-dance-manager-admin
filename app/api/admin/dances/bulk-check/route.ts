import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { urls } = await req.json().catch(() => ({}));
    if (!Array.isArray(urls)) {
        return NextResponse.json({ error: "urls must be an array" }, { status: 400 });
    }

    const db = await getMainDb();
    const found = await db.collection("dances")
        .find({ stepsheet: { $in: urls } } as never)
        .project({ stepsheet: 1 })
        .toArray();

    const existing = new Set(found.map(d => d.stepsheet as string));
    return NextResponse.json({ existing: Array.from(existing) });
}
