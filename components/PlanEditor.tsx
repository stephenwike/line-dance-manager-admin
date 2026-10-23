"use client";

// The one editor for a class's plan on a given date: times, cancellation, substitute, special note and
// lessons (with templates and dance search). Used by the event page, Plan Lesson and Social Posts.
//
// Give it an eventId to edit a stored event, or an eventTypeId + date: it then looks up that day's
// occurrence and edits the stored event if there is one, or creates it on save.

import { useEffect, useMemo, useState } from "react";
import { ActionButton, Badge } from "@/components/ui";
import { DanceSearchInput } from "@/components/DanceSearchInput";
import { Field, inputStyle } from "@/components/form";
import { computeDurationMinutes, endTimeFromStartAndDuration, minutesToTime12, parseTime12ToMinutes } from "@/lib/time";

// ── Types ────────────────────────────────────────────────────────────────────

interface LessonDraft { id: string; time: string; danceId: string | null; dance: string; level: string; link: string; committed: boolean }
interface Draft { startTime: string; endTime: string; isCancelled: boolean; cancelNote: string; substitute: string; specialNote: string; lessons: LessonDraft[] }
interface TemplateLesson { time: string | null; dance: string | null; level: string | null; link: string | null }
interface EventTemplate { _id: string; name: string; isDefault: boolean; lessons: TemplateLesson[] }
interface Venue { name: string; address?: string | null; city?: string | null; state?: string | null }
interface EventDetail {
    _id: string; eventTypeId: string; date: string; startTime: string; endTime: string;
    isCancelled: boolean; cancelNote: string | null; substitute: string | null; specialNote: string | null;
    lessons: { time: string | null; danceId: string | null; dance: string | null; level: string | null; link: string | null; committed: boolean }[];
    eventType: { title: string; level: string; price: string } | null;
    venue: Venue | null;
}
interface Meta { title: string; level: string; price: string; venueLine: string | null }
interface Loaded { id: string | null; typeId: string; day: string; meta: Meta; templates: EventTemplate[]; draft: Draft }

