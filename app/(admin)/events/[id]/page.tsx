"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActionButton, Badge } from "@/components/ui";
import { computeDurationMinutes, minutesToTime12, parseTime12ToMinutes } from "@/lib/time";

// ── Types ────────────────────────────────────────────────────────────────────

interface LessonDraft {
    id: string;
    time: string;
    danceId: string | null;
    dance: string;
    level: string;
    link: string;
    committed: boolean;
}

interface EventDraft {
    startTime: string;
    endTime: string;
    isCancelled: boolean;
    cancelNote: string;
    substitute: string;
    lessons: LessonDraft[];
}

interface DanceHit { _id: string; danceName: string; stepsheet: string | null; difficulty: string | null }

interface EventDetail {
    _id: string;
    eventTypeId: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isCancelled: boolean;
    cancelNote: string | null;
    substitute: string | null;
    lessons: { time: string | null; danceId: string | null; dance: string | null; level: string | null; link: string | null; committed: boolean }[];
    eventType: { _id: string; title: string; level: string; price: string } | null;
    venue: { _id: string; name: string; address: string | null; city: string | null; state: string | null } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

function nextLessonTime(lessons: LessonDraft[], fallback: string): string {
    const last = [...lessons].reverse().find((d) => d.time.trim());
    if (!last) return fallback;
    const mins = parseTime12ToMinutes(last.time);
    return mins !== null ? minutesToTime12(mins + 30) : fallback;
}

function normalizeDraft(ev: EventDetail): EventDraft {
    return {
        startTime: ev.startTime,
        endTime: ev.endTime,
        isCancelled: ev.isCancelled,
        cancelNote: ev.cancelNote ?? "",
        substitute: ev.substitute ?? "",
        lessons: ev.lessons.map((l) => ({
            id: uid(),
            time: l.time ?? "",
            danceId: l.danceId ?? null,
            dance: l.dance ?? "",
            level: l.level ?? "",
            link: l.link ?? "",
            committed: l.committed,
        })),
    };
}

function statusLabel(draft: EventDraft | null, ev: EventDetail | null) {
    if (!draft || !ev) return null;
    if (draft.isCancelled) return <Badge label="Cancelled" color="red" />;
    if (draft.lessons.length === 0) return <Badge label="Unplanned" color="orange" />;
    if (draft.lessons.every((l) => l.committed)) return <Badge label="Committed" color="green" />;
    if (draft.lessons.some((l) => l.committed)) return <Badge label="Partially committed" color="orange" />;
    return <Badge label="Planned" color="blue" />;
}

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
                onFocus={() => { if (!disabled && hits.length > 0) setOpen(true); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                style={{ ...inputStyle, opacity: disabled ? 0.6 : 1 }}
            />
            {!disabled && (open || loading) && (
                <div style={{ position: "absolute", zIndex: 50, top: "100%", marginTop: 2, width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                    {loading ? (
                        <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>Searching…</p>
                    ) : hits.length === 0 ? (
                        <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>No results</p>
                    ) : hits.map((h) => (
                        <button key={h._id} type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { onPick(h); setOpen(false); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{h.danceName}</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                {h.difficulty ?? "No level"}{h.stepsheet ? " · has stepsheet" : ""}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const router = useRouter();

    const [ev, setEv] = useState<EventDetail | null>(null);
    const [draft, setDraft] = useState<EventDraft | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    async function load() {
        setLoading(true);
        setLoadErr(null);
        try {
            const data = await fetch(`/api/admin/bld/events/${id}`).then((r) => r.json());
            if (data.error) throw new Error(data.error);
            setEv(data);
            setDraft(normalizeDraft(data));
        } catch (e: unknown) {
            setLoadErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    function setField<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
        setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
        setSaved(false);
    }

    function updateLesson(lessonId: string, patch: Partial<LessonDraft>) {
        setDraft((prev) => {
            if (!prev) return prev;
            return { ...prev, lessons: prev.lessons.map((l) => l.id === lessonId ? { ...l, ...patch } : l) };
        });
        setSaved(false);
    }

    function addLesson() {
        setDraft((prev) => {
            if (!prev) return prev;
            const time = nextLessonTime(prev.lessons, prev.startTime);
            return { ...prev, lessons: [...prev.lessons, { id: uid(), time, danceId: null, dance: "", level: "", link: "", committed: false }] };
        });
        setSaved(false);
    }

    function removeLesson(lessonId: string) {
        setDraft((prev) => prev ? { ...prev, lessons: prev.lessons.filter((l) => l.id !== lessonId) } : prev);
        setSaved(false);
    }

    async function save() {
        if (!draft) return;
        if (parseTime12ToMinutes(draft.startTime) === null) { setSaveErr("Invalid start time"); return; }
        if (parseTime12ToMinutes(draft.endTime) === null) { setSaveErr("Invalid end time"); return; }
        if (!draft.isCancelled) {
            const dur = computeDurationMinutes(draft.startTime, draft.endTime);
            if (!dur || dur <= 0) { setSaveErr("End time must be after start time"); return; }
        }
        setSaveErr(null);
        setSaving(true);
        try {
            const lessons = draft.lessons.map((l) => ({
                time: l.time.trim() || null,
                danceId: l.danceId,
                dance: l.dance.trim() || null,
                level: l.level.trim() || null,
                link: l.link.trim() || null,
                committed: l.committed,
            }));
            const res = await fetch(`/api/admin/bld/events/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startTime: draft.startTime.trim(),
                    endTime: draft.endTime.trim(),
                    isCancelled: draft.isCancelled,
                    cancelNote: draft.isCancelled && draft.cancelNote.trim() ? draft.cancelNote.trim() : null,
                    substitute: !draft.isCancelled && draft.substitute.trim() ? draft.substitute.trim() : null,
                    lessons,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setSaved(true);
            await load();
        } catch (e: unknown) {
            setSaveErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    const venueLine = ev?.venue
        ? [ev.venue.name, ev.venue.address, ev.venue.city, ev.venue.state].filter(Boolean).join(", ")
        : null;

    if (loading) {
        return <div style={{ padding: "40px 36px", color: "var(--text-tertiary)", fontSize: 14 }}>Loading…</div>;
    }
    if (loadErr || !ev || !draft) {
        return (
            <div style={{ padding: "40px 36px" }}>
                <p style={{ color: "var(--danger)", marginBottom: 12 }}>{loadErr ?? "Event not found"}</p>
                <ActionButton label="Back" variant="ghost" onClick={() => router.back()} />
            </div>
        );
    }


    return (
        <div className="page-pad" style={{ maxWidth: 760 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 10 }}>
                    <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", padding: 0, textDecoration: "underline" }}>← Back</button>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                            {ev.eventType?.title ?? "Event"}
                        </h1>
                        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>
                            {ev.date}
                            {venueLine ? ` · ${venueLine}` : ""}
                        </p>
                    </div>
                    {statusLabel(draft, ev)}
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Event details */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
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
                    {draft.isCancelled && (
                        <Field label="Cancellation note">
                            <input value={draft.cancelNote} onChange={(e) => setField("cancelNote", e.target.value)} placeholder="Reason…" style={inputStyle} />
                        </Field>
                    )}
                    {!draft.isCancelled && (
                        <Field label="Substitute (optional)">
                            <input value={draft.substitute} onChange={(e) => setField("substitute", e.target.value)} placeholder="Substitute instructor name" style={inputStyle} />
                        </Field>
                    )}
                </div>

                {/* Lessons */}
                {!draft.isCancelled && (
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ marginBottom: 14 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Lessons</p>
                        </div>

                        {draft.lessons.length === 0 && (
                            <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "12px 0 4px" }}>
                                No lessons yet. Add one below.
                            </p>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {draft.lessons.map((l, idx) => (
                                <div key={l.id} style={{
                                    border: `1px solid ${l.committed ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                                    borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
                                    background: l.committed ? "var(--success-subtle)" : "var(--surface-raised)",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                            <input
                                                type="checkbox"
                                                checked={l.committed}
                                                onChange={(e) => updateLesson(l.id, { committed: e.target.checked })}
                                            />
                                            <span style={{ fontSize: 12, fontWeight: 600, color: l.committed ? "var(--success-text)" : "var(--text-secondary)" }}>
                                                Lesson {idx + 1}{l.committed ? " · ✓ taught" : ""}
                                            </span>
                                        </label>
                                        <button type="button" onClick={() => removeLesson(l.id)}
                                            style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                            Remove
                                        </button>
                                    </div>
                                    <div className="lesson-grid">
                                        <Field label="Time">
                                            <input value={l.time} onChange={(e) => updateLesson(l.id, { time: e.target.value })}
                                                placeholder="6:45 PM" style={inputStyle} />
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
                                                onPick={(hit) => updateLesson(l.id, {
                                                    danceId: hit._id,
                                                    dance: hit.danceName,
                                                    level: hit.difficulty ?? l.level,
                                                    link: hit.stepsheet ?? l.link,
                                                })}
                                            />
                                        </div>
                                        <Field label="Level">
                                            <input value={l.level} onChange={(e) => updateLesson(l.id, { level: e.target.value })}
                                                placeholder="Absolute Beginner" style={inputStyle} />
                                        </Field>
                                        <Field label="Link">
                                            <input value={l.link} onChange={(e) => updateLesson(l.id, { link: e.target.value })}
                                                placeholder="Stepsheet URL" style={inputStyle} />
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
                {saved && !saveErr && (
                    <p style={{ fontSize: 13, color: "var(--success-text)", fontWeight: 600 }}>✓ Saved</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                    <ActionButton label={saving ? "Saving…" : "Save"} loading={saving} onClick={save} />
                    <ActionButton label="Back" variant="ghost" onClick={() => router.back()} />
                </div>
            </div>
        </div>
    );
}
