import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";
import { isYmd } from "@/lib/time";

// GET /api/admin/bld/commit-lessons?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns events in range that have at least one uncommitted lesson
export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";

    if (!isYmd(from) || !isYmd(to)) {
        return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
    }

    const db = await getBldDb();

    const events = await db.collection("events").find({
        date: { $gte: from, $lte: to },
        isCancelled: { $ne: true },
        "lessons.committed": false,
    }).sort({ date: 1, startTime: 1 }).toArray();

    if (events.length === 0) return NextResponse.json([]);

    // Join event types in one query
    const etIds = [...new Set(events.map((e) => String(e.eventTypeId)).filter(Boolean))];
    const etDocs = await db.collection("event_types").find({
        _id: { $in: etIds.map((id) => new ObjectId(id)) }
    }).toArray();
    const etMap = Object.fromEntries(etDocs.map((e) => [String(e._id), e]));

    return NextResponse.json(events.map((ev) => {
        const et = etMap[String(ev.eventTypeId)] ?? null;
        const lessons = Array.isArray(ev.lessons) ? ev.lessons : [];
        return {
            _id: String(ev._id),
            eventTypeId: String(ev.eventTypeId ?? ""),
            date: ev.date ?? "",
            startTime: ev.startTime ?? "",
            endTime: ev.endTime ?? "",
            lessons: lessons.map((l: Record<string, unknown>) => ({
                time: l.time ?? null,
                danceId: l.danceId ?? null,
                dance: l.dance ?? null,
                level: l.level ?? null,
                link: l.link ?? null,
                committed: !!l.committed,
            })),
            eventType: et ? { _id: String(et._id), title: et.title ?? "", level: et.level ?? "" } : null,
        };
    }));
}

// POST /api/admin/bld/commit-lessons
// Body: { eventId: string }  — commits all uncommitted lessons for that event
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const eventId = String(body.eventId ?? "").trim();

        if (!ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
        }

        const db = await getBldDb();
        const oid = new ObjectId(eventId);

        const ev = await db.collection("events").findOne({ _id: oid }, { projection: { lessons: 1 } });
        if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        const lessons = (Array.isArray(ev.lessons) ? ev.lessons : []).map(
            (l: Record<string, unknown>) => ({ ...l, committed: true })
        );

        await db.collection("events").updateOne(
            { _id: oid },
            { $set: { lessons, updatedAt: new Date() } }
        );

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
