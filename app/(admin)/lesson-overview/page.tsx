"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, ActionButton } from "@/components/ui";

interface LessonSlot {
    time: string | null;
    dance: string | null;
    level: string | null;
    link: string | null;
}

interface OccurrenceRow {
    key: string;
    eventId: string | null;
    date: string;
    startTime: string;
    endTime: string | null;
    durationMinutes: number;
    eventTypeId: string;
    frequencyId: string;
    status: "UNPLANNED" | "PLANNED" | "CANCELLED";
    isCancelled: boolean;
    cancelNote: string | null;
    substitute: string | null;
    lessons: LessonSlot[];
    eventType: { _id: string; title: string; level: string; price: string; venueId: string | null };
}

function ymd(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function statusBadge(status: OccurrenceRow["status"]) {
    if (status === "PLANNED") return <Badge label="Planned" color="green" />;
    if (status === "CANCELLED") return <Badge label="Cancelled" color="red" />;
    return <Badge label="Unplanned" color="orange" />;
}

function unplannedReason(r: OccurrenceRow) {
    if (r.status === "CANCELLED") return r.cancelNote ? `Cancelled: ${r.cancelNote}` : "Cancelled";
    if (!r.eventId) return "No event generated yet — run Generate Events first";
    if (!r.lessons || r.lessons.length === 0) return "No lesson slots added";
    const missing = r.lessons.filter((l) => !l.dance?.trim()).length;
    if (missing > 0) return `${missing} slot${missing === 1 ? "" : "s"} missing a dance`;
    return null;
}

const inputStyle: React.CSSProperties = {
    padding: "7px 10px", fontSize: 13, borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none",
};

export default function LessonOverviewPage() {
    const today = ymd(new Date());
    const twoWeeks = ymd(new Date(Date.now() + 14 * 86400000));

    const [from, setFrom] = useState(today);
    const [to, setTo] = useState(twoWeeks);
    const [onlyUnplanned, setOnlyUnplanned] = useState(true);
    const [showCancelled, setShowCancelled] = useState(false);
    const [etFilter, setEtFilter] = useState("all");
    const [rows, setRows] = useState<OccurrenceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const qs = new URLSearchParams({ from, to, onlyUnplanned: String(onlyUnplanned) });
            const res = await fetch(`/api/admin/bld/occurrences?${qs}`);
            if (!res.ok) throw new Error(await res.text());
            setRows(await res.json());
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [from, to, onlyUnplanned]); // eslint-disable-line react-hooks/exhaustive-deps

    const etOptions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const r of rows) seen.set(r.eventTypeId, r.eventType.title);
        return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [rows]);

    const visible = useMemo(() => rows.filter((r) => {
        if (!showCancelled && r.status === "CANCELLED") return false;
        if (etFilter !== "all" && r.eventTypeId !== etFilter) return false;
        return true;
    }), [rows, showCancelled, etFilter]);

    return (
        <div className="page-pad" style={{ maxWidth: 860 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Lesson Overview</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Virtual occurrences from frequencies, overlaid with saved events. Unplanned = missing any lesson or dance.
                </p>
            </div>

            {/* Filters */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>From</span>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>To</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
                </label>

                {etOptions.length > 1 && (
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Event type</span>
                        <select value={etFilter} onChange={(e) => setEtFilter(e.target.value)} style={inputStyle}>
                            <option value="all">All</option>
                            {etOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
                        </select>
                    </label>
                )}

                <div style={{ display: "flex", gap: 12, alignItems: "center", paddingBottom: 2 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                        <input type="checkbox" checked={onlyUnplanned} onChange={(e) => setOnlyUnplanned(e.target.checked)} />
                        Only unplanned
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                        <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
                        Show cancelled
                    </label>
                </div>

                <ActionButton label={loading ? "Loading…" : "Refresh"} variant="ghost" onClick={load} loading={loading} />

                {err && <p style={{ width: "100%", fontSize: 12, color: "var(--danger)" }}>{err}</p>}
            </div>

            {/* Results */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {!loading && visible.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "32px 0" }}>
                        No occurrences match your filters.
                    </p>
                )}

                {visible.map((r) => {
                    const reason = unplannedReason(r);
                    const planHref = `/plan-lesson?${new URLSearchParams({ eventTypeId: r.eventTypeId, date: r.date, startTime: r.startTime, durationMinutes: String(r.durationMinutes), title: r.eventType.title }).toString()}`;

                    return (
                        <div key={r.key} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                            {/* Header */}
                            <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{r.eventType.title}</span>
                                        {statusBadge(r.status)}
                                    </div>
                                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                                        {r.date} · {r.startTime}{r.endTime ? ` – ${r.endTime}` : ""}
                                    </p>
                                    {r.substitute && (
                                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                                            Substitute: <strong>{r.substitute}</strong>
                                        </p>
                                    )}
                                    {reason && (
                                        <p style={{ fontSize: 11, color: r.status === "CANCELLED" ? "var(--text-tertiary)" : "#b45309", marginTop: 4 }}>
                                            {reason}
                                        </p>
                                    )}
                                </div>

                                <div style={{ flexShrink: 0 }}>
                                    {r.eventId ? (
                                        <a
                                            href={`/events/${r.eventId}`}
                                            style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-secondary)", textDecoration: "none", display: "inline-block" }}
                                        >
                                            Open event
                                        </a>
                                    ) : (
                                        <a
                                            href={planHref}
                                            style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", textDecoration: "none", display: "inline-block", fontWeight: 600 }}
                                        >
                                            Plan lesson
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Lessons */}
                            {r.lessons.length > 0 && (
                                <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", background: "var(--surface-raised)", display: "flex", flexDirection: "column", gap: 4 }}>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Lessons</p>
                                    {r.lessons.map((l, i) => {
                                        const missing = !l.dance?.trim();
                                        return (
                                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
                                                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                    {l.time ?? "?"} · {l.level ?? "?"}
                                                </span>
                                                {missing ? (
                                                    <span style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>Dance needed</span>
                                                ) : l.link ? (
                                                    <a href={l.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>{l.dance}</a>
                                                ) : (
                                                    <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>{l.dance}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
