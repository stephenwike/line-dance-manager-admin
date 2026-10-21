import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLessonsDb, isId, isMyEventType, myEventTypeIds, newId, templateLessonsForPage, templateLessonsFromPage } from "@/lib/lessons";

function clean(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const eventTypeId = searchParams.get("eventTypeId");

    const db = await getLessonsDb();
    const mine = await myEventTypeIds(db);
    const filter: Record<string, unknown> = { eventTypeId: { $in: mine } };
    if (isId(eventTypeId)) filter.eventTypeId = mine.includes(eventTypeId) ? eventTypeId : "__none__";

    const docs = await db.collection("event_templates").find(filter)
        .sort({ eventTypeId: 1, name: 1 })
        .toArray();

    return NextResponse.json(docs.map((d) => ({
        _id: String(d._id),
        eventTypeId: String(d.eventTypeId),
        name: d.name ?? "",
        isDefault: !!d.isDefault,
        lessons: templateLessonsForPage(d.lessons),
    })));
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const eventTypeId = clean(body.eventTypeId);
    const name = clean(body.name);

    if (!eventTypeId || !isId(eventTypeId)) {
        return NextResponse.json({ error: "Invalid eventTypeId" }, { status: 400 });
    }
    if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const db = await getLessonsDb();
    if (!(await isMyEventType(db, eventTypeId))) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

    const isDefault = !!body.isDefault;
    if (isDefault) {
        await db.collection("event_templates").updateMany(
            { eventTypeId, isDefault: true },
            { $set: { isDefault: false } }
        );
    }

    const _id = newId();
    const now = new Date();
    await db.collection<{ _id: string; [key: string]: unknown }>("event_templates").insertOne({
        _id,
        eventTypeId,
        name,
        isDefault,
        lessons: templateLessonsFromPage(body.lessons),
        createdAt: now,
        updatedAt: now,
    });

    return NextResponse.json({ ok: true, _id });
}
