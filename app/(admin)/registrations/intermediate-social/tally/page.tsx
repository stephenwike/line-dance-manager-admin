"use client";

import { useEffect, useState } from "react";

interface TallyEntry {
    key: string;
    danceId: string | null;
    displayName: string;
    count: number;
    requestors: string[];
}

interface TallyData {
    eventSlug: string;
    totalRegistrations: number;
    registrantsWithRequests: number;
    totalRequests: number;
    dances: TallyEntry[];
}

export default function RequestTallyPage() {
    const [data, setData] = useState<TallyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetch("/api/admin/registrations/tally?event=intermediate-social-2026-09-12")
            .then(r => {
                if (r.status === 401) { window.location.href = "/login"; return null; }
                return r.json();
            })
            .then(d => { if (d) setData(d); })
            .catch(() => setError("Failed to load tally."))
            .finally(() => setLoading(false));
    }, []);

    function toggleExpanded(key: string) {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    const maxCount = data?.dances[0]?.count ?? 1;

    return (
        <div style={{ padding: "32px 36px" }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                    Dance Request Tally
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
                    Intermediate Line Dance Social · Sep 12, 2026
                </p>
            </div>

            {loading && <p style={{ color: "var(--text-secondary)" }}>Loading…</p>}
            {error && <p style={{ color: "var(--danger-text)" }}>{error}</p>}

            {data && (
                <>
                    {/* Summary */}
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
                        <StatCard label="Total Registrations" value={data.totalRegistrations} />
                        <StatCard label="Submitted Requests" value={data.registrantsWithRequests} />
                        <StatCard label="Total Requests" value={data.totalRequests} />
                        <StatCard label="Unique Dances" value={data.dances.length} />
                    </div>

                    {data.dances.length === 0 ? (
                        <div style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            padding: "40px 24px",
                            textAlign: "center",
                            color: "var(--text-tertiary)",
                            fontSize: 14,
                        }}>
                            No dance requests submitted yet.
                        </div>
                    ) : (
                        <div style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            overflow: "hidden",
                        }}>
                            {data.dances.map((entry, i) => {
                                const isExpanded = expanded.has(entry.key);
                                const barPct = Math.round((entry.count / maxCount) * 100);
                                return (
                                    <div
                                        key={entry.key}
                                        style={{
                                            borderBottom: i < data.dances.length - 1 ? "1px solid var(--border)" : "none",
                                        }}
                                    >
                                        {/* Main row */}
                                        <div style={{
                                            display: "grid",
                                            gridTemplateColumns: "2.5rem 1fr auto",
                                            alignItems: "center",
                                            gap: 16,
                                            padding: "14px 20px",
                                            cursor: "pointer",
                                        }}
                                            onClick={() => toggleExpanded(entry.key)}
                                        >
                                            {/* Rank */}
                                            <div style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: i === 0 ? "var(--accent-text)" : "var(--text-tertiary)",
                                                textAlign: "center",
                                            }}>
                                                #{i + 1}
                                            </div>

                                            {/* Name + bar */}
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                                                        {entry.displayName}
                                                    </span>
                                                    {entry.danceId && (
                                                        <span style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            padding: "1px 6px",
                                                            borderRadius: 4,
                                                            background: "var(--accent-subtle)",
                                                            color: "var(--accent-text)",
                                                        }}>linked</span>
                                                    )}
                                                </div>
                                                {/* Bar */}
                                                <div style={{
                                                    height: 6,
                                                    background: "var(--border)",
                                                    borderRadius: 3,
                                                    overflow: "hidden",
                                                    maxWidth: 400,
                                                }}>
                                                    <div style={{
                                                        height: "100%",
                                                        width: `${barPct}%`,
                                                        background: i === 0 ? "var(--accent)" : "var(--border-strong)",
                                                        borderRadius: 3,
                                                        transition: "width 0.4s ease",
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Count + toggle */}
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ textAlign: "right" }}>
                                                    <span style={{
                                                        fontSize: 22,
                                                        fontWeight: 800,
                                                        color: i === 0 ? "var(--accent-text)" : "var(--text-primary)",
                                                        lineHeight: 1,
                                                    }}>
                                                        {entry.count}
                                                    </span>
                                                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                                                        {entry.count === 1 ? "request" : "requests"}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    fontSize: 12,
                                                    color: "var(--text-tertiary)",
                                                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                                    display: "inline-block",
                                                    transition: "transform 0.2s",
                                                    userSelect: "none",
                                                }}>▾</span>
                                            </div>
                                        </div>

                                        {/* Expanded: requestors list */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: "0 20px 14px 72px",
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: 6,
                                            }}>
                                                {entry.requestors.map((name, j) => (
                                                    <span key={j} style={{
                                                        fontSize: 12,
                                                        padding: "3px 10px",
                                                        borderRadius: 20,
                                                        background: "var(--surface-raised)",
                                                        border: "1px solid var(--border)",
                                                        color: "var(--text-secondary)",
                                                    }}>
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 20px",
            minWidth: 110,
        }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>
                {label}
            </p>
            <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1 }}>
                {value}
            </p>
        </div>
    );
}
