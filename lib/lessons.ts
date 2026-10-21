import { ObjectId, type Db } from "mongodb";
import { getDb, getMainDb } from "@/lib/db";

// Stephen's schedule lives in ldco-lessons, the database every instructor shares (ldco-database decisions
// 18 and 19). These BLD pages are Stephen's: they show and change only the event types linked to his
// instructor id in event_instructors, and every event type they create is linked to him as its creator.
//
// The pages keep sending and reading "5:00 PM" times and the old field shapes; the routes translate:
// recurring rules are stored as 24-hour local "HH:mm", dated things as UTC Dates plus the venue's zone.

export const BLD_INSTRUCTOR_ID = process.env.BLD_INSTRUCTOR_ID ?? "f5e37f5a-e74e-4d68-985e-397b00c2f09b";
/** Stephen's user id, recorded as verifiedBy when his activity here validates something (decision 17). */
export const BLD_USER_ID = process.env.BLD_USER_ID ?? "66919a36bfcd4d848099f2ba";
export const DEFAULT_TIME_ZONE = "America/Denver";

export async function getLessonsDb(): Promise<Db> {
    return getDb(process.env.LESSONS_DB_NAME ?? "ldco-lessons");
}

export function newId(): string {
    return new ObjectId().toHexString();
}

/** Ids are strings in ldco-lessons (decision 5). */
export function isId(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0 && v.length <= 100;
}

// ── who owns what ──────────────────────────────────────────────────────────

export async function myEventTypeIds(db: Db): Promise<string[]> {
    const links = await db.collection("event_instructors")
        .find({ instructorId: BLD_INSTRUCTOR_ID, eventTypeId: { $exists: true } }, { projection: { eventTypeId: 1 } })
        .toArray();
    return links.map((l) => String(l.eventTypeId));
}

export async function isMyEventType(db: Db, eventTypeId: string): Promise<boolean> {
    return !!(await db.collection("event_instructors").findOne({ instructorId: BLD_INSTRUCTOR_ID, eventTypeId }, { projection: { _id: 1 } }));
}

/** Links a new event type to Stephen as its creator, so it shows on his site and dashboard. */
export async function linkAsCreator(db: Db, eventTypeId: string): Promise<void> {
    await db.collection<{ _id: string; [key: string]: unknown }>("event_instructors").updateOne(
        { instructorId: BLD_INSTRUCTOR_ID, eventTypeId },
        { $setOnInsert: { _id: newId(), instructorId: BLD_INSTRUCTOR_ID, eventTypeId, role: "creator", createdAt: new Date() } },
        { upsert: true },
    );
}

// ── venues ─────────────────────────────────────────────────────────────────

export async function venueTimeZone(venueId: unknown): Promise<string> {
    if (!venueId) return DEFAULT_TIME_ZONE;
    const v = await (await getMainDb()).collection<{ _id: string; timeZone?: string }>("venues")
        .findOne({ _id: String(venueId) }, { projection: { timeZone: 1 } });
    return v?.timeZone || DEFAULT_TIME_ZONE;
}

// ── times ──────────────────────────────────────────────────────────────────

/** "5:00 PM" or "17:00" -> minutes after midnight; null if neither. */
export function parseTimeToMinutes(value: unknown): number | null {
    const s = String(value ?? "").trim();
    let m = s.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (m) {
        let h = Number(m[1]) % 12;
        if (m[3].toUpperCase() === "PM") h += 12;
        return h * 60 + Number(m[2]);
    }
    m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
    return null;
}

