import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";
import { endTimeFromStartAndDuration } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

function clean(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}

function normalizeLessons(input: unknown) {
    if (!Array.isArray(input)) return [];
    return input.map((l) => ({
        time: clean(l?.time),
        danceId: clean(l?.danceId),
        dance: clean(l?.dance),
        level: clean(l?.level),
        link: clean(l?.link),
        committed: typeof l?.committed === "boolean" ? l.committed : false,
    }));
}

export async function GET(_req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const db = await getBldDb();
    const ev = await db.collection("events").findOne({ _id: new ObjectId(id) });
    if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const etId = ev.eventTypeId ? new ObjectId(String(ev.eventTypeId)) : null;
    const [eventType, venue] = await (async () => {
        if (!etId) return [null, null];
        const et = await db.collection("event_types").findOne({ _id: etId });
        if (!et) return [null, null];
        const v = et.venueId ? await db.collection("venues").findOne({ _id: new ObjectId(String(et.venueId)) }) : null;
        return [et, v];
    })();

    const startTime = ev.startTime ?? "";
    const computedEnd = typeof ev.durationMinutes === "number" && ev.durationMinutes > 0
        ? endTimeFromStartAndDuration(startTime, ev.durationMinutes)
        : "";

    return NextResponse.json({
        _id: String(ev._id),
        eventTypeId: ev.eventTypeId ? String(ev.eventTypeId) : "",
        date: ev.date ?? "",
        startTime,
        endTime: ev.endTime ?? computedEnd,
        durationMinutes: ev.durationMinutes ?? 0,
        isCancelled: !!ev.isCancelled,
        cancelNote: ev.cancelNote ?? null,
        substitute: ev.substitute ?? null,
        lessons: Array.isArray(ev.lessons) ? ev.lessons : [],
        eventType: eventType ? { _id: String(eventType._id), title: eventType.title ?? "", level: eventType.level ?? "", price: eventType.price ?? "" } : null,
        venue: venue ? { _id: String(venue._id), name: venue.name ?? "", address: venue.address ?? null, city: venue.city ?? null, state: venue.state ?? null } : null,
    });
}

export async function PATCH(req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    try {
        const body = await req.json().catch(() => ({}));
        const patch: Record<string, unknown> = { updatedAt: new Date() };

        if (typeof body.startTime === "string") patch.startTime = body.startTime.trim();
        if (typeof body.endTime === "string") patch.endTime = body.endTime.trim();
        if (typeof body.isCancelled === "boolean") patch.isCancelled = body.isCancelled;
        if (body.cancelNote === null || typeof body.cancelNote === "string") patch.cancelNote = clean(body.cancelNote);
        if (body.substitute === null || typeof body.substitute === "string") patch.substitute = clean(body.substitute);
        if (body.lessons !== undefined) patch.lessons = normalizeLessons(body.lessons);

        const db = await getBldDb();
        const res = await db.collection("events").updateOne({ _id: new ObjectId(id) }, { $set: patch });
        if (res.matchedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
