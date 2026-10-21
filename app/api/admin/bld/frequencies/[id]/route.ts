import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLessonsDb, isId, isMyEventType, to24h } from "@/lib/lessons";

type Ctx = { params: Promise<{ id: string }> };

async function loadMine(id: string) {
    const db = await getLessonsDb();
    const f = await db.collection<{ _id: string; eventTypeId?: string }>("frequencies").findOne({ _id: id }, { projection: { eventTypeId: 1 } });
    if (!f || !f.eventTypeId || !(await isMyEventType(db, String(f.eventTypeId)))) return { db, found: false };
    return { db, found: true };
}

export async function PATCH(req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    try {
        const body = await req.json().catch(() => ({}));

        // Only allow updating these fields — kind and eventTypeId are immutable
        const allowed = ["byDay", "nth", "weekday", "startTime", "durationMinutes", "startDate", "endDate", "isActive"];
        const update: Record<string, unknown> = { updatedAt: new Date() };
        for (const key of allowed) {
            if (key in body) update[key] = body[key];
        }
        if ("startTime" in update) {
            const time24 = to24h(update.startTime);
            if (!time24) return NextResponse.json({ error: "startTime must be like 6:30 PM" }, { status: 400 });
            update.startTime = time24;
        }

        const { db, found } = await loadMine(id);
        if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const res = await db.collection<{ _id: string; [key: string]: unknown }>("frequencies").updateOne({ _id: id }, { $set: update });

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
    if (!isId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { db, found } = await loadMine(id);
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const res = await db.collection<{ _id: string; [key: string]: unknown }>("frequencies").deleteOne({ _id: id });
    if (res.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}