export interface PlanEditorProps {
    /** A stored event to edit. */
    eventId?: string | null;
    /** Or the class and date; the editor finds the stored event or creates one. */
    eventTypeId?: string;
    date?: string;
    /** Overrides for a new event (Plan Lesson's query string); otherwise the occurrence's times. */
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    title?: string;
    /** Show the class, date, venue and status above the form. */
    showHeader?: boolean;
    onSaved?: (eventId: string) => void;
    /** Extra buttons next to Save (e.g. Back). */
    extraActions?: React.ReactNode;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function nullable(s: string) { const t = s.trim(); return t.length ? t : null; }

function blankLesson(time = ""): LessonDraft {
    return { id: uid(), time, danceId: null, dance: "", level: "", link: "", committed: false };
}

function fromTemplate(t: EventTemplate): LessonDraft[] {
    return t.lessons.map((l) => ({ ...blankLesson(l.time ?? ""), dance: l.dance ?? "", level: l.level ?? "", link: l.link ?? "" }));
}

function nextLessonTime(lessons: LessonDraft[], fallback: string): string {
    const last = [...lessons].reverse().find((d) => d.time.trim());
    if (!last) return fallback;
    const mins = parseTime12ToMinutes(last.time);
    return mins !== null ? minutesToTime12(mins + 30) : fallback;
}

function venueLine(v: Venue | null): string | null {
    return v ? [v.name, v.address, v.city, v.state].filter(Boolean).join(", ") : null;
}

function longDate(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function statusBadge(draft: Draft, isNew: boolean) {
    if (isNew) return <Badge label="Not saved yet" color="orange" />;
    if (draft.isCancelled) return <Badge label="Cancelled" color="red" />;
    if (draft.lessons.length === 0) return <Badge label="Unplanned" color="orange" />;
    if (draft.lessons.every((l) => l.committed)) return <Badge label="Committed" color="green" />;
    if (draft.lessons.some((l) => l.committed)) return <Badge label="Partially committed" color="orange" />;
    return <Badge label="Planned" color="blue" />;
}

const cardStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" };

// ── Component ────────────────────────────────────────────────────────────────

export function PlanEditor(props: PlanEditorProps) {
    const [eventId, setEventId] = useState<string | null>(props.eventId ?? null);
    const [eventTypeId, setEventTypeId] = useState(props.eventTypeId ?? "");
    const [date, setDate] = useState(props.date ?? "");
    const [meta, setMeta] = useState<Meta | null>(null);
    const [templates, setTemplates] = useState<EventTemplate[]>([]);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    /** Fetch the stored event (or the occurrence for a new one), its class and its templates. Sets no state. */
    async function fetchPlan(knownEventId: string | null): Promise<Loaded> {
        {
            let id = knownEventId;
            let typeId = props.eventTypeId ?? "";
            let day = props.date ?? "";
            let startTime = props.startTime ?? "";
            let endTime = props.endTime ?? "";

            if (!id && typeId && day) {
                const occs = await fetch(`/api/admin/bld/occurrences?from=${day}&to=${day}`).then((r) => r.json());
                const occ = Array.isArray(occs) ? occs.find((o: { eventTypeId: string }) => o.eventTypeId === typeId) : null;
                id = occ?.eventId ?? null;
                startTime ||= occ?.startTime ?? "";
                endTime ||= occ?.endTime ?? "";
            }

            let next: Draft;
            let nextMeta: Meta;
            if (id) {
                const ev: EventDetail = await fetch(`/api/admin/bld/events/${id}`).then((r) => r.json());
                if ((ev as unknown as { error?: string }).error) throw new Error((ev as unknown as { error: string }).error);
                typeId = ev.eventTypeId;
                day = ev.date;
                next = {
                    startTime: ev.startTime, endTime: ev.endTime, isCancelled: ev.isCancelled,
                    cancelNote: ev.cancelNote ?? "", substitute: ev.substitute ?? "", specialNote: ev.specialNote ?? "",
                    lessons: ev.lessons.map((l) => ({
                        id: uid(), time: l.time ?? "", danceId: l.danceId ?? null, dance: l.dance ?? "",
                        level: l.level ?? "", link: l.link ?? "", committed: l.committed,
                    })),
                };
                nextMeta = { title: ev.eventType?.title ?? "Event", level: ev.eventType?.level ?? "", price: ev.eventType?.price ?? "", venueLine: venueLine(ev.venue) };
            } else {
                if (!typeId || !day) throw new Error("Missing class or date");
                if (!endTime && props.durationMinutes && parseTime12ToMinutes(startTime) !== null) {
                    endTime = endTimeFromStartAndDuration(startTime, props.durationMinutes);
                }
                const et = await fetch(`/api/admin/bld/event-types/${typeId}`).then((r) => r.json()).catch(() => null);
                const venue = et?.venueId ? await fetch(`/api/admin/bld/venues/${et.venueId}`).then((r) => r.json()).catch(() => null) : null;
                next = { startTime, endTime, isCancelled: false, cancelNote: "", substitute: "", specialNote: "", lessons: [] };
                nextMeta = { title: et?.title ?? props.title ?? "Event", level: et?.level ?? "", price: et?.price ?? "", venueLine: venueLine(venue) };
            }

            const tmpls = await fetch(`/api/admin/bld/event-templates?eventTypeId=${typeId}`).then((r) => r.json()).catch(() => []);
            const tmplList: EventTemplate[] = Array.isArray(tmpls) ? tmpls : [];
            if (next.lessons.length === 0) {
                const def = tmplList.find((t) => t.isDefault);
                next.lessons = def ? fromTemplate(def) : id ? [] : [blankLesson()];
            }

            return { id, typeId, day, meta: nextMeta, templates: tmplList, draft: next };
        }
    }

    function apply(r: Loaded) {
        setEventId(r.id);
        setEventTypeId(r.typeId);
        setDate(r.day);
        setMeta(r.meta);
        setTemplates(r.templates);
        setDraft(r.draft);
        setLoadErr(null);
    }
    function fail(e: unknown) {
        setLoadErr(e instanceof Error ? e.message : String(e));
    }
    const load = (knownEventId: string | null) => fetchPlan(knownEventId).then(apply, fail);

    useEffect(() => {
        fetchPlan(props.eventId ?? null).then(apply, fail);
    }, [props.eventId, props.eventTypeId, props.date]); // eslint-disable-line react-hooks/exhaustive-deps

    const validationErr = useMemo(() => {
        if (!draft) return null;
        if (parseTime12ToMinutes(draft.startTime) === null) return "Start time must be like '6:30 PM'";
        if (parseTime12ToMinutes(draft.endTime) === null) return "End time must be like '8:00 PM'";
        const dur = computeDurationMinutes(draft.startTime, draft.endTime);
        if (!dur || dur <= 0) return "End time must be after start time";
        if (draft.isCancelled) return null;
        for (const l of draft.lessons) {
            if (l.time.trim() && parseTime12ToMinutes(l.time) === null) return "Lesson time must be like '6:45 PM'";
        }
        return null;
    }, [draft]);

    function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
        setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
        setSaved(false);
    }
    function updateLesson(lessonId: string, patch: Partial<LessonDraft>) {
        setDraft((prev) => prev ? { ...prev, lessons: prev.lessons.map((l) => l.id === lessonId ? { ...l, ...patch } : l) } : prev);
        setSaved(false);
    }
    function addLesson() {
        setDraft((prev) => prev ? { ...prev, lessons: [...prev.lessons, blankLesson(nextLessonTime(prev.lessons, prev.startTime))] } : prev);
        setSaved(false);
    }
    function removeLesson(lessonId: string) {
        setDraft((prev) => prev ? { ...prev, lessons: prev.lessons.filter((l) => l.id !== lessonId) } : prev);
        setSaved(false);
    }
    function applyTemplate(t: EventTemplate) {
        setField("lessons", fromTemplate(t));
    }

    async function save() {
        if (!draft) return;
        if (validationErr) { setSaveErr(validationErr); return; }
        setSaveErr(null);
        setSaving(true);
        try {
            const lessons = draft.isCancelled ? [] : draft.lessons.map((l) => ({
                time: nullable(l.time), danceId: l.danceId, dance: nullable(l.dance),
                level: nullable(l.level), link: nullable(l.link), committed: l.committed,
            }));
            const common = {
                startTime: draft.startTime.trim(), endTime: draft.endTime.trim(),
                isCancelled: draft.isCancelled,
                cancelNote: draft.isCancelled ? nullable(draft.cancelNote) : null,
                substitute: draft.isCancelled ? null : nullable(draft.substitute),
                specialNote: nullable(draft.specialNote),
                lessons,
            };
            const res = eventId
                ? await fetch(`/api/admin/bld/events/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(common) })
                : await fetch("/api/admin/bld/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventTypeId, date, ...common }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            const savedId = eventId ?? String(data.eventId);
            setSaved(true);
            await load(savedId);
            props.onSaved?.(savedId);
        } catch (e: unknown) {
            setSaveErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    if (loadErr) return <p style={{ fontSize: 13, color: "var(--danger)" }}>{loadErr}</p>;
    if (!draft || !meta) return <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>;
    const isNew = !eventId;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {props.showHeader && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{meta.title}</h1>
                        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>
                            {date && longDate(date)}{meta.venueLine ? ` · ${meta.venueLine}` : ""}
                        </p>
                        {(meta.level || meta.price) && (
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{[meta.level, meta.price].filter(Boolean).join(" · ")}</p>
                        )}
                    </div>
                    {statusBadge(draft, isNew)}
                </div>
            )}

            {/* Event details */}
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Event details</p>
                <div className="grid-2" style={{ gap: 10 }}>
                    <Field label="Start time">
                        <input value={draft.startTime} onChange={(e) => setField("startTime", e.target.value)} placeholder="6:00 PM" style={inputStyle} />
                    </Field>
                    <Field label="End time">
                        <input value={draft.endTime} onChange={(e) => setField("endTime", e.target.value)} placeholder="9:00 PM" style={inputStyle} />
                    </Field>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={draft.isCancelled} onChange={(e) => setField("isCancelled", e.target.checked)} />
                    Cancelled
                </label>
                {draft.isCancelled ? (
                    <Field label="Cancellation note">
                        <input value={draft.cancelNote} onChange={(e) => setField("cancelNote", e.target.value)} placeholder="e.g. Venue closed" style={inputStyle} />
                    </Field>
                ) : (
                    <Field label="Substitute (optional)">
                        <input value={draft.substitute} onChange={(e) => setField("substitute", e.target.value)} placeholder="Substitute instructor name" style={inputStyle} />
                    </Field>
                )}
                <Field label="Special note (optional)">
                    <textarea value={draft.specialNote} onChange={(e) => setField("specialNote", e.target.value)}
                        placeholder="Extra info shown on the website…" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                </Field>
            </div>

            {/* Lessons */}
            {!draft.isCancelled && (
                <div style={cardStyle}>
                    <div style={{ marginBottom: templates.length > 0 ? 10 : 14 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Lessons</p>
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Search LDCO dances or type manually. Lesson time is optional.</p>
                    </div>

                    {templates.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", alignSelf: "center", marginRight: 2 }}>Templates:</span>
                            {templates.map((t) => (
                                <button key={t._id} type="button" onClick={() => applyTemplate(t)}
                                    style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--accent-text)", cursor: "pointer", fontWeight: 500 }}>
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {draft.lessons.length === 0 && (
                        <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "12px 0 4px" }}>No lessons yet. Add one below.</p>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {draft.lessons.map((l, idx) => (
                            <div key={l.id} style={{
                                border: `1px solid ${l.committed ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                                borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
                                background: l.committed ? "var(--success-subtle)" : "var(--surface-raised)",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    {isNew ? (
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Lesson {idx + 1}</span>
                                    ) : (
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                            <input type="checkbox" checked={l.committed} onChange={(e) => updateLesson(l.id, { committed: e.target.checked })} />
                                            <span style={{ fontSize: 12, fontWeight: 600, color: l.committed ? "var(--success-text)" : "var(--text-secondary)" }}>
                                                Lesson {idx + 1}{l.committed ? " · ✓ taught" : ""}
                                            </span>
                                        </label>
                                    )}
                                    <button type="button" onClick={() => removeLesson(l.id)}
                                        style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                        Remove
                                    </button>
                                </div>
                                <div className="lesson-grid">
                                    <Field label="Time">
                                        <input value={l.time} onChange={(e) => updateLesson(l.id, { time: e.target.value })} placeholder="6:45 PM" style={inputStyle} />
                                    </Field>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dance</span>
                                            {l.danceId && (
                                                <button type="button" onClick={() => updateLesson(l.id, { danceId: null, dance: "", level: "", link: "" })}
                                                    style={{ fontSize: 11, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <DanceSearchInput
                                            value={l.dance}
                                            disabled={!!l.danceId}
                                            onChange={(v) => updateLesson(l.id, { dance: v })}
                                            onPick={(hit) => updateLesson(l.id, { danceId: hit._id, dance: hit.danceName, level: hit.difficulty ?? l.level, link: hit.stepsheet ?? l.link })}
                                        />
                                    </div>
                                    <Field label="Level">
                                        <input value={l.level} onChange={(e) => updateLesson(l.id, { level: e.target.value })} placeholder="Absolute Beginner" style={inputStyle} />
                                    </Field>
                                    <Field label="Link">
                                        <input value={l.link} onChange={(e) => updateLesson(l.id, { link: e.target.value })} placeholder="Stepsheet URL" style={inputStyle} />
                                    </Field>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: draft.lessons.length > 0 ? 12 : 0 }}>
                        <ActionButton label="+ Add lesson" variant="ghost" onClick={addLesson} />
                    </div>
                </div>
            )}

            {/* Save */}
            {saveErr && <p style={{ fontSize: 13, color: "var(--danger)" }}>{saveErr}</p>}
            {validationErr && !saveErr && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Fix: {validationErr}</p>}
            {saved && !saveErr && <p style={{ fontSize: 13, color: "var(--success-text)", fontWeight: 600 }}>✓ Saved</p>}
            <div style={{ display: "flex", gap: 8 }}>
                <ActionButton
                    label={saving ? "Saving…" : isNew ? (draft.isCancelled ? "Create cancellation" : "Create & Plan") : "Save"}
                    loading={saving}
                    onClick={save}
                />
                {props.extraActions}
            </div>
        </div>
    );
}
