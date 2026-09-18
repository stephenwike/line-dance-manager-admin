"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface TallyEntry {
    key: string;
    danceId: string | null;
    displayName: string;
    count: number;
    requestors: string[];
    songName: string | null;
    songArtist: string | null;
    durationMs: number | null;
}

interface TallyData {
    eventSlug: string;
    totalRegistrations: number;
    registrantsWithRequests: number;
    totalRequests: number;
    dances: TallyEntry[];
}

function EditableEntryName({
    entry, eventSlug, onRenamed, onLinked,
}: {
    entry: TallyEntry; eventSlug: string;
    onRenamed: (key: string, newName: string) => void;
    onLinked: (key: string, danceId: string, danceName: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(entry.displayName);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<{ id: string; danceName: string }[]>([]);
    const [searching, setSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function startEdit() {
        setValue(entry.displayName);
        setSearchResults([]); setSaveError(null); setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    }

    function cancel() { setEditing(false); setSearchResults([]); setSaveError(null); }

    function handleEnter() {
        if (searchResults.length > 0) linkToDance(searchResults[0]);
        else saveRename();
    }

    async function saveRename() {
        const trimmed = value.trim();
        if (!trimmed || trimmed === entry.displayName) { cancel(); return; }
        setSaving(true); setSaveError(null);
        try {
            const res = await fetch("/api/admin/registrations/tally", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event: eventSlug, fromText: entry.displayName, toText: trimmed }),
            });
            const data = await res.json();
            if (res.ok && data.modifiedCount > 0) { onRenamed(entry.key, trimmed); cancel(); }
            else setSaveError(res.ok ? "No matching requests found to update." : (data.error ?? "Save failed."));
        } catch { setSaveError("Network error."); }
        finally { setSaving(false); }
    }

    async function linkToDance(dance: { id: string; danceName: string }) {
        setSaving(true); setSaveError(null);
        try {
            const res = await fetch("/api/admin/registrations/tally", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event: eventSlug, fromText: entry.displayName, danceId: dance.id, danceName: dance.danceName }),
            });
            const data = await res.json();
            if (res.ok && data.modifiedCount > 0) { onLinked(entry.key, dance.id, dance.danceName); cancel(); }
            else setSaveError(res.ok ? "No matching requests found to update." : (data.error ?? "Save failed."));
        } catch { setSaveError("Network error."); }
        finally { setSaving(false); }
    }

    function onSearchChange(q: string) {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!q.trim()) { setSearchResults([]); return; }
        searchTimer.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/admin/dances/search?q=${encodeURIComponent(q)}`);
                if (res.ok) setSearchResults(await res.json());
            } finally { setSearching(false); }
        }, 250);
    }

    if (editing) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                        <input ref={inputRef} value={value}
                            onChange={e => { setValue(e.target.value); onSearchChange(e.target.value); }}
                            onKeyDown={e => { if (e.key === "Enter") handleEnter(); if (e.key === "Escape") cancel(); }}
                            disabled={saving} placeholder="Dance name…"
                            style={{
                                fontSize: 14, fontWeight: 500, padding: "3px 8px", borderRadius: 6,
                                border: "1px solid var(--accent)", background: "var(--surface-raised)",
                                color: "var(--text-primary)", outline: "none", width: 240,
                            }}
                        />
                        {searching && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-tertiary)" }}>…</span>}
                    </div>
                    <button onClick={saveRename} disabled={saving} style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 6,
                        border: "1px solid var(--accent)", background: "var(--accent)",
                        color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600,
                    }}>{saving ? "…" : "Save"}</button>
                    <button onClick={cancel} disabled={saving} style={{
                        fontSize: 12, padding: "3px 8px", borderRadius: 6,
                        border: "1px solid var(--border)", background: "transparent",
                        color: "var(--text-secondary)", cursor: "pointer",
                    }}>Cancel</button>
                    {saveError && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{saveError}</span>}
                </div>
                {searchResults.length > 0 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--surface)", maxWidth: 360 }}>
                        {searchResults.map((d, i) => (
                            <button key={d.id} onClick={() => linkToDance(d)} disabled={saving} style={{
                                display: "block", width: "100%", textAlign: "left", padding: "7px 12px", border: "none",
                                borderBottom: i < searchResults.length - 1 ? "1px solid var(--border)" : "none",
                                background: "transparent", color: "var(--text-primary)", fontSize: 13,
                                cursor: saving ? "not-allowed" : "pointer",
                            }}
                                onMouseOver={e => (e.currentTarget.style.background = "var(--surface-raised)")}
                                onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                            >
                                {d.danceName}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{entry.displayName}</span>
            {!entry.danceId && (
                <button onClick={startEdit} title="Edit name or link to catalog" style={{
                    background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px",
                    color: "var(--text-tertiary)", fontSize: 13, lineHeight: 1, borderRadius: 4,
                }}>✎</button>
            )}
        </span>
    );
}

export default function RequestTallyPage() {
    const { slug } = useParams<{ slug: string }>();
    const [data, setData] = useState<TallyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removedData, setRemovedData] = useState<TallyData | null>(null);
    const [showRemoved, setShowRemoved] = useState(false);
    const [removedLoading, setRemovedLoading] = useState(false);
    const [unlinkedOnly, setUnlinkedOnly] = useState(false);
    const [eventTitle, setEventTitle] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;
        Promise.all([
            fetch(`/api/admin/registrations/tally?event=${slug}`).then(r => {
                if (r.status === 401) { window.location.href = "/login"; return null; }
                return r.json();
            }),
            fetch(`/api/admin/events/${slug}`).then(r => r.ok ? r.json() : null),
        ]).then(([tally, event]) => {
            if (tally) setData(tally);
            if (event) setEventTitle(`${event.shortTitle ?? event.title} · ${event.dateShort ?? event.date}`);
        }).catch(() => setError("Failed to load tally."))
          .finally(() => setLoading(false));
    }, [slug]);

    async function toggleRemoved() {
        if (showRemoved) { setShowRemoved(false); return; }
        setShowRemoved(true);
        if (!removedData) {
            setRemovedLoading(true);
            try {
                const res = await fetch(`/api/admin/registrations/tally?event=${slug}&removedOnly=true`);
                if (res.ok) setRemovedData(await res.json());
            } finally { setRemovedLoading(false); }
        }
    }

    function handleRenamed(key: string, newName: string) {
        setData(prev => prev ? { ...prev, dances: prev.dances.map(d => d.key === key ? { ...d, displayName: newName } : d) } : prev);
    }

    function handleLinked(key: string, danceId: string, danceName: string) {
        setData(prev => {
            if (!prev) return prev;
            const newKey = `id:${danceId}`;
            const existing = prev.dances.find(d => d.key === newKey);
            const source = prev.dances.find(d => d.key === key);
            if (!source) return prev;
            if (existing) {
                return {
                    ...prev,
                    dances: prev.dances
                        .filter(d => d.key !== key)
                        .map(d => d.key === newKey ? { ...d, count: d.count + source.count, requestors: [...d.requestors, ...source.requestors] } : d)
                        .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName)),
                };
            }
            return {
                ...prev,
                dances: prev.dances
                    .map(d => d.key === key ? { ...d, key: newKey, danceId, displayName: danceName } : d)
                    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName)),
            };
        });
    }

    const visibleDances = data ? (unlinkedOnly ? data.dances.filter(d => !d.danceId) : data.dances) : [];
    const maxCount = visibleDances[0]?.count ?? 1;

    function exportCsv() {
        if (!data) return;
        const sorted = [...data.dances].sort((a, b) => a.displayName.localeCompare(b.displayName));
        function cell(v: string | number | null) {
            if (v === null || v === undefined) return "";
            const s = String(v);
            return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        }
        function fmtDuration(ms: number | null) {
            if (!ms) return "";
            const totalSec = Math.round(ms / 1000);
            return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
        }
        const rows = [
            ["Dance", "Votes", "Song", "Artist", "Duration"],
            ...sorted.map(d => [cell(d.displayName), d.count, cell(d.songName), cell(d.songArtist), cell(fmtDuration(d.durationMs))]),
        ];
        const csv = rows.map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "guaranteed-list.csv"; a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="page-pad">
            <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Dance Request Tally</h1>
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
                        {eventTitle ?? slug}
                    </p>
                </div>
                {data && (
                    <button onClick={exportCsv} style={{
                        fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--surface)",
                        color: "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap",
                    }}>↓ Export guaranteed list</button>
                )}
            </div>

            {loading && <p style={{ color: "var(--text-secondary)" }}>Loading…</p>}
            {error && <p style={{ color: "var(--danger-text)" }}>{error}</p>}

            {data && (
                <>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
                        <StatCard label="Total Registrations" value={data.totalRegistrations} />
                        <StatCard label="Submitted Requests" value={data.registrantsWithRequests} />
                        <StatCard label="Total Requests" value={data.totalRequests} />
                        <StatCard label="Unique Dances" value={data.dances.length} />
                        <button onClick={() => setUnlinkedOnly(v => !v)} style={{
                            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
                            border: `1px solid ${unlinkedOnly ? "var(--accent)" : "var(--border)"}`,
                            background: unlinkedOnly ? "var(--accent-subtle)" : "transparent",
                            color: unlinkedOnly ? "var(--accent-text)" : "var(--text-secondary)",
                            cursor: "pointer", whiteSpace: "nowrap", alignSelf: "center",
                        }}>
                            {unlinkedOnly ? "✓ Unlinked only" : "Show unlinked only"}
                        </button>
                        <button onClick={toggleRemoved} style={{
                            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
                            border: `1px solid ${showRemoved ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                            background: showRemoved ? "var(--danger-subtle)" : "transparent",
                            color: showRemoved ? "var(--danger-text)" : "var(--text-secondary)",
                            cursor: "pointer", whiteSpace: "nowrap", alignSelf: "center",
                        }}>
                            {showRemoved ? "✓ Removed requests" : "Show removed requests"}
                        </button>
                    </div>

                    {visibleDances.length === 0 ? (
                        <div style={{
                            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
                            padding: "40px 24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 14,
                        }}>No dance requests submitted yet.</div>
                    ) : (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                            {visibleDances.map((entry, i) => {
                                const barPct = Math.round((entry.count / maxCount) * 100);
                                return (
                                    <div key={entry.key} style={{
                                        borderBottom: i < visibleDances.length - 1 ? "1px solid var(--border)" : "none",
                                        padding: "14px 20px",
                                    }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "2.5rem 1fr auto", alignItems: "center", gap: 16 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "var(--accent-text)" : "var(--text-tertiary)", textAlign: "center" }}>
                                                #{i + 1}
                                            </div>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                                    <EditableEntryName entry={entry} eventSlug={data.eventSlug} onRenamed={handleRenamed} onLinked={handleLinked} />
                                                    {entry.danceId && (
                                                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "var(--accent-subtle)", color: "var(--accent-text)" }}>linked</span>
                                                    )}
                                                </div>
                                                <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", maxWidth: 400, marginBottom: 8 }}>
                                                    <div style={{ height: "100%", width: `${barPct}%`, background: i === 0 ? "var(--accent)" : "var(--border-strong)", borderRadius: 3, transition: "width 0.4s ease" }} />
                                                </div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                                    {entry.requestors.map((name, j) => (
                                                        <span key={j} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "right" }}>
                                                <span style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? "var(--accent-text)" : "var(--text-primary)", lineHeight: 1 }}>{entry.count}</span>
                                                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{entry.count === 1 ? "request" : "requests"}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {showRemoved && (
                        <div style={{ marginTop: 32 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--danger-text)", margin: 0 }}>Removed Attendees' Requests</h2>
                                {removedData && (
                                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                                        {removedData.totalRegistrations} removed · {removedData.totalRequests} requests
                                    </span>
                                )}
                            </div>
                            {removedLoading && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>}
                            {removedData && removedData.dances.length === 0 && (
                                <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No requests from removed attendees.</p>
                            )}
                            {removedData && removedData.dances.length > 0 && (
                                <div style={{ background: "var(--surface)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, overflow: "hidden", opacity: 0.85 }}>
                                    {removedData.dances.map((entry, i) => (
                                        <div key={entry.key} style={{
                                            borderBottom: i < removedData.dances.length - 1 ? "1px solid var(--border)" : "none",
                                            padding: "12px 20px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16,
                                        }}>
                                            <div>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "line-through" }}>{entry.displayName}</span>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                                                    {entry.requestors.map((name, j) => (
                                                        <span key={j} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--danger-subtle)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger-text)" }}>
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-tertiary)" }}>{entry.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 20px", minWidth: 110 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1 }}>{value}</p>
        </div>
    );
}
