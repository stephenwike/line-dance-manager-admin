import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLessonsDb, isId, isMyEventType, templateLessonsFromPage } from "@/lib/lessons";

type Ctx = { params: Promise<{ id: string }> };

async function loadMine(id: string) {
    const db = await getLessonsDb();
    const t = await db.collection<{ _id: string; eventTypeId?: string }>("event_templates").findOne({ _id: id }, { projection: { eventTypeId: 1 } });
    if (!t || !t.eventTypeId || !(await isMyEventType(db, String(t.eventTypeId)))) return { db, template: null };
    return { db, template: t };
}

export async function PATCH(req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.name === "string") {
        const n = body.name.trim();
        if (!n) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
        patch.name = n;
    }
    if (body.lessons !== undefined) {
        patch.lessons = templateLessonsFromPage(body.lessons);
    }

    const { db, template } = await loadMine(id);
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.isDefault === true) {
        patch.isDefault = true;
        await db.collection<{ _id: string; [key: string]: unknown }>("event_templates").updateMany(
            { eventTypeId: template.eventTypeId, isDefault: true, _id: { $ne: id } },
            { $set: { isDefault: false } }
        );
    } else if (body.isDefault === false) {
        patch.isDefault = false;
    }

    const result = await db.collection<{ _id: string; [key: string]: unknown }>("event_templates").updateOne({ _id: id }, { $set: patch });
    if (result.matchedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { db, template } = await loadMine(id);
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = await db.collection<{ _id: string; [key: string]: unknown }>("event_templates").deleteOne({ _id: id });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}
