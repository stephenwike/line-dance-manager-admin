"use client";

import { useEffect, useRef, useState } from "react";
import { PageShell, EmptyState, Badge, ActionButton, ExpandableCard, InfoRow } from "@/components/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingDance {
    id: string;
    danceName: string;
    songTitle: string;
    artist: string;
    choreographer: string;
    count?: string;
    wall?: string;
    difficulty: string;
    stepsheetUrl: string | null;
    submittedByUserId: string | null;
    submittedAt: string;
}

interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    uri: string;
    duration_ms: number;
    explicit: boolean;
    album: { name: string; images: { url: string }[] };
    preview_url: string | null;
    external_ids?: { isrc?: string };
}

interface TrackInput {
    spotifyId?: string;
    spotifyUri?: string;
    name: string;
    artists: string[];
    isrc?: string;
    duration_ms?: number;
    explicit?: boolean;
    preview_url?: string | null;
}

interface DanceOverrides {
    danceName: string;
    choreographers: string[];
    difficulty: string;
    stepsheetUrl?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function isCopperKnob(url: string | null): boolean {
    return !!url && url.includes("copperknob.co");
}

function parseSpotifyId(input: string): string | null {
    const match = input.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

function spotifyTrackToInput(t: SpotifyTrack): TrackInput {
    return {
        spotifyId: t.id,
        spotifyUri: t.uri,
        name: t.name,
        artists: t.artists.map((a) => a.name),
        isrc: t.external_ids?.isrc,
        duration_ms: t.duration_ms,
        explicit: t.explicit,
        preview_url: t.preview_url,
    };
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "7px 10px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--surface-raised)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    minWidth: 0,
    boxSizing: "border-box",
};

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
    label, required, value, onChange, error, hint, readOnly,
}: {
    label: string; required?: boolean; value: string;
    onChange?: (v: string) => void; error?: string; hint?: string; readOnly?: boolean;
}) {
    return (
        <div>
            <label style={{
                display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600,
                color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
                marginBottom: 5,
            } as React.CSSProperties}>
                {label}
                {required && <span style={{ color: "var(--accent)", fontSize: 12 }}>*</span>}
            </label>
            <input
                type="text" value={value} readOnly={readOnly}
                onChange={(e) => onChange?.(e.target.value)}
                style={{
                    width: "100%", padding: "7px 10px", borderRadius: 7,
                    border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
                    background: readOnly ? "var(--surface)" : "var(--surface-raised)",
                    color: readOnly ? "var(--text-secondary)" : "var(--text-primary)",
                    fontSize: 13, outline: "none", boxSizing: "border-box",
                    cursor: readOnly ? "default" : "text",
                } as React.CSSProperties}
            />
            {hint && !error && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3, marginBottom: 0 }}>{hint}</p>}
            {error && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 3, marginBottom: 0 }}>{error}</p>}
        </div>
    );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ label, subtitle }: { label: string; subtitle?: string }) {
    return (
        <div style={{
            paddingBottom: 10, borderBottom: "1px solid var(--border)", marginBottom: 14,
            display: "flex", alignItems: "baseline", gap: 8,
        }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
            </span>
            {subtitle && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{subtitle}</span>}
        </div>
    );
}

// ── ChoreographerTags ─────────────────────────────────────────────────────────

function ChoreographerTags({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
    const [input, setInput] = useState("");
    const [suggestions, setSuggestions] = useState<{ id: string; name: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function add(name: string) {
        const trimmed = name.trim();
        if (trimmed && !values.map(v => v.toLowerCase()).includes(trimmed.toLowerCase())) {
            onChange([...values, trimmed]);
        }
        setInput("");
        setSuggestions([]);
        setShowSuggestions(false);
    }

    function handleInputChange(val: string) {
        setInput(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!val.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/admin/choreographers?q=${encodeURIComponent(val)}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setSuggestions(data.filter((c: { name: string }) =>
                        !values.map(v => v.toLowerCase()).includes(c.name.toLowerCase())
                    ));
                    setShowSuggestions(true);
                }
            } catch { /* ignore */ }
        }, 200);
    }

    return (
        <div style={{ position: "relative" }}>
            <label style={{
                display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
                textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5,
            }}>
                Choreographer(s)
            </label>
            <div
                onClick={() => inputRef.current?.focus()}
                style={{
                    display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 10px",
                    border: "1px solid var(--border)", borderRadius: 7,
                    background: "var(--surface-raised)", cursor: "text", minHeight: 38,
                    alignItems: "center",
                }}
            >
                {values.map((v) => (
                    <span key={v} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "var(--accent-subtle)", color: "var(--accent-text)",
                        borderRadius: 5, padding: "2px 8px", fontSize: 12, fontWeight: 500,
                        whiteSpace: "nowrap",
                    }}>
                        {v}
                        <button type="button"
                            onClick={(e) => { e.stopPropagation(); onChange(values.filter(x => x !== v)); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.7 }}>
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={values.length === 0 ? "Type to search or add…" : "Add another…"}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); if (input.trim()) add(input); }
                        if (e.key === "Escape") { setShowSuggestions(false); }
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    style={{
                        border: "none", background: "transparent", outline: "none",
                        fontSize: 13, color: "var(--text-primary)", flex: "1 1 120px",
                        minWidth: 120, padding: "1px 0",
                    }}
                />
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 7, marginTop: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    overflow: "hidden",
                }}>
                    {suggestions.map((s) => (
                        <button key={s.id} type="button"
                            onMouseDown={(e) => { e.preventDefault(); add(s.name); }}
                            style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "8px 12px", fontSize: 13, border: "none",
                                background: "transparent", color: "var(--text-primary)",
                                cursor: "pointer",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                            {s.name}
                        </button>
                    ))}
                    {input.trim() && !suggestions.some(s => s.name.toLowerCase() === input.trim().toLowerCase()) && (
                        <button type="button"
                            onMouseDown={(e) => { e.preventDefault(); add(input); }}
                            style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "8px 12px", fontSize: 13, border: "none",
                                borderTop: suggestions.length > 0 ? "1px solid var(--border)" : "none",
                                background: "transparent", color: "var(--text-tertiary)",
                                cursor: "pointer", fontStyle: "italic",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                            + Add &ldquo;{input.trim()}&rdquo; as new
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── SpotifyTrackCard ──────────────────────────────────────────────────────────

function SpotifyTrackCard({
    track, selected, onSelect, action,
}: {
    track: SpotifyTrack; selected?: boolean; onSelect: () => void;
    action?: { label: string; disabled?: boolean; onClick: () => void };
}) {
    const albumArt = track.album?.images?.[2]?.url ?? track.album?.images?.[0]?.url;
    const artistNames = track.artists.map((a) => a.name).join(", ");

    return (
        <div
            onClick={action ? undefined : onSelect}
            style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderRadius: 8,
                border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                background: selected ? "rgba(79,70,229,0.07)" : "var(--surface-raised)",
                cursor: action ? "default" : "pointer",
                transition: "border-color 0.12s, background 0.12s",
                userSelect: "none",
            } as React.CSSProperties}
        >
            {albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={albumArt} alt="" width={40} height={40}
                    style={{ borderRadius: 4, flexShrink: 0, objectFit: "cover" }} />
            ) : (
                <div style={{
                    width: 40, height: 40, borderRadius: 4, flexShrink: 0, background: "var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>♪</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {track.name}
                    {track.explicit && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "var(--border)", color: "var(--text-tertiary)" }}>E</span>
                    )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {artistNames}<span style={{ color: "var(--text-tertiary)", margin: "0 6px" }}>·</span>{track.album?.name}
                </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatDuration(track.duration_ms)}</span>
                {action ? (
                    <button type="button" onClick={action.onClick} disabled={action.disabled} style={{
                        padding: "4px 10px", borderRadius: 6,
                        border: `1px solid ${action.disabled ? "var(--border)" : "var(--accent)"}`,
                        background: "transparent",
                        color: action.disabled ? "var(--text-tertiary)" : "var(--accent)",
                        fontSize: 11, fontWeight: 600, cursor: action.disabled ? "default" : "pointer",
                    }}>{action.label}</button>
                ) : (
                    <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--accent)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.12s", flexShrink: 0,
                    }}>
                        {selected && <span style={{ color: "white", fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── AltTrackChip ─────────────────────────────────────────────────────────────

function AltTrackChip({ track, onRemove }: { track: TrackInput; onRemove: () => void }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
            borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-raised)",
        }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {track.name}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>by</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {track.artists.join(", ")}
                </span>
                {!track.spotifyId && (
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0, fontStyle: "italic" }}>manual</span>
                )}
            </div>
            <button type="button" onClick={onRemove} style={{
                width: 20, height: 20, borderRadius: "50%", border: "none",
                background: "var(--border)", color: "var(--text-secondary)",
                fontSize: 13, lineHeight: 1, cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
        </div>
    );
}

// ── AltTrackSearch ────────────────────────────────────────────────────────────

function AltTrackSearch({
    initialTitle = "", initialArtist = "",
    alreadyAdded, primaryTrackId,
    onAdd, onCancel,
}: {
    initialTitle?: string; initialArtist?: string;
    alreadyAdded: string[]; primaryTrackId?: string;
    onAdd: (track: TrackInput) => void;
    onCancel: () => void;
}) {
    const [title, setTitle] = useState(initialTitle);
    const [artist, setArtist] = useState(initialArtist);
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [results, setResults] = useState<SpotifyTrack[]>([]);

    useEffect(() => {
        if (initialTitle || initialArtist) search(initialTitle, initialArtist);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function search(t: string, a: string) {
        const q = `${t} ${a}`.trim();
        if (!q) return;
        setStatus("loading");
        try {
            const res = await fetch(`/api/admin/spotify-search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (!res.ok || !Array.isArray(data)) { setStatus("error"); return; }
            setResults(data);
            setStatus("done");
        } catch { setStatus("error"); }
    }

    function addManual() {
        const name = title.trim();
        const artists = artist.split(",").map((a) => a.trim()).filter(Boolean);
        if (!name || !artists.length) return;
        onAdd({ name, artists });
    }

    const isUsed = (id: string) => alreadyAdded.includes(id) || id === primaryTrackId;

    return (
        <div style={{
            border: "1px solid var(--border)", borderRadius: 8, padding: 12,
            background: "var(--surface-raised)", display: "flex", flexDirection: "column", gap: 10,
        }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="text" placeholder="Song title" value={title}
                    onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, flex: "1 1 0" }} />
                <input type="text" placeholder="Artist(s)" value={artist}
                    onChange={(e) => setArtist(e.target.value)} style={{ ...inputStyle, flex: "1 1 0" }} />
                <button type="button" onClick={() => search(title, artist)} disabled={status === "loading"}
                    style={{
                        padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)",
                        background: "var(--surface)", color: "var(--text-secondary)",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                        flexShrink: 0, opacity: status === "loading" ? 0.5 : 1,
                    }}>
                    {status === "loading" ? "…" : "Search"}
                </button>
            </div>

            {status === "error" && <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>Search failed.</p>}
            {status === "done" && results.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>No results found.</p>
            )}
            {status === "done" && results.map((track) => (
                <SpotifyTrackCard key={track.id} track={track} onSelect={() => {}}
                    action={isUsed(track.id)
                        ? { label: "Added", disabled: true, onClick: () => {} }
                        : { label: "+ Add", onClick: () => onAdd(spotifyTrackToInput(track)) }}
                />
            ))}

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", paddingTop: 2, borderTop: "1px solid var(--border)" }}>
                <button type="button" onClick={addManual} disabled={!title.trim() || !artist.trim()}
                    style={{
                        padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)",
                        background: "transparent", color: "var(--text-secondary)",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                        opacity: !title.trim() || !artist.trim() ? 0.4 : 1,
                    }}>
                    Add without Spotify link
                </button>
                <button type="button" onClick={onCancel} style={{
                    padding: "5px 10px", borderRadius: 6, border: "none",
                    background: "transparent", color: "var(--text-tertiary)", fontSize: 11, cursor: "pointer",
                }}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── TabBar ────────────────────────────────────────────────────────────────────

function TabBar<T extends string>({ tabs, active, onChange }: {
    tabs: { value: T; label: string }[];
    active: T;
    onChange: (v: T) => void;
}) {
    return (
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", alignSelf: "flex-start" }}>
            {tabs.map((tab, i) => (
                <button key={tab.value} type="button" onClick={() => onChange(tab.value)}
                    style={{
                        padding: "6px 16px", fontSize: 12, fontWeight: 600, border: "none",
                        borderRight: i < tabs.length - 1 ? "1px solid var(--border)" : "none",
                        background: active === tab.value ? "var(--accent)" : "var(--surface-raised)",
                        color: active === tab.value ? "white" : "var(--text-secondary)",
                        cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

// ── ApprovePanel ──────────────────────────────────────────────────────────────

type TrackTab = "search" | "url";

function ApprovePanel({
    dance, onConfirm, onCancel,
}: {
    dance: PendingDance;
    onConfirm: (track: TrackInput, overrides: DanceOverrides, additionalTracks: TrackInput[]) => Promise<void>;
    onCancel: () => void;
}) {
    // ── Dance detail fields ───────────────────────────────────────────────
    const [danceName, setDanceName] = useState(dance.danceName);
    const [choreographers, setChoreographers] = useState<string[]>(
        dance.choreographer ? [dance.choreographer] : []
    );
    const [difficulty, setDifficulty] = useState(dance.difficulty);
    const [stepsheetUrl, setStepsheetUrl] = useState(dance.stepsheetUrl ?? "");
    const [songTitle, setSongTitle] = useState(dance.songTitle);
    const [artist, setArtist] = useState(dance.artist);

    // ── Scrape ────────────────────────────────────────────────────────────
    const [scrapeStatus, setScrapeStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [scrapeMsg, setScrapeMsg] = useState("");
    const [scrapeFields, setScrapeFields] = useState<{ label: string; value: string }[]>([]);
    const [submittedVsScraped, setSubmittedVsScraped] = useState<{ title: string; artist: string } | null>(null);

    // ── Primary track — search tab ────────────────────────────────────────
    const [trackTab, setTrackTab] = useState<TrackTab>("search");
    const [spotifyStatus, setSpotifyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [spotifyError, setSpotifyError] = useState("");
    const [spotifyResults, setSpotifyResults] = useState<SpotifyTrack[]>([]);
    const [selectedResult, setSelectedResult] = useState<SpotifyTrack | null>(null);

    // ── Primary track — URL tab ───────────────────────────────────────────
    const [spotifyUrl, setSpotifyUrl] = useState("");
    const [urlTrack, setUrlTrack] = useState<SpotifyTrack | null>(null);
    const [urlLoading, setUrlLoading] = useState(false);
    const [urlError, setUrlError] = useState("");

    // ── Alternative tracks ────────────────────────────────────────────────
    const [additionalTracks, setAdditionalTracks] = useState<TrackInput[]>([]);
    const [showAltSearch, setShowAltSearch] = useState(false);
    const [altSearchSeed, setAltSearchSeed] = useState<{ title: string; artist: string } | null>(null);

    // ── Validation + submit ───────────────────────────────────────────────
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    // ── On mount: scrape if CopperKnob, otherwise Spotify search directly ─
    useEffect(() => {
        if (isCopperKnob(dance.stepsheetUrl)) {
            runScrape(dance.stepsheetUrl!);
        } else {
            runSpotifySearch(dance.songTitle, dance.artist);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function runScrape(url: string) {
        setScrapeStatus("loading");
        setScrapeMsg("Fetching from CopperKnob…");
        try {
            const res = await fetch("/api/admin/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });
            const data = await res.json();
            if (!res.ok) {
                setScrapeStatus("error");
                setScrapeMsg(data.error ?? "Unknown error");
                runSpotifySearch(dance.songTitle, dance.artist);
                return;
            }

            // Apply whatever fields were successfully scraped
            if (data.danceName) setDanceName(data.danceName);
            if (data.choreographers?.length) setChoreographers(data.choreographers);
            if (data.difficulty) setDifficulty(data.difficulty);

            const scrapedTitle = data.songTitle ?? dance.songTitle;
            const scrapedArtist = data.artist ?? dance.artist;
            if (data.songTitle) setSongTitle(data.songTitle);
            if (data.artist) setArtist(data.artist);

            const titleDiffers = scrapedTitle.toLowerCase() !== dance.songTitle.toLowerCase();
            const artistDiffers = scrapedArtist.toLowerCase() !== dance.artist.toLowerCase();
            if (titleDiffers || artistDiffers) {
                setSubmittedVsScraped({ title: dance.songTitle, artist: dance.artist });
            }

            setScrapeStatus("done");
            setScrapeMsg(data.missing?.length ? `Could not extract: ${data.missing.join(", ")}` : "");
            const fields: { label: string; value: string }[] = [];
            if (data.danceName) fields.push({ label: "Dance", value: data.danceName });
            if (data.choreographers?.length) fields.push({ label: "Choreographer(s)", value: data.choreographers.join(", ") });
            if (data.difficulty) fields.push({ label: "Difficulty", value: data.difficulty });
            if (data.songTitle) fields.push({ label: "Song", value: data.songTitle });
            if (data.artist) fields.push({ label: "Artist", value: data.artist });
            setScrapeFields(fields);
            runSpotifySearch(scrapedTitle, scrapedArtist);
        } catch {
            setScrapeStatus("error");
            setScrapeMsg("CopperKnob scrape failed — using submitted data.");
            runSpotifySearch(dance.songTitle, dance.artist);
        }
    }

    async function runSpotifySearch(title: string, artistName: string) {
        const q = `${title} ${artistName}`.trim();
        if (!q) return;
        setSpotifyStatus("loading");
        setSpotifyError("");
        setSpotifyResults([]);
        setSelectedResult(null);
        try {
            const res = await fetch(`/api/admin/spotify-search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (!res.ok || !Array.isArray(data)) { setSpotifyError(data?.error ?? "Spotify search failed."); setSpotifyStatus("error"); return; }
            setSpotifyResults(data);
            setSelectedResult(data[0] ?? null);
            setSpotifyStatus("done");
        } catch { setSpotifyStatus("error"); }
    }

    async function loadFromUrl() {
        const id = parseSpotifyId(spotifyUrl);
        if (!id) { setUrlError("No track ID found in that URL."); return; }
        setUrlLoading(true);
        setUrlError("");
        try {
            const res = await fetch(`/api/admin/spotify-track?id=${id}`);
            const data = await res.json();
            if (!res.ok) { setUrlError(data.error ?? "Track not found."); }
            else { setUrlTrack(data); }
        } catch { setUrlError("Network error."); }
        finally { setUrlLoading(false); }
    }

    // ── Effective track (based on active tab) ─────────────────────────────
    const effectiveTrack = trackTab === "url" ? urlTrack : selectedResult;
    const primaryId = effectiveTrack?.id;
    const addedAltIds = additionalTracks.map((t) => t.spotifyId).filter(Boolean) as string[];

    function addAlternative(track: TrackInput) {
        const isDupe = track.spotifyId
            ? (track.spotifyId === primaryId || addedAltIds.includes(track.spotifyId))
            : false;
        if (!isDupe) setAdditionalTracks((prev) => [...prev, track]);
        setShowAltSearch(false);
        setAltSearchSeed(null);
    }

    function buildPrimaryTrack(): TrackInput {
        if (effectiveTrack) return spotifyTrackToInput(effectiveTrack);
        return { name: songTitle.trim(), artists: artist.split(",").map((a) => a.trim()).filter(Boolean) };
    }

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!danceName.trim()) e.danceName = "Required.";
        if (!songTitle.trim()) e.songTitle = "Required.";
        if (!artist.trim()) e.artist = "Required.";
        setErrors(e);
        return Object.keys(e).length === 0;
    }

    async function handleConfirm() {
        if (!validate()) return;
        setSubmitting(true);
        try {
            await onConfirm(buildPrimaryTrack(), {
                danceName: danceName.trim(),
                choreographers,
                difficulty: difficulty.trim(),
                stepsheetUrl: stepsheetUrl.trim(),
            }, additionalTracks);
        } finally { setSubmitting(false); }
    }

    return (
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--accent)", borderRadius: 12 }}>

            {/* ── Header ── */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "rgba(79,70,229,0.04)", display: "flex", alignItems: "center", gap: 10, borderRadius: "11px 11px 0 0" }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{dance.danceName}</span>
                        <Badge label={dance.difficulty} color="blue" />
                        <Badge label="Reviewing" color="green" />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, marginBottom: 0 }}>
                        Submitted {new Date(dance.submittedAt).toLocaleDateString()}
                        {dance.submittedByUserId && ` · User ${dance.submittedByUserId}`}
                    </p>
                </div>
            </div>


            {/* ── Body ── */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 24 }}>

                {/* ── Dance Details ── */}
                <div>
                    <SectionHeader label="Dance Details" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <Field label="Dance Name" required value={danceName}
                            onChange={(v) => { setDanceName(v); setErrors((e) => ({ ...e, danceName: "" })); }}
                            error={errors.danceName} />
                        <div className="grid-2">
                            <Field label="Song Title" required value={songTitle}
                                onChange={(v) => { setSongTitle(v); setErrors((e) => ({ ...e, songTitle: "" })); }}
                                error={errors.songTitle} />
                            <Field label="Artist(s)" required value={artist}
                                onChange={(v) => { setArtist(v); setErrors((e) => ({ ...e, artist: "" })); }}
                                error={errors.artist} hint="Comma-separated" />
                        </div>
                        <ChoreographerTags values={choreographers} onChange={setChoreographers} />
                        <div className="grid-2">
                            <Field label="Difficulty" value={difficulty} onChange={setDifficulty} />
                            {dance.count && <Field label="Count" value={dance.count} readOnly />}
                        </div>
                        {dance.wall && (
                            <Field label="Wall" value={dance.wall} readOnly />
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <Field label="Stepsheet URL" value={stepsheetUrl} onChange={setStepsheetUrl} />
                                </div>
                                {stepsheetUrl && (
                                    <a href={stepsheetUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
                                        Open ↗
                                    </a>
                                )}
                                {isCopperKnob(stepsheetUrl) && (
                                    <button type="button"
                                        onClick={() => runScrape(stepsheetUrl)}
                                        disabled={scrapeStatus === "loading"}
                                        style={{
                                            padding: "7px 12px", borderRadius: 7, flexShrink: 0,
                                            border: "1px solid var(--border)",
                                            background: "var(--surface-raised)", color: "var(--text-secondary)",
                                            fontSize: 11, fontWeight: 600, cursor: "pointer",
                                            opacity: scrapeStatus === "loading" ? 0.5 : 1,
                                            whiteSpace: "nowrap",
                                        }}>
                                        {scrapeStatus === "loading" ? "Scraping…" : scrapeStatus === "done" ? "Re-scrape CopperKnob" : "Scrape CopperKnob"}
                                    </button>
                                )}
                            </div>

                            {/* Scrape results inline */}
                            {scrapeStatus === "error" && (
                                <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>⚠ {scrapeMsg}</p>
                            )}
                            {scrapeStatus === "done" && (scrapeFields.length > 0 || scrapeMsg) && (
                                <div style={{
                                    padding: "8px 12px", borderRadius: 7, fontSize: 12,
                                    background: "rgba(79,70,229,0.05)", border: "1px solid rgba(79,70,229,0.15)",
                                    display: "flex", flexDirection: "column", gap: 4,
                                }}>
                                    {scrapeFields.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center" }}>
                                            <span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>✓ Scraped:</span>
                                            {scrapeFields.map(({ label, value }) => (
                                                <span key={label} style={{ color: "var(--text-secondary)" }}>
                                                    <span style={{ color: "var(--text-tertiary)" }}>{label}: </span>
                                                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {scrapeMsg && (
                                        <span style={{ color: "var(--danger)", fontSize: 11 }}>⚠ {scrapeMsg}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Primary Track ── */}
                <div>
                    <SectionHeader label="Primary Track" subtitle="— official choreography song" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                        {/* Tab bar + search button */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <TabBar
                                tabs={[
                                    { value: "search" as TrackTab, label: "Search Spotify" },
                                    { value: "url" as TrackTab, label: "Paste URL" },
                                ]}
                                active={trackTab}
                                onChange={setTrackTab}
                            />
                            {trackTab === "search" && (
                                <button type="button"
                                    onClick={() => runSpotifySearch(songTitle, artist)}
                                    disabled={spotifyStatus === "loading"}
                                    style={{
                                        padding: "6px 14px", borderRadius: 7,
                                        border: "1px solid var(--border)",
                                        background: "var(--surface-raised)", color: "var(--text-secondary)",
                                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                                        opacity: spotifyStatus === "loading" ? 0.5 : 1,
                                    }}>
                                    {spotifyStatus === "loading" ? "Searching…" : "Re-search"}
                                </button>
                            )}
                        </div>

                        {/* Search pane */}
                        {trackTab === "search" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {spotifyStatus === "error" && (
                                    <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>
                                        {spotifyError || "Spotify search failed."} Use Paste URL to link a track manually.
                                    </p>
                                )}
                                {spotifyStatus === "loading" && (
                                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>Searching…</p>
                                )}
                                {spotifyStatus === "done" && spotifyResults.length === 0 && (
                                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
                                        No results. Try editing Song Title / Artist above and click Re-search, or use Paste URL.
                                    </p>
                                )}
                                {spotifyResults.map((track) => (
                                    <SpotifyTrackCard key={track.id} track={track}
                                        selected={selectedResult?.id === track.id}
                                        onSelect={() => setSelectedResult((prev) => prev?.id === track.id ? null : track)}
                                    />
                                ))}
                                {spotifyStatus === "done" && !selectedResult && spotifyResults.length > 0 && (
                                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0", fontStyle: "italic" }}>
                                        No track selected — will save without a Spotify link.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* URL pane */}
                        {trackTab === "url" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input type="text" placeholder="https://open.spotify.com/track/…"
                                        value={spotifyUrl}
                                        onChange={(e) => { setSpotifyUrl(e.target.value); setUrlError(""); }}
                                        style={{ ...inputStyle, padding: "7px 10px" }} />
                                    <button type="button" onClick={loadFromUrl}
                                        disabled={urlLoading || !spotifyUrl.trim()}
                                        style={{
                                            padding: "7px 16px", borderRadius: 7, border: "none",
                                            background: "var(--accent)", color: "white",
                                            fontSize: 13, fontWeight: 600, cursor: "pointer",
                                            whiteSpace: "nowrap", flexShrink: 0,
                                            opacity: urlLoading || !spotifyUrl.trim() ? 0.6 : 1,
                                        }}>
                                        {urlLoading ? "…" : "Load"}
                                    </button>
                                </div>
                                {urlError && <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>{urlError}</p>}
                                {urlTrack && (
                                    <SpotifyTrackCard track={urlTrack} selected
                                        onSelect={() => setUrlTrack(null)} />
                                )}
                                {!urlTrack && !urlError && (
                                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                                        Paste a Spotify track link and click Load.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Alternative Tracks ── */}
                <div>
                    <SectionHeader label="Alternative Tracks" subtitle="— other songs this dance is commonly danced to" />

                    {/* Discrepancy banner */}
                    {submittedVsScraped && (
                        <div style={{
                            padding: "10px 12px", borderRadius: 8, marginBottom: 12,
                            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
                            display: "flex", alignItems: "center", gap: 10,
                        }}>
                            <div style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)" }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>User submitted:</span>
                                {" "}&ldquo;{submittedVsScraped.title}&rdquo; by {submittedVsScraped.artist}
                                {" "}— CopperKnob shows a different song above.
                            </div>
                            <button type="button"
                                onClick={() => { setAltSearchSeed(submittedVsScraped); setShowAltSearch(true); }}
                                style={{
                                    padding: "4px 10px", borderRadius: 6,
                                    border: "1px solid rgba(245,158,11,0.5)",
                                    background: "rgba(245,158,11,0.1)", color: "#92400e",
                                    fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                                }}>
                                Add as alternative
                            </button>
                        </div>
                    )}

                    {/* Added alternatives */}
                    {additionalTracks.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                            {additionalTracks.map((t, i) => (
                                <AltTrackChip key={t.spotifyId ?? i} track={t}
                                    onRemove={() => setAdditionalTracks((prev) => prev.filter((_, j) => j !== i))} />
                            ))}
                        </div>
                    )}

                    {showAltSearch ? (
                        <AltTrackSearch
                            initialTitle={altSearchSeed?.title ?? ""}
                            initialArtist={altSearchSeed?.artist ?? ""}
                            alreadyAdded={addedAltIds}
                            primaryTrackId={primaryId}
                            onAdd={addAlternative}
                            onCancel={() => { setShowAltSearch(false); setAltSearchSeed(null); }}
                        />
                    ) : (
                        <button type="button" onClick={() => { setAltSearchSeed(null); setShowAltSearch(true); }}
                            style={{
                                padding: "6px 12px", borderRadius: 7,
                                border: "1px dashed var(--border)", background: "transparent",
                                color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                            }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                            Add alternative track
                        </button>
                    )}
                </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
                padding: "12px 20px", borderTop: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--surface-raised)", borderRadius: "0 0 11px 11px",
            }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {effectiveTrack ? (
                        <>
                            Primary: <strong style={{ color: "var(--text-primary)" }}>{effectiveTrack.name}</strong>
                            {additionalTracks.length > 0 && (
                                <> · <span style={{ color: "var(--accent-text)" }}>
                                    +{additionalTracks.length} alternative{additionalTracks.length > 1 ? "s" : ""}
                                </span></>
                            )}
                        </>
                    ) : "No Spotify track — will save song info as entered."}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <ActionButton label="Cancel" variant="ghost" onClick={onCancel} loading={false} />
                    <ActionButton label="Confirm Approve" variant="success" loading={submitting} onClick={handleConfirm} />
                </div>
            </div>
        </div>
    );
}

// ── DanceCard ─────────────────────────────────────────────────────────────────

function DanceCard({ dance, onRemove }: { dance: PendingDance; onRemove: (id: string) => void }) {
    const [approving, setApproving] = useState(false);
    const [denying, setDenying] = useState(false);

    async function deny() {
        setDenying(true);
        try {
            await fetch(`/api/admin/dances/${dance.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "deny" }),
            });
            onRemove(dance.id);
        } finally { setDenying(false); }
    }

    async function handleConfirm(track: TrackInput, overrides: DanceOverrides, additionalTracks: TrackInput[]) {
        const res = await fetch(`/api/admin/dances/${dance.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve", track, overrides, additionalTracks }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Server error ${res.status}`);
        }
        onRemove(dance.id);
    }

    if (approving) {
        return <ApprovePanel dance={dance} onConfirm={handleConfirm} onCancel={() => setApproving(false)} />;
    }

    return (
        <ExpandableCard
            title={dance.danceName}
            subtitle={`${dance.songTitle} · ${dance.artist}`}
            badge={<Badge label={dance.difficulty} color="blue" />}
            meta={`Submitted ${new Date(dance.submittedAt).toLocaleDateString()}`}
            actions={
                <>
                    <ActionButton label="Review" variant="primary" loading={false} onClick={() => setApproving(true)} />
                    <ActionButton label="Deny" variant="danger" loading={denying} onClick={deny} />
                </>
            }
        >
            <InfoRow label="Choreographer" value={dance.choreographer} />
            {dance.count && <InfoRow label="Count" value={dance.count} />}
            {dance.wall && <InfoRow label="Wall" value={dance.wall} />}
            {dance.stepsheetUrl && (
                <InfoRow label="Stepsheet">
                    <a href={dance.stepsheetUrl} target="_blank" rel="noopener noreferrer"
                        style={{ color: "var(--accent-text)", fontSize: 13 }}>
                        View stepsheet ↗
                    </a>
                </InfoRow>
            )}
            {dance.submittedByUserId && <InfoRow label="Submitted by" value={dance.submittedByUserId} mono />}
        </ExpandableCard>
    );
}

// ── NewDanceCard ──────────────────────────────────────────────────────────────

const BLANK_DANCE: PendingDance = {
    id: "new",
    danceName: "",
    songTitle: "",
    artist: "",
    choreographer: "",
    difficulty: "Beginner",
    stepsheetUrl: null,
    submittedByUserId: null,
    submittedAt: new Date().toISOString(),
};

function NewDanceCard({ onDone }: { onDone: () => void }) {
    async function handleConfirm(track: TrackInput, overrides: DanceOverrides, additionalTracks: TrackInput[]) {
        const res = await fetch("/api/admin/dances", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ track, overrides, additionalTracks }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Server error ${res.status}`);
        }
        onDone();
    }

    return <ApprovePanel dance={BLANK_DANCE} onConfirm={handleConfirm} onCancel={onDone} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DancesPage() {
    const [dances, setDances] = useState<PendingDance[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewDance, setShowNewDance] = useState(false);

    useEffect(() => {
        fetch("/api/admin/dances")
            .then((r) => r.json())
            .then((data) => setDances(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    }, []);

    const addButton = (
        <button
            type="button"
            onClick={() => setShowNewDance(true)}
            disabled={showNewDance}
            style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: "1px solid var(--accent)", background: "transparent",
                color: "var(--accent-text)", cursor: showNewDance ? "default" : "pointer",
                opacity: showNewDance ? 0.4 : 1,
            }}
        >
            + Add Dance
        </button>
    );

    return (
        <PageShell title="Pending Dances" count={dances.length} loading={loading} actions={addButton}>
            {showNewDance && (
                <NewDanceCard onDone={() => setShowNewDance(false)} />
            )}
            {dances.length === 0 && !loading && !showNewDance
                ? <EmptyState message="No dances pending review." />
                : dances.map((dance) => (
                    <DanceCard
                        key={dance.id}
                        dance={dance}
                        onRemove={(id) => setDances((prev) => prev.filter((d) => d.id !== id))}
                    />
                ))
            }
        </PageShell>
    );
}
