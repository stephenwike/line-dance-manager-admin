import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function clean(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}

function normalizeLessons(input: unknown) {
    if (!Array.isArray(input)) return [];
    return input.map((l) => ({
        time: clean(l?.time),
        dance: clean(l?.dance),
        level: clean(l?.level),
        link: clean(l?.link),
    }));
}

export async function PATCH(req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.name === "string") {
        const n = body.name.trim();
        if (!n) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
        patch.name = n;
    }
    if (body.lessons !== undefined) {
        patch.lessons = normalizeLessons(body.lessons);
    }

    const db = await getBldDb();
    const oid = new ObjectId(id);

    if (body.isDefault === true) {
        patch.isDefault = true;
        const existing = await db.collection("event_templates").findOne({ _id: oid }, { projection: { eventTypeId: 1 } });
        if (existing?.eventTypeId) {
            await db.collection("event_templates").updateMany(
                { eventTypeId: existing.eventTypeId, isDefault: true, _id: { $ne: oid } },
                { $set: { isDefault: false } }
            );
        }
    } else if (body.isDefault === false) {
        patch.isDefault = false;
    }

    const result = await db.collection("event_templates").updateOne({ _id: oid }, { $set: patch });
    if (result.matchedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const db = await getBldDb();
    const result = await db.collection("event_templates").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}
