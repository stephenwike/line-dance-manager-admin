"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActionButton, Badge } from "@/components/ui";
import { computeDurationMinutes, parseTime12ToMinutes } from "@/lib/time";

// ── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
    time: string | null;
    danceId: string | null;
    dance: string | null;
    level: string | null;
    link: string | null;
    committed: boolean;
}

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
    const hasLessons = ev.lessons.length > 0;
    if (!hasLessons) return <Badge label="Unplanned" color="orange" />;
    const allCommitted = ev.lessons.every((l) => l.committed);
    if (allCommitted) return <Badge label="Committed" color="green" />;
    const anyCommitted = ev.lessons.some((l) => l.committed);
    if (anyCommitted) return <Badge label="Partially committed" color="orange" />;
    return <Badge label="Planned" color="blue" />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const router = useRouter();

    const [ev, setEv] = useState<EventDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    // Edit mode state
    const [editing, setEditing] = useState(false);
    const [editStart, setEditStart] = useState("");
    const [editEnd, setEditEnd] = useState("");
    const [editCancelled, setEditCancelled] = useState(false);
    const [editCancelNote, setEditCancelNote] = useState("");
    const [editSubstitute, setEditSubstitute] = useState(false);
    const [editSubName, setEditSubName] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);

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
            // error is non-critical, just reload
            await load();
        } finally {
            setCommitting(null);
        }
    }

    const uncommittedCount = ev?.lessons.filter((l) => !l.committed).length ?? 0;

    const rePlanHref = ev ? `/plan-lesson?eventTypeId=${ev.eventTypeId}&date=${ev.date}&startTime=${encodeURIComponent(ev.startTime)}&durationMinutes=${ev.durationMinutes}&title=${encodeURIComponent(ev.eventType?.title ?? "")}` : "#";

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
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
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
                                {ev.isCancelled && (
                                    <p style={{ fontSize: 12, color: "var(--danger)" }}>
                                        Cancelled{ev.cancelNote ? `: ${ev.cancelNote}` : ""}
                                    </p>
                                )}
                                {ev.substitute && (
                                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Substitute: {ev.substitute}</p>
                                )}
                                {ev.eventType && (
                                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{ev.eventType.level} · {ev.eventType.price}</p>
                                )}
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
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Lessons</p>
                                {uncommittedCount > 0 && (
                                    <p style={{ fontSize: 11, color: "var(--warning-text)", marginTop: 2 }}>
                                        {uncommittedCount} uncommitted
                                    </p>
                                )}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                {uncommittedCount > 1 && (
                                    <ActionButton
                                        label={committing === "all" ? "Committing…" : "Commit all"}
                                        loading={committing === "all"}
                                        variant="success"
                                        onClick={() => commitLesson("all")}
                                    />
                                )}
                                <button
                                    onClick={() => router.push(rePlanHref)}
                                    style={{ fontSize: 12, color: "var(--accent-text)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                                >
                                    Re-plan lesson
                                </button>
                            </div>
                        </div>

                        {ev.lessons.length === 0 ? (
                            <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0" }}>
                                No lessons planned. <button onClick={() => router.push(rePlanHref)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-text)", textDecoration: "underline", fontSize: 13 }}>Plan now</button>
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
                                        <div style={{ minWidth: 60, fontSize: 12, color: "var(--text-tertiary)" }}>
                                            {l.time ?? "—"}
                                        </div>
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
                                            <button
                                                onClick={() => commitLesson(i)}
                                                disabled={committing !== null}
                                                style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-text)", background: "var(--accent-subtle)", border: "none", cursor: committing !== null ? "wait" : "pointer", padding: "4px 10px", borderRadius: 20 }}
                                            >
                                                {committing === i ? "…" : "Commit"}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer actions */}
                <div style={{ display: "flex", gap: 8 }}>
                    <ActionButton label="Back" variant="ghost" onClick={() => router.back()} />
                </div>
            </div>
        </div>
    );
}
