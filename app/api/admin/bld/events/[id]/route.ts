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

function lessonTimeToIso(date: string, time: string | null): string {
    if (!time) return `${date}T00:00:00-07:00`;
    const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return `${date}T00:00:00-07:00`;
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    if (m[3].toUpperCase() === "PM" && hh !== 12) hh += 12;
    if (m[3].toUpperCase() === "AM" && hh === 12) hh = 0;
    return `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-07:00`;
}

async function resolveVenueName(db: Awaited<ReturnType<typeof getBldDb>>, eventTypeId: unknown): Promise<string> {
    try {
        const etId = eventTypeId ? new ObjectId(String(eventTypeId)) : null;
        if (!etId) return "Unknown venue";
        const et = await db.collection("event_types").findOne({ _id: etId });
        if (!et?.venueId) return "Unknown venue";
        const venue = await db.collection("venues").findOne({ _id: new ObjectId(String(et.venueId)) });
        return venue?.name ? String(venue.name) : "Unknown venue";
    } catch {
        return "Unknown venue";
    }
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

        const db = await getBldDb();
        const oid = new ObjectId(id);

        if (body.lessons !== undefined) {
            const newLessons = normalizeLessons(body.lessons);
            patch.lessons = newLessons;

            // Read existing event to find which lessons are newly being committed
            const existing = await db.collection("events").findOne(
                { _id: oid },
                { projection: { lessons: 1, eventTypeId: 1, date: 1 } }
            );

            if (existing) {
                const oldLessons = Array.isArray(existing.lessons) ? existing.lessons : [];
                const newlyCommitted = newLessons.filter((l, i) => {
                    const wasCommitted = oldLessons[i]?.committed === true;
                    return l.committed && !wasCommitted && (l.dance || l.danceId);
                });

                if (newlyCommitted.length > 0) {
                    const venueName = await resolveVenueName(db, existing.eventTypeId);
                    const date = String(existing.date ?? "");

                    const lessonDocs = newlyCommitted.map((l) => {
                        const doc: Record<string, unknown> = {
                            venue: venueName,
                            date: lessonTimeToIso(date, l.time),
                        };
                        if (l.danceId) doc.danceId = l.danceId;
                        else doc.danceName = l.dance;
                        return doc;
                    });

                    await db.collection("lessons").insertMany(lessonDocs);
                }
            }
        }

        const res = await db.collection("events").updateOne({ _id: oid }, { $set: patch });
        if (res.matchedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
