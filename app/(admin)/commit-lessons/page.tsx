"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface Lesson { time: string | null; dance: string | null; level: string | null; link: string | null; committed: boolean }
interface EventRow { _id: string; eventTypeId: string; date: string; startTime: string; endTime: string; lessons: Lesson[]; eventType: { title: string; level: string } | null }

// ── Helpers ──────────────────────────────────────────────────────────────────

function yesterdayYmd() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}
function daysAgoYmd(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}
function formatDate(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Main ─────────────────────────────────────────────────────────────────────

function MarkTaughtInner() {
    const [from, setFrom] = useState(daysAgoYmd(7));
    const [to, setTo] = useState(yesterdayYmd);

    const [rows, setRows] = useState<EventRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [marking, setMarking] = useState<string | null>(null);
    const [markedTaught, setMarkedTaught] = useState<Set<string>>(new Set());

    async function load() {
        setLoading(true);
        setLoadErr(null);
        setRows(null);
        setMarkedTaught(new Set());
        try {
            const data = await fetch(`/api/admin/bld/commit-lessons?from=${from}&to=${to}`).then((r) => r.json());
            if (data.error) throw new Error(data.error);
            setRows(Array.isArray(data) ? data : []);
        } catch (e: unknown) {
            setLoadErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    async function markTaught(eventId: string) {
        setMarking(eventId);
        try {
            const res = await fetch("/api/admin/bld/commit-lessons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            setMarkedTaught((prev) => new Set([...prev, eventId]));
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setMarking(null);
        }
    }

    const pendingRows = rows?.filter((r) => !markedTaught.has(r._id)) ?? [];
    const doneRows = rows?.filter((r) => markedTaught.has(r._id)) ?? [];

    return (
        <div className="page-pad" style={{ maxWidth: 760 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Mark as Taught</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Shows past events that have lessons not yet marked as taught. Open an event to mark individual lessons,
                    or use "Mark all taught" to bulk-mark everything.
                </p>
            </div>

            {/* Date range filter */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <div className="grid-2-auto" style={{ gap: 10, alignItems: "flex-end" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>From</span>
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                            style={{ padding: "7px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", outline: "none" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>To</span>
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                            style={{ padding: "7px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", outline: "none" }} />
                    </label>
                    <ActionButton label={loading ? "Loading…" : "Load"} loading={loading} onClick={load} />
                </div>
            </div>

            {loadErr && <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{loadErr}</p>}

            {rows !== null && (
                <>
                    {pendingRows.length === 0 && doneRows.length === 0 && (
                        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary)", fontSize: 14 }}>
                            No events with untaught lessons in this range.
                        </div>
                    )}

                    {pendingRows.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {pendingRows.map((ev) => {
                                const untaught = ev.lessons.filter((l) => !l.committed);
                                const isMarking = marking === ev._id;
                                return (
                                    <div key={ev._id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                                        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <div>
                                                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                                                    {ev.eventType?.title ?? ev.eventTypeId}
                                                </p>
                                                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                                                    {formatDate(ev.date)} · {ev.startTime} – {ev.endTime}
                                                    {ev.eventType?.level && <span style={{ color: "var(--text-tertiary)" }}> · {ev.eventType.level}</span>}
                                                </p>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ fontSize: 11, color: "var(--warning-text)", background: "var(--warning-subtle)", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>
                                                    {untaught.length} not taught
                                                </span>
                                                <ActionButton
                                                    label={isMarking ? "Marking…" : "Mark all taught"}
                                                    loading={isMarking}
                                                    variant="success"
                                                    onClick={() => markTaught(ev._id)}
                                                />
                                                <Link href={`/events/${ev._id}`} style={{ fontSize: 12, color: "var(--accent-text)", textDecoration: "underline" }}>
                                                    Open ↗
                                                </Link>
                                            </div>
                                        </div>

                                        <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                                            {ev.lessons.map((l, i) => (
                                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 6, background: l.committed ? "var(--success-subtle)" : "var(--surface-raised)", opacity: l.committed ? 0.7 : 1 }}>
                                                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", minWidth: 55 }}>{l.time ?? "—"}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                                                            {l.link ? (
                                                                <a href={l.link} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)", textDecoration: "underline" }}>
                                                                    {l.dance ?? "Dance"}
                                                                </a>
                                                            ) : (l.dance ?? "Dance")}
                                                        </span>
                                                        {l.level && <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>{l.level}</span>}
                                                    </div>
                                                    {l.committed ? (
                                                        <span style={{ fontSize: 11, color: "var(--success-text)", fontWeight: 600 }}>✓ taught</span>
                                                    ) : (
                                                        <span style={{ fontSize: 11, color: "var(--warning-text)" }}>not taught</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {doneRows.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                                Marked taught this session ({doneRows.length})
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {doneRows.map((ev) => (
                                    <div key={ev._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "var(--success-subtle)", border: "1px solid rgba(16,185,129,0.2)" }}>
                                        <span style={{ fontSize: 22, color: "var(--success)" }}>✓</span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{ev.eventType?.title ?? ev.eventTypeId}</p>
                                            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(ev.date)} · {ev.lessons.length} lesson{ev.lessons.length !== 1 ? "s" : ""} marked taught</p>
                                        </div>
                                        <Link href={`/events/${ev._id}`} style={{ fontSize: 12, color: "var(--accent-text)", textDecoration: "underline" }}>Open ↗</Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function CommitLessonsPage() {
    return (
        <Suspense>
            <MarkTaughtInner />
        </Suspense>
    );
}
