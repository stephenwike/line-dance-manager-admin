import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const update: Record<string, unknown> = {};
    if ("copperknobUrl" in body) update.copperknobUrl = body.copperknobUrl ?? null;
    if ("lastImportedAt" in body) update.lastImportedAt = body.lastImportedAt ?? null;

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const db = await getMainDb();
    const result = await db.collection("choreographers").updateOne(
        { _id: id } as never,
        { $set: update }
    );

    if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Choreographer not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}
