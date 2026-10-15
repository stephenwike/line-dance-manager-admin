"use client";

import { useEffect, useState } from "react";

type Missing = "stepsheet" | "track";

interface IncompleteDance {
    id: string;
    danceName: string;
    difficulty: string;
    choreographerNames: string[];
    stepsheet: string;
    primaryTrack: string;
    primaryTrackName: string | null;
    songArtists: { song: string; artist: string }[];
    missing: Missing[];
}

interface SpotifyTrack {
    id: string;
    name: string;
    artists: string[];
    uri: string;
    duration_ms: number;
    explicit: boolean;
    preview_url: string | null;
    isrc?: string;
}

type Filter = "all" | "stepsheet" | "track";
type ActivePanel = { danceId: string; type: "stepsheet" | "track" } | null;

function difficultyColor(d: string) {
    switch (d?.toLowerCase()) {
        case "beginner": return "#16a34a";
        case "intermediate": return "var(--accent)";
        case "advanced": return "#dc2626";
        default: return "var(--text-muted)";
    }
}

function StepsheetPanel({ dance, onSave, onClose }: {
    dance: IncompleteDance;
    onSave: (url: string) => Promise<void>;
    onClose: () => void;
}) {
    const [url, setUrl] = useState(dance.stepsheet || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSave() {
        if (!url.trim()) { setError("Please enter a URL"); return; }
        setSaving(true);
        setError("");
        try {
            await onSave(url.trim());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
            setSaving(false);
        }
    }

    return (
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-raised)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Stepsheet URL
            </p>
            <div style={{ display: "flex", gap: 8 }}>
                <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                    placeholder="https://www.copperknob.co.uk/..."
                    autoFocus
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--surface)",
                        color: "var(--text)", fontSize: 13, outline: "none",
                    }}
                />
                <button onClick={handleSave} disabled={saving} style={{
                    padding: "8px 16px", borderRadius: 8, border: "none",
                    background: "var(--accent)", color: "#fff", fontSize: 13,
                    fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1, flexShrink: 0,
                }}>
                    {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={onClose} style={{
                    padding: "8px 10px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "none",
                    color: "var(--text-muted)", fontSize: 13, cursor: "pointer", flexShrink: 0,
                }}>✕</button>
            </div>
            {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{error}</p>}
        </div>
    );
}

