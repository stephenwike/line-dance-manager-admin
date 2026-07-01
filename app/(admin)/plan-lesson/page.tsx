"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionButton } from "@/components/ui";
import { parseTime12ToMinutes, computeDurationMinutes, endTimeFromStartAndDuration, isYmd } from "@/lib/time";

// ── Types ────────────────────────────────────────────────────────────────────

interface DanceHit { _id: string; danceName: string; stepsheet: string | null; difficulty: string | null }
interface LessonDraft { id: string; time: string; danceId: string | null; dance: string; level: string; link: string }
interface EventTypeMeta { _id: string; title: string; level: string; price: string; venueId?: string }
interface VenueMeta { _id: string; name: string; address?: string | null; city?: string | null; state?: string | null }

function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function trim(v: string | null | undefined) { return (v ?? "").trim(); }
function nullable(s: string) { const t = s.trim(); return t.length ? t : null; }

// ── Dance search autocomplete ────────────────────────────────────────────────

function DanceSearchInput({ value, disabled, onChange, onPick }: {
    value: string; disabled?: boolean;
    onChange: (v: string) => void;
    onPick: (d: DanceHit) => void;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hits, setHits] = useState<DanceHit[]>([]);
    const latestRef = useRef("");

    useEffect(() => {
        if (disabled) { setHits([]); setOpen(false); return; }
        const q = value.trim();
        latestRef.current = q;
        if (q.length < 2) { setHits([]); setOpen(false); return; }
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await fetch(`/api/admin/bld/dances?q=${encodeURIComponent(q)}`).then((r) => r.json());
                if (latestRef.current !== q) return;
                setHits(Array.isArray(data) ? data : []);
                setOpen(true);
            } finally {
                if (latestRef.current === q) setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [value, disabled]);

    return (
        <div style={{ position: "relative" }}>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={disabled ? "" : "Search dance…"}
                onFocus={() => { if (!disabled && (hits.length > 0)) setOpen(true); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                style={{ ...inputStyle, opacity: disabled ? 0.6 : 1 }}
            />
            {!disabled && (open || loading) && (
                <div style={{ position: "absolute", zIndex: 50, top: "100%", marginTop: 2, width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto" }}>
                    {loading ? (
                        <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>Searching…</p>
                    ) : hits.length === 0 ? (
                        <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>No results</p>
                    ) : hits.map((h) => (
                        <button
                            key={h._id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { onPick(h); setOpen(false); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{h.danceName}</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                {h.difficulty ?? "No level"}{h.stepsheet ? " · has stepsheet" : " · no stepsheet"}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
            {children}
        </label>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────

function PlanLessonInner() {
    const sp = useSearchParams();
    const router = useRouter();

    const eventTypeId = trim(sp.get("eventTypeId"));
    const date = trim(sp.get("date"));
    const initialStart = trim(sp.get("startTime"));
    const durMins = Number(trim(sp.get("durationMinutes")));

    const [startTime, setStartTime] = useState(initialStart);
    const [endTime, setEndTime] = useState(() => {
        const fromQuery = trim(sp.get("endTime"));
        if (fromQuery) return fromQuery;
        if (durMins > 0 && parseTime12ToMinutes(initialStart) !== null) {
            return endTimeFromStartAndDuration(initialStart, durMins);
        }
        return "";
    });

    const [isCancelled, setIsCancelled] = useState(false);
    const [cancelNote, setCancelNote] = useState("");
    const [hasSubstitute, setHasSubstitute] = useState(false);
    const [substituteName, setSubstituteName] = useState("");

    const [lessons, setLessons] = useState<LessonDraft[]>([
        { id: uid(), time: "", danceId: null, dance: "", level: "", link: "" },
    ]);

    const [eventType, setEventType] = useState<EventTypeMeta | null>(null);
    const [venue, setVenue] = useState<VenueMeta | null>(null);
    const [metaLoading, setMetaLoading] = useState(false);

    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (!eventTypeId) return;
        setMetaLoading(true);
        fetch(`/api/admin/bld/event-types/${eventTypeId}`)
            .then((r) => r.json())
            .then(async (et) => {
                setEventType(et);
                if (et?.venueId) {
                    const v = await fetch(`/api/admin/bld/venues/${et.venueId}`).then((r) => r.json()).catch(() => null);
                    setVenue(v ?? null);
                }
            })
            .catch(() => setEventType(null))
            .finally(() => setMetaLoading(false));
    }, [eventTypeId]);

    useEffect(() => { if (isCancelled) { setHasSubstitute(false); setSubstituteName(""); } }, [isCancelled]);
    useEffect(() => { if (!hasSubstitute) setSubstituteName(""); }, [hasSubstitute]);

    const validationErr = useMemo(() => {
        if (!eventTypeId) return "Missing eventTypeId";
        if (!isYmd(date)) return "Missing or invalid date";
        if (parseTime12ToMinutes(startTime) === null) return "Start time must be like '6:30 PM'";
        if (parseTime12ToMinutes(endTime) === null) return "End time must be like '8:00 PM'";
        const dur = computeDurationMinutes(startTime, endTime);
        if (!dur || dur <= 0) return "End time must be after start time";
        if (isCancelled) return null;
        if (hasSubstitute && !nullable(substituteName)) return "Substitute name is required";
        if (lessons.length === 0) return "Add at least one lesson row";
        for (const l of lessons) {
            if (l.time.trim() && parseTime12ToMinutes(l.time) === null) return "Lesson time must be like '6:45 PM'";
        }
        return null;
    }, [eventTypeId, date, startTime, endTime, isCancelled, hasSubstitute, substituteName, lessons]);

    function updateLesson(id: string, patch: Partial<LessonDraft>) {
        setLessons((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
    }
    function addLesson() {
        setLessons((prev) => [...prev, { id: uid(), time: "", danceId: null, dance: "", level: "", link: "" }]);
    }
    function removeLesson(id: string) {
        setLessons((prev) => prev.filter((l) => l.id !== id));
    }

    async function save() {
        if (validationErr) { setErr(validationErr); return; }
        setErr(null);
        setSaving(true);
        try {
            const payload = {
                eventTypeId, date, startTime, endTime,
                isCancelled, cancelNote: nullable(cancelNote),
                substitute: hasSubstitute ? nullable(substituteName) : null,
                lessons: isCancelled ? [] : lessons.map((l) => ({
                    time: nullable(l.time), danceId: l.danceId,
                    dance: nullable(l.dance), level: nullable(l.level), link: nullable(l.link),
                })),
            };
            const res = await fetch("/api/admin/bld/events", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            router.push(`/events/${data.eventId}`);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    const venueLine = venue ? [venue.name, venue.address, venue.city, venue.state].filter(Boolean).join(", ") : null;

    return (
        <div style={{ padding: "32px 36px", maxWidth: 760 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Plan Lesson</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Event details are read-only. Start/end are overrides — only change if this occurrence differs from the schedule.
                </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Event meta */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                    {metaLoading ? (
                        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>
                    ) : (
                        <>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                                {eventType?.title ?? sp.get("title") ?? eventTypeId}
                            </p>
                            {eventType && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>{eventType.level} · {eventType.price}</p>}
                            {venueLine && <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{venueLine}</p>}
                        </>
                    )}
                </div>

                {/* Date & time */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Date: <strong style={{ color: "var(--text-primary)" }}>{date}</strong></p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <Field label="Start time">
                            <input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="6:00 PM" style={inputStyle} />
                        </Field>
                        <Field label="End time">
                            <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="9:00 PM" style={inputStyle} />
                        </Field>
                    </div>
                </div>

                {/* Cancellation & substitute */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
                        <input type="checkbox" checked={isCancelled} onChange={(e) => setIsCancelled(e.target.checked)} />
                        <span style={{ fontWeight: 600 }}>Cancelled</span>
                    </label>
                    {isCancelled && (
                        <Field label="Cancellation note (optional)">
                            <input value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="e.g. Venue closed" style={inputStyle} />
                        </Field>
                    )}
                    {!isCancelled && (
                        <>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
                                <input type="checkbox" checked={hasSubstitute} onChange={(e) => setHasSubstitute(e.target.checked)} />
                                Substitute instructor
                            </label>
                            {hasSubstitute && (
                                <Field label="Substitute name">
                                    <input value={substituteName} onChange={(e) => setSubstituteName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
                                </Field>
                            )}
                        </>
                    )}
                </div>

                {/* Lessons */}
                {!isCancelled && (
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Lessons</p>
                                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Search LDCO dances or type manually. Lesson time is optional.</p>
                            </div>
                            <ActionButton label="+ Add lesson" onClick={addLesson} variant="ghost" />
                        </div>

                        {lessons.map((l, idx) => (
                            <div key={l.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Lesson {idx + 1}</span>
                                    {lessons.length > 1 && (
                                        <button type="button" onClick={() => removeLesson(l.id)} style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr", gap: 8 }}>
                                    <Field label="Time">
                                        <input value={l.time} onChange={(e) => updateLesson(l.id, { time: e.target.value })} placeholder="6:45 PM" style={inputStyle} />
                                    </Field>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dance</span>
                                            {l.danceId && (
                                                <button type="button" onClick={() => updateLesson(l.id, { danceId: null, dance: "", level: "", link: "" })} style={{ fontSize: 11, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <DanceSearchInput
                                            value={l.dance}
                                            disabled={!!l.danceId}
                                            onChange={(v) => updateLesson(l.id, { dance: v })}
                                            onPick={(d) => updateLesson(l.id, { danceId: d._id, dance: d.danceName, level: d.difficulty ?? l.level, link: d.stepsheet ?? l.link })}
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
                )}

                {/* Actions */}
                {err && <p style={{ fontSize: 13, color: "var(--danger)" }}>{err}</p>}
                {validationErr && !err && (
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Fix: {validationErr}</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                    <ActionButton
                        label={saving ? "Saving…" : isCancelled ? "Create cancellation" : "Create & Plan"}
                        onClick={save}
                        loading={saving || !!validationErr}
                    />
                    <ActionButton label="Back" variant="ghost" onClick={() => router.back()} />
                </div>
            </div>
        </div>
    );
}

export default function PlanLessonPage() {
    return (
        <Suspense>
            <PlanLessonInner />
        </Suspense>
    );
}
