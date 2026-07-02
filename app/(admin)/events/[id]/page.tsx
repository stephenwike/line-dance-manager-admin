"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActionButton, Badge } from "@/components/ui";
import { computeDurationMinutes, minutesToTime12, parseTime12ToMinutes } from "@/lib/time";

// ── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
    time: string | null;
    danceId: string | null;
    dance: string | null;
    level: string | null;
    link: string | null;
    committed: boolean;
}

interface LessonDraft {
    id: string;
    time: string;
    danceId: string | null;
    dance: string;
    level: string;
    link: string;
    committed: boolean;
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
    lessons: Lesson[];
    eventType: { _id: string; title: string; level: string; price: string } | null;
    venue: { _id: string; name: string; address: string | null; city: string | null; state: string | null } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

function suggestNextTime(drafts: LessonDraft[], eventStartTime: string): string {
    const last = [...drafts].reverse().find((d) => d.time.trim());
    if (!last) return eventStartTime;
    const mins = parseTime12ToMinutes(last.time);
    return mins !== null ? minutesToTime12(mins + 30) : "";
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

function statusBadge(ev: EventDetail) {
    if (ev.isCancelled) return <Badge label="Cancelled" color="red" />;
    if (ev.lessons.length === 0) return <Badge label="Unplanned" color="orange" />;
    if (ev.lessons.every((l) => l.committed)) return <Badge label="Committed" color="green" />;
    if (ev.lessons.some((l) => l.committed)) return <Badge label="Partially committed" color="orange" />;
    return <Badge label="Planned" color="blue" />;
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
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    // Event field edit state
    const [editing, setEditing] = useState(false);
    const [editStart, setEditStart] = useState("");
    const [editEnd, setEditEnd] = useState("");
    const [editCancelled, setEditCancelled] = useState(false);
    const [editCancelNote, setEditCancelNote] = useState("");
    const [editSubstitute, setEditSubstitute] = useState(false);
    const [editSubName, setEditSubName] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);

    // Lesson edit state
    const [editingLessons, setEditingLessons] = useState(false);
    const [lessonDrafts, setLessonDrafts] = useState<LessonDraft[]>([]);
    const [savingLessons, setSavingLessons] = useState(false);
    const [lessonSaveErr, setLessonSaveErr] = useState<string | null>(null);

    const [committing, setCommitting] = useState<"all" | number | null>(null);

    async function load() {
        setLoading(true);
        setLoadErr(null);
        try {
            const data = await fetch(`/api/admin/bld/events/${id}`).then((r) => r.json());
            if (data.error) throw new Error(data.error);
            setEv(data);
        } catch (e: unknown) {
            setLoadErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    function openEdit() {
        if (!ev) return;
        setEditStart(ev.startTime);
        setEditEnd(ev.endTime);
        setEditCancelled(ev.isCancelled);
        setEditCancelNote(ev.cancelNote ?? "");
        setEditSubstitute(!!ev.substitute);
        setEditSubName(ev.substitute ?? "");
        setSaveErr(null);
        setEditing(true);
    }

    async function saveEdit() {
        if (!ev) return;
        if (parseTime12ToMinutes(editStart) === null) { setSaveErr("Invalid start time"); return; }
        if (parseTime12ToMinutes(editEnd) === null) { setSaveErr("Invalid end time"); return; }
        if (!editCancelled) {
            const dur = computeDurationMinutes(editStart, editEnd);
            if (!dur || dur <= 0) { setSaveErr("End time must be after start time"); return; }
        }
        if (editSubstitute && !editSubName.trim()) { setSaveErr("Substitute name required"); return; }
        setSaveErr(null);
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/bld/events/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startTime: editStart.trim(),
                    endTime: editEnd.trim(),
                    isCancelled: editCancelled,
                    cancelNote: editCancelled && editCancelNote.trim() ? editCancelNote.trim() : null,
                    substitute: editSubstitute && editSubName.trim() ? editSubName.trim() : null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setEditing(false);
            await load();
        } catch (e: unknown) {
            setSaveErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    function startEditLessons() {
        if (!ev) return;
        setLessonDrafts(ev.lessons.map((l) => ({
            id: uid(),
            time: l.time ?? "",
            danceId: l.danceId ?? null,
            dance: l.dance ?? "",
            level: l.level ?? "",
            link: l.link ?? "",
            committed: l.committed,
        })));
        setLessonSaveErr(null);
        setEditingLessons(true);
    }

    function updateLessonDraft(draftId: string, patch: Partial<LessonDraft>) {
        setLessonDrafts((prev) => prev.map((d) => d.id === draftId ? { ...d, ...patch } : d));
    }

    function addLessonDraft() {
        const suggested = ev ? suggestNextTime(lessonDrafts, ev.startTime) : "";
        setLessonDrafts((prev) => [...prev, { id: uid(), time: suggested, danceId: null, dance: "", level: "", link: "", committed: false }]);
    }

    function removeLessonDraft(draftId: string) {
        setLessonDrafts((prev) => prev.filter((d) => d.id !== draftId));
    }

    async function saveLessons() {
        setSavingLessons(true);
        setLessonSaveErr(null);
        try {
            const lessons = lessonDrafts.map((d) => ({
                time: d.time.trim() || null,
                danceId: d.danceId,
                dance: d.dance.trim() || null,
                level: d.level.trim() || null,
                link: d.link.trim() || null,
                committed: d.committed,
            }));
            const res = await fetch(`/api/admin/bld/events/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lessons }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setEditingLessons(false);
            await load();
        } catch (e: unknown) {
            setLessonSaveErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSavingLessons(false);
        }
    }

    async function commitLesson(idx: "all" | number) {
        if (!ev) return;
        setCommitting(idx);
        try {
            const updated = ev.lessons.map((l, i) =>
                idx === "all" ? { ...l, committed: true } : i === idx ? { ...l, committed: true } : l
            );
            const res = await fetch(`/api/admin/bld/events/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lessons: updated }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to commit");
            setEv((prev) => prev ? { ...prev, lessons: updated } : prev);
        } catch {
            await load();
        } finally {
            setCommitting(null);
        }
    }

    const uncommittedCount = ev?.lessons.filter((l) => !l.committed).length ?? 0;
    const venueLine = ev?.venue
        ? [ev.venue.name, ev.venue.address, ev.venue.city, ev.venue.state].filter(Boolean).join(", ")
        : null;
    const durMins = ev ? computeDurationMinutes(ev.startTime, ev.endTime) ?? ev.durationMinutes : 0;

    if (loading) {
        return <div style={{ padding: "40px 36px", color: "var(--text-tertiary)", fontSize: 14 }}>Loading…</div>;
    }
    if (loadErr || !ev) {
        return (
            <div style={{ padding: "40px 36px" }}>
                <p style={{ color: "var(--danger)", marginBottom: 12 }}>{loadErr ?? "Event not found"}</p>
                <ActionButton label="Back" variant="ghost" onClick={() => router.back()} />
            </div>
        );
    }

    return (
        <div style={{ padding: "32px 36px", maxWidth: 760 }}>
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
                        {venueLine && <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>{venueLine}</p>}
                    </div>
                    {statusBadge(ev)}
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Event info card */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                    {!editing ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{ev.date}</p>
                                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    {ev.startTime} – {ev.endTime}
                                    {durMins > 0 && <span style={{ color: "var(--text-tertiary)" }}> · {durMins} min</span>}
                                </p>
                                {ev.isCancelled && <p style={{ fontSize: 12, color: "var(--danger)" }}>Cancelled{ev.cancelNote ? `: ${ev.cancelNote}` : ""}</p>}
                                {ev.substitute && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Substitute: {ev.substitute}</p>}
                                {ev.eventType && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{ev.eventType.level} · {ev.eventType.price}</p>}
                            </div>
                            <ActionButton label="Edit" variant="ghost" onClick={openEdit} />
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <Field label="Start time">
                                    <input value={editStart} onChange={(e) => setEditStart(e.target.value)} placeholder="6:00 PM" style={inputStyle} />
                                </Field>
                                <Field label="End time">
                                    <input value={editEnd} onChange={(e) => setEditEnd(e.target.value)} placeholder="9:00 PM" style={inputStyle} />
                                </Field>
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                                <input type="checkbox" checked={editCancelled} onChange={(e) => setEditCancelled(e.target.checked)} />
                                Cancelled
                            </label>
                            {editCancelled && (
                                <Field label="Cancellation note">
                                    <input value={editCancelNote} onChange={(e) => setEditCancelNote(e.target.value)} placeholder="Reason…" style={inputStyle} />
                                </Field>
                            )}
                            {!editCancelled && (
                                <>
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                                        <input type="checkbox" checked={editSubstitute} onChange={(e) => setEditSubstitute(e.target.checked)} />
                                        Substitute instructor
                                    </label>
                                    {editSubstitute && (
                                        <Field label="Substitute name">
                                            <input value={editSubName} onChange={(e) => setEditSubName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
                                        </Field>
                                    )}
                                </>
                            )}
                            {saveErr && <p style={{ fontSize: 13, color: "var(--danger)" }}>{saveErr}</p>}
                            <div style={{ display: "flex", gap: 8 }}>
                                <ActionButton label={saving ? "Saving…" : "Save"} loading={saving} onClick={saveEdit} />
                                <ActionButton label="Cancel" variant="ghost" onClick={() => setEditing(false)} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Lessons */}
                {!ev.isCancelled && (
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                        {/* Lessons header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editingLessons ? 16 : 12 }}>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Lessons</p>
                                {!editingLessons && uncommittedCount > 0 && (
                                    <p style={{ fontSize: 11, color: "var(--warning-text)", marginTop: 2 }}>{uncommittedCount} uncommitted</p>
                                )}
                            </div>
                            {!editingLessons && (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    {uncommittedCount > 1 && (
                                        <ActionButton
                                            label={committing === "all" ? "Committing…" : "Commit all"}
                                            loading={committing === "all"}
                                            variant="success"
                                            onClick={() => commitLesson("all")}
                                        />
                                    )}
                                    <ActionButton label="Edit lessons" variant="ghost" onClick={startEditLessons} />
                                </div>
                            )}
                        </div>

                        {/* Lesson editor */}
                        {editingLessons ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {/* Bulk taught toggle */}
                                {lessonDrafts.length > 0 && (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                            {lessonDrafts.every((d) => d.committed) ? "All lessons marked as taught" : "Mark all as taught"}
                                        </span>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--success-text)" }}>
                                            <input
                                                type="checkbox"
                                                checked={lessonDrafts.every((d) => d.committed)}
                                                onChange={(e) => setLessonDrafts((prev) => prev.map((d) => ({ ...d, committed: e.target.checked })))}
                                            />
                                            All taught
                                        </label>
                                    </div>
                                )}
                                {lessonDrafts.length === 0 && (
                                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "8px 0" }}>No lessons yet. Add one below.</p>
                                )}
                                {lessonDrafts.map((d, idx) => (
                                    <div key={d.id} style={{ border: `1px solid ${d.committed ? "rgba(16,185,129,0.3)" : "var(--border)"}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, background: d.committed ? "var(--success-subtle)" : "var(--surface)" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={d.committed}
                                                    onChange={(e) => updateLessonDraft(d.id, { committed: e.target.checked })}
                                                />
                                                <span style={{ fontSize: 12, fontWeight: 600, color: d.committed ? "var(--success-text)" : "var(--text-secondary)" }}>
                                                    Lesson {idx + 1}{d.committed ? " · ✓ taught" : " · not yet committed"}
                                                </span>
                                            </label>
                                            <button type="button" onClick={() => removeLessonDraft(d.id)}
                                                style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                                Remove
                                            </button>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr", gap: 8 }}>
                                            <Field label="Time">
                                                <input value={d.time} onChange={(e) => updateLessonDraft(d.id, { time: e.target.value })}
                                                    placeholder="6:45 PM" style={inputStyle} />
                                            </Field>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dance</span>
                                                    {d.danceId && (
                                                        <button type="button" onClick={() => updateLessonDraft(d.id, { danceId: null, dance: "", level: "", link: "" })}
                                                            style={{ fontSize: 11, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                                <DanceSearchInput
                                                    value={d.dance}
                                                    disabled={!!d.danceId}
                                                    onChange={(v) => updateLessonDraft(d.id, { dance: v })}
                                                    onPick={(hit) => updateLessonDraft(d.id, {
                                                        danceId: hit._id,
                                                        dance: hit.danceName,
                                                        level: hit.difficulty ?? d.level,
                                                        link: hit.stepsheet ?? d.link,
                                                    })}
                                                />
                                            </div>
                                            <Field label="Level">
                                                <input value={d.level} onChange={(e) => updateLessonDraft(d.id, { level: e.target.value })}
                                                    placeholder="Absolute Beginner" style={inputStyle} />
                                            </Field>
                                            <Field label="Link">
                                                <input value={d.link} onChange={(e) => updateLessonDraft(d.id, { link: e.target.value })}
                                                    placeholder="Stepsheet URL" style={inputStyle} />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                                <div>
                                    <ActionButton label="+ Add lesson" variant="ghost" onClick={addLessonDraft} />
                                </div>
                                {lessonSaveErr && <p style={{ fontSize: 13, color: "var(--danger)" }}>{lessonSaveErr}</p>}
                                <div style={{ display: "flex", gap: 8 }}>
                                    <ActionButton label={savingLessons ? "Saving…" : "Save lessons"} loading={savingLessons} onClick={saveLessons} />
                                    <ActionButton label="Cancel" variant="ghost" onClick={() => setEditingLessons(false)} />
                                </div>
                            </div>
                        ) : (
                            /* Read-only lesson list */
                            ev.lessons.length === 0 ? (
                                <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0" }}>
                                    No lessons planned.{" "}
                                    <button onClick={startEditLessons} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-text)", textDecoration: "underline", fontSize: 13 }}>
                                        Add now
                                    </button>
                                </p>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {ev.lessons.map((l, i) => (
                                        <div key={i} style={{
                                            display: "flex", alignItems: "center", gap: 12,
                                            padding: "10px 12px", borderRadius: 8,
                                            background: l.committed ? "var(--success-subtle)" : "var(--surface-raised)",
                                            border: `1px solid ${l.committed ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                                        }}>
                                            <div style={{ minWidth: 60, fontSize: 12, color: "var(--text-tertiary)" }}>{l.time ?? "—"}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                                    {l.link ? (
                                                        <a href={l.link} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)", textDecoration: "underline" }}>
                                                            {l.dance ?? "Untitled dance"}
                                                        </a>
                                                    ) : (l.dance ?? "Untitled dance")}
                                                </div>
                                                {l.level && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{l.level}</div>}
                                            </div>
                                            {l.committed ? (
                                                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--success-text)", background: "var(--success-subtle)", padding: "3px 8px", borderRadius: 20 }}>
                                                    ✓ Committed
                                                </span>
                                            ) : (
                                                <button onClick={() => commitLesson(i)} disabled={committing !== null}
                                                    style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-text)", background: "var(--accent-subtle)", border: "none", cursor: committing !== null ? "wait" : "pointer", padding: "4px 10px", borderRadius: 20 }}>
                                                    {committing === i ? "…" : "Commit"}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                    <ActionButton label="Back" variant="ghost" onClick={() => router.back()} />
                </div>
            </div>
        </div>
    );
}