function TrackPanel({ dance, onSave, onClose }: {
    dance: IncompleteDance;
    onSave: (track: object) => Promise<void>;
    onClose: () => void;
}) {
    const hint = dance.songArtists?.[0];
    const initialQuery = hint ? `${hint.song} ${hint.artist}` : "";
    const [query, setQuery] = useState(initialQuery);
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<SpotifyTrack[]>([]);
    const [spotifyUrl, setSpotifyUrl] = useState("");
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (initialQuery) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function search() {
        if (!query.trim()) return;
        setSearching(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/spotify-search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setResults(Array.isArray(data) ? data : (data.tracks ?? []));
        } catch {
            setError("Search failed");
        } finally {
            setSearching(false);
        }
    }

    async function loadByUrl() {
        const match = spotifyUrl.match(/track\/([A-Za-z0-9]+)/);
        if (!match) { setError("Not a valid Spotify track URL"); return; }
        setSearching(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/spotify-track?id=${match[1]}`);
            const data = await res.json();
            if (data?.id) setResults([data]);
            else setError("Track not found");
        } catch {
            setError("Failed to load track");
        } finally {
            setSearching(false);
        }
    }

    async function linkTrack(track: SpotifyTrack) {
        setSaving(track.id);
        setError("");
        try {
            await onSave({
                spotifyId: track.id,
                spotifyUri: track.uri,
                name: track.name,
                artists: track.artists,
                isrc: track.isrc,
                duration_ms: track.duration_ms,
                explicit: track.explicit,
                preview_url: track.preview_url,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
            setSaving(null);
        }
    }

    return (
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-raised)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Link Primary Track
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && search()}
                    placeholder={hint ? `${hint.song} ${hint.artist}` : `Search "${dance.danceName}" on Spotify…`}
                    autoFocus
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--surface)",
                        color: "var(--text)", fontSize: 13, outline: "none",
                    }}
                />
                <button onClick={search} disabled={searching} style={{
                    padding: "8px 14px", borderRadius: 8, border: "none",
                    background: "var(--accent)", color: "#fff", fontSize: 13,
                    fontWeight: 600, cursor: searching ? "not-allowed" : "pointer",
                    opacity: searching ? 0.7 : 1, flexShrink: 0,
                }}>
                    {searching ? "…" : "Search"}
                </button>
                <button onClick={onClose} style={{
                    padding: "8px 10px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "none",
                    color: "var(--text-muted)", fontSize: 13, cursor: "pointer", flexShrink: 0,
                }}>✕</button>
            </div>

            {results.length > 0 && (
                <div style={{ borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 10 }}>
                    {results.map((t, i) => (
                        <div key={t.id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", gap: 12,
                            borderTop: i > 0 ? "1px solid var(--border)" : "none",
                            background: "var(--surface)",
                        }}>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.name}</p>
                                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                    {t.artists.join(", ")}{t.explicit ? " · E" : ""}
                                </p>
                            </div>
                            <button onClick={() => linkTrack(t)} disabled={saving === t.id} style={{
                                padding: "6px 14px", borderRadius: 6, border: "none",
                                background: saving === t.id ? "var(--surface-raised)" : "var(--accent)",
                                color: saving === t.id ? "var(--text-muted)" : "#fff",
                                fontSize: 12, fontWeight: 600,
                                cursor: saving === t.id ? "not-allowed" : "pointer", flexShrink: 0,
                            }}>
                                {saving === t.id ? "Linking…" : "Link"}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
                <input
                    type="url"
                    value={spotifyUrl}
                    onChange={e => setSpotifyUrl(e.target.value)}
                    placeholder="Or paste a Spotify track URL…"
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--surface)",
                        color: "var(--text)", fontSize: 13, outline: "none",
                    }}
                />
                <button onClick={loadByUrl} disabled={searching} style={{
                    padding: "8px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "none",
                    color: "var(--text)", fontSize: 12, cursor: "pointer", flexShrink: 0,
                }}>Load</button>
            </div>

            {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{error}</p>}
        </div>
    );
}

export default function IncompleteDancesPage() {
    const [dances, setDances] = useState<IncompleteDance[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>("all");
    const [activePanel, setActivePanel] = useState<ActivePanel>(null);

    useEffect(() => {
        fetch("/api/admin/dances/incomplete")
            .then(r => r.json())
            .then((data: IncompleteDance[]) => { setDances(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const noStepsheetCount = dances.filter(d => d.missing.includes("stepsheet")).length;
    const noTrackCount = dances.filter(d => d.missing.includes("track")).length;

    const filtered = dances.filter(d => {
        if (filter === "stepsheet") return d.missing.includes("stepsheet");
        if (filter === "track") return d.missing.includes("track");
        return true;
    });

    function togglePanel(danceId: string, type: "stepsheet" | "track") {
        setActivePanel(p => p?.danceId === danceId && p.type === type ? null : { danceId, type });
    }

    async function saveStepsheet(dance: IncompleteDance, url: string) {
        const res = await fetch(`/api/admin/dances/${dance.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stepsheet: url }),
        });
        if (!res.ok) throw new Error("Failed to save");
        setDances(prev =>
            prev.map(d => d.id === dance.id
                ? { ...d, stepsheet: url, missing: d.missing.filter(m => m !== "stepsheet") }
                : d
            ).filter(d => d.missing.length > 0)
        );
        setActivePanel(null);
    }

    async function saveTrack(dance: IncompleteDance, track: object) {
        const res = await fetch(`/api/admin/dances/${dance.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ track }),
        });
        if (!res.ok) throw new Error("Failed to link track");
        const data = await res.json();
        setDances(prev =>
            prev.map(d => d.id === dance.id
                ? { ...d, primaryTrack: data.trackId ?? "", missing: d.missing.filter(m => m !== "track") }
                : d
            ).filter(d => d.missing.length > 0)
        );
        setActivePanel(null);
    }

    if (loading) {
        return (
            <div style={{ padding: 32 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
            </div>
        );
    }

    return (
        <div style={{ padding: "32px", maxWidth: 900 }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                        Incomplete Dances
                    </h1>
                    {dances.length > 0 && (
                        <span style={{
                            fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                            background: "#fef2f2", color: "#dc2626",
                        }}>{dances.length}</span>
                    )}
                </div>
                <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
                    Dances in the catalog missing a stepsheet URL or primary track.
                </p>
            </div>

            {dances.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                    {([
                        { id: "all" as Filter, label: `All (${dances.length})` },
                        { id: "stepsheet" as Filter, label: `No Stepsheet (${noStepsheetCount})` },
                        { id: "track" as Filter, label: `No Track (${noTrackCount})` },
                    ]).map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)} style={{
                            padding: "6px 14px", borderRadius: 20, fontSize: 13,
                            border: filter === f.id ? "none" : "1px solid var(--border)",
                            background: filter === f.id ? "var(--accent)" : "var(--surface)",
                            color: filter === f.id ? "#fff" : "var(--text)",
                            fontWeight: filter === f.id ? 600 : 400,
                            cursor: "pointer",
                        }}>{f.label}</button>
                    ))}
                </div>
            )}

            {filtered.length === 0 ? (
                <div style={{
                    padding: 48, textAlign: "center", background: "var(--surface)",
                    borderRadius: 12, border: "1px solid var(--border)",
                }}>
                    <p style={{ fontSize: 28, marginBottom: 8 }}>✓</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>All caught up!</p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No incomplete dances to show.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filtered.map(dance => {
                        const panel = activePanel?.danceId === dance.id ? activePanel.type : null;
                        return (
                            <div key={dance.id} style={{
                                background: "var(--surface)", borderRadius: 12,
                                border: "1px solid var(--border)", overflow: "hidden",
                            }}>
                                <div style={{
                                    display: "flex", alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "14px 16px", gap: 12,
                                    flexWrap: "wrap",
                                }}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 2px" }}>
                                            {dance.danceName}
                                        </p>
                                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {dance.choreographerNames.length > 0
                                                ? dance.choreographerNames.join(", ")
                                                : "Unknown choreographer"}
                                            {dance.stepsheet && (
                                                <a href={dance.stepsheet} target="_blank" rel="noopener noreferrer"
                                                    style={{ marginLeft: 8, color: "var(--accent)", textDecoration: "none", fontSize: 11 }}>
                                                    ↗ stepsheet
                                                </a>
                                            )}
                                        </p>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                                        {dance.difficulty && (
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                                                border: `1px solid ${difficultyColor(dance.difficulty)}`,
                                                color: difficultyColor(dance.difficulty),
                                            }}>{dance.difficulty}</span>
                                        )}
                                        {dance.missing.includes("stepsheet") && (
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                                                background: "#fef2f2", color: "#dc2626",
                                            }}>No stepsheet</span>
                                        )}
                                        {dance.missing.includes("track") && (
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                                                background: "#fff8ed", color: "#d97706",
                                            }}>No track</span>
                                        )}
                                        {dance.missing.includes("stepsheet") && (
                                            <button onClick={() => togglePanel(dance.id, "stepsheet")} style={{
                                                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                                border: "1px solid var(--border)",
                                                background: panel === "stepsheet" ? "var(--accent)" : "var(--surface-raised)",
                                                color: panel === "stepsheet" ? "#fff" : "var(--text)",
                                                cursor: "pointer",
                                            }}>+ Stepsheet</button>
                                        )}
                                        {dance.missing.includes("track") && (
                                            <button onClick={() => togglePanel(dance.id, "track")} style={{
                                                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                                border: "1px solid var(--border)",
                                                background: panel === "track" ? "var(--accent)" : "var(--surface-raised)",
                                                color: panel === "track" ? "#fff" : "var(--text)",
                                                cursor: "pointer",
                                            }}>+ Track</button>
                                        )}
                                    </div>
                                </div>

                                {panel === "stepsheet" && (
                                    <StepsheetPanel
                                        dance={dance}
                                        onSave={url => saveStepsheet(dance, url)}
                                        onClose={() => setActivePanel(null)}
                                    />
                                )}
                                {panel === "track" && (
                                    <TrackPanel
                                        dance={dance}
                                        onSave={track => saveTrack(dance, track)}
                                        onClose={() => setActivePanel(null)}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