export function minutesTo12h(minutes: number): string {
    const m = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function minutesTo24h(minutes: number): string {
    const m = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Stored "17:00" -> "5:00 PM" for the pages; empty stays "". */
export function to12h(value: unknown): string {
    const m = parseTimeToMinutes(value);
    return m === null ? "" : minutesTo12h(m);
}

/** Incoming "5:00 PM" (or "17:00") -> stored "17:00"; null if empty or unparsable. */
export function to24h(value: unknown): string | null {
    const m = parseTimeToMinutes(value);
    return m === null ? null : minutesTo24h(m);
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsAt(date: Date, timeZone: string) {
    let f = formatters.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat("en-US", {
            timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        });
        formatters.set(timeZone, f);
    }
    return Object.fromEntries(f.formatToParts(date).map((p) => [p.type, Number(p.value)])) as Record<string, number>;
}

function offsetMs(instant: number, timeZone: string): number {
    const p = partsAt(new Date(instant), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000;
}

/** A local date plus minutes after midnight (may run past 24h) as a UTC instant. */
export function wallToUtc(ymd: string, minutes: number, timeZone: string): Date {
    const [y, mo, d] = ymd.split("-").map(Number);
    const wall = Date.UTC(y, mo - 1, d, 0, minutes);
    let instant = wall - offsetMs(wall, timeZone);
    instant = wall - offsetMs(instant, timeZone);
    return new Date(instant);
}

/** A UTC instant as the local date and minutes after midnight. */
export function utcToWall(date: Date, timeZone: string): { ymd: string; minutes: number } {
    const p = partsAt(new Date(date), timeZone);
    return {
        ymd: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
        minutes: p.hour * 60 + p.minute,
    };
}

export function daysBetween(fromYmd: string, toYmd: string): number {
    return Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);
}

/** A UTC instant as a local ISO string with its offset, e.g. "2026-10-14T19:15:00-06:00". */
export function localIso(date: Date, timeZone: string): string {
    const d = new Date(date);
    const p = partsAt(d, timeZone);
    const off = Math.round(offsetMs(d.getTime(), timeZone) / 60000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${off < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

/** Start and end instants for a local date with "5:00 PM"-style times; an end not after the start runs into the next day (endDayOffset days). */
export function eventInstants(date: string, startTime: unknown, endTime: unknown, timeZone: string, endDayOffset?: number) {
    const s = parseTimeToMinutes(startTime);
    const e = parseTimeToMinutes(endTime);
    if (s === null || e === null) return null;
    const days = typeof endDayOffset === "number" && endDayOffset > 0 ? endDayOffset : e <= s ? 1 : 0;
    return { startAt: wallToUtc(date, s, timeZone), endAt: wallToUtc(date, e + days * 1440, timeZone) };
}

// ── events and their lessons ───────────────────────────────────────────────

export type StoredLesson = {
    _id: string; startAt: Date | null; dance: string | null; danceId: string | null;
    level: string | null; link: string | null; committed: boolean; skipped: boolean;
};

export type StoredEvent = {
    _id: string; eventTypeId?: string; date: string; startAt: Date; endAt: Date; timeZone?: string;
    isCancelled?: boolean; cancelNote?: string | null; substitute?: string | null; substituteInstructorId?: string | null;
    specialNote?: string | null; lessons?: StoredLesson[]; venueId?: string; title?: string;
};

/** A stored lesson the way the admin pages read it ({ time: "5:30 PM", dance, ... }). */
export function lessonForPage(l: StoredLesson, timeZone: string) {
    return {
        time: l.startAt ? minutesTo12h(utcToWall(l.startAt, timeZone).minutes) : null,
        danceId: l.danceId ?? null,
        dance: l.dance ?? null,
        level: l.level ?? null,
        link: l.link ?? null,
        committed: !!l.committed,
    };
}

/** A stored event's times the way the admin pages read them. */
export function eventTimesForPage(ev: StoredEvent) {
    const tz = ev.timeZone || DEFAULT_TIME_ZONE;
    const start = utcToWall(ev.startAt, tz);
    const end = utcToWall(ev.endAt, tz);
    return {
        startTime: minutesTo12h(start.minutes),
        endTime: minutesTo12h(end.minutes),
        endDayOffset: daysBetween(ev.date, end.ymd),
        durationMinutes: Math.round((new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000),
    };
}

function cleanText(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
}

/**
 * Lessons from the pages ({ time: "5:30 PM", dance, ... }, edited by position) as stored lessons. Each keeps
 * the _id and skipped flag of the lesson in the same position, so history links stay stable. A time earlier
 * than the event's start belongs to the following day (events that run past midnight).
 */
export function lessonsFromPage(input: unknown, ev: Pick<StoredEvent, "date" | "startAt" | "endAt" | "timeZone">, existing: StoredLesson[] = []): StoredLesson[] {
    if (!Array.isArray(input)) return [];
    const tz = ev.timeZone || DEFAULT_TIME_ZONE;
    const startMin = utcToWall(ev.startAt, tz).minutes;
    const spansMidnight = utcToWall(ev.endAt, tz).ymd !== ev.date;
    return input.map((l, i) => {
        const t = parseTimeToMinutes(l?.time);
        const minutes = t === null ? null : t < startMin && spansMidnight ? t + 1440 : t;
        return {
            _id: existing[i]?._id ?? newId(),
            startAt: minutes === null ? null : wallToUtc(ev.date, minutes, tz),
            dance: cleanText(l?.dance),
            danceId: cleanText(l?.danceId),
            level: cleanText(l?.level),
            link: cleanText(l?.link),
            committed: typeof l?.committed === "boolean" ? l.committed : false,
            skipped: existing[i]?.skipped ?? false,
        };
    });
}

/**
 * Writes history (ldco-lessons.lessons) for lessons marked taught, keyed on the lesson's _id so re-saving
 * never duplicates. The venue's name is kept as text, as bld always did, plus its id.
 */
export async function recordTaught(db: Db, ev: StoredEvent, lessons: StoredLesson[], venueId: string | null, venueName: string) {
    const col = db.collection("lessons");
    for (const l of lessons) {
        if (!l.committed || (!l.danceId && !l.dance)) continue;
        await col.updateOne(
            { lessonId: l._id },
            {
                $set: {
                    ...(l.danceId ? { danceId: l.danceId } : { danceName: l.dance }),
                    venue: venueName,
                    date: l.startAt ?? ev.startAt,
                    instructorId: BLD_INSTRUCTOR_ID,
                    venueId,
                    eventId: ev._id,
                },
                $unset: l.danceId ? { danceName: "" } : { danceId: "" },
                $setOnInsert: { _id: newId(), lessonId: l._id },
            },
            { upsert: true },
        );
    }
}

// ── lesson-plan templates ───────────────────────────────────────────────────

// Lesson plans store 24-hour local times; the pages send and read "5:00 PM".
export function templateLessonsFromPage(input: unknown) {
    if (!Array.isArray(input)) return [];
    return input.map((l) => ({
        time: to24h(l?.time),
        dance: cleanText(l?.dance),
        level: cleanText(l?.level),
        link: cleanText(l?.link),
    }));
}

export function templateLessonsForPage(lessons: unknown) {
    return (Array.isArray(lessons) ? lessons : []).map((l) => ({ ...l, time: l?.time ? to12h(l.time) : null }));
}
