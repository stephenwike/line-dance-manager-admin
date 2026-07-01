import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    try {
        const body = await req.json().catch(() => ({}));

        // Only allow updating these fields — kind and eventTypeId are immutable
        const allowed = ["byDay", "nth", "weekday", "startTime", "durationMinutes", "startDate", "endDate", "isActive"];
        const update: Record<string, unknown> = { updatedAt: new Date() };
        for (const key of allowed) {
            if (key in body) update[key] = body[key];
        }

        const db = await getBldDb();
        const res = await db.collection("frequencies").updateOne(
            { _id: new ObjectId(id) },
            { $set: update }
        );

        if (res.matchedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const db = await getBldDb();
    const res = await db.collection("frequencies").deleteOne({ _id: new ObjectId(id) });
    if (res.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}
