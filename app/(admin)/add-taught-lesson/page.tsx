"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface Venue { _id: string; name: string }
interface DanceHit { _id: string; danceName: string; stepsheet: string | null; difficulty: string | null }

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToIso(date: string, time: string): string {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return `${date}T00:00:00-07:00`;
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    if (m[3].toUpperCase() === "PM" && hh !== 12) hh += 12;
    if (m[3].toUpperCase() === "AM" && hh === 12) hh = 0;
    return `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-07:00`;
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

// ── Dance search ──────────────────────────────────────────────────────────────

function DanceSearch({ onPick }: { onPick: (hit: DanceHit) => void }) {
    const [q, setQ] = useState("");
    const [hits, setHits] = useState<DanceHit[]>([]);
    const [loading, setLoading] = useState(false);
    const latestRef = useRef("");

    useEffect(() => {
        const trimmed = q.trim();
        latestRef.current = trimmed;
        if (trimmed.length < 2) { setHits([]); return; }
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await fetch(`/api/admin/bld/dances?q=${encodeURIComponent(trimmed)}`).then((r) => r.json());
                if (latestRef.current !== trimmed) return;
                setHits(Array.isArray(data) ? data : []);
            } finally {
                if (latestRef.current === trimmed) setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [q]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type 2+ letters to search…"
                style={inputStyle}
                autoFocus
            />
            {loading && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Searching…</p>}
            {!loading && q.trim().length >= 2 && hits.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No results for "{q.trim()}"</p>
            )}
            {hits.length > 0 && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    {hits.map((h, i) => (
                        <button
                            key={h._id}
                            type="button"
                            onClick={() => { onPick(h); setQ(""); setHits([]); }}
                            style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "8px 12px", background: "none", border: "none",
                                borderBottom: i < hits.length - 1 ? "1px solid var(--border)" : "none",
                                cursor: "pointer",
                            }}
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

export default function AddTaughtLessonPage() {
    const router = useRouter();
    const [venues, setVenues] = useState<Venue[]>([]);
    const [venueId, setVenueId] = useState("");
    const [date, setDate] = useState(todayLocal);
    const [time, setTime] = useState("");
    const [danceId, setDanceId] = useState<string | null>(null);
    const [danceName, setDanceName] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [successes, setSuccesses] = useState<string[]>([]);

    useEffect(() => {
        fetch("/api/admin/bld/venues")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setVenues(data.map((v) => ({ _id: v._id, name: v.name ?? "" })));
            })
            .catch(() => {});
    }, []);

    function pickDance(hit: DanceHit) {
        setDanceId(hit._id);
        setDanceName(hit.danceName);
    }

    function clearDance() {
        setDanceId(null);
        setDanceName("");
    }

    async function save() {
        setErr(null);
        const venue = venues.find((v) => v._id === venueId)?.name ?? "";
        if (!venue) { setErr("Select a venue"); return; }
        if (!time.trim()) { setErr("Enter a time (e.g. 6:30 PM)"); return; }
        if (!danceId && !danceName.trim()) { setErr("Search for a dance or enter a dance name"); return; }

        setSaving(true);
        try {
            const isoDate = timeToIso(date, time.trim());
            const body: Record<string, string> = { venue, date: isoDate };
            if (danceId) body.danceId = danceId;
            else body.danceName = danceName.trim();

            const res = await fetch("/api/admin/bld/lessons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");

            const label = `${danceName || danceId} · ${venue} · ${date} ${time.trim()}`;
            setSuccesses((prev) => [label, ...prev]);
            setDanceId(null);
            setDanceName("");
            setTime("");
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    const selectedVenueName = venues.find((v) => v._id === venueId)?.name ?? "";

    return (
        <div style={{ padding: "32px 36px", maxWidth: 680 }}>
            <div style={{ marginBottom: 24 }}>
                <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", padding: 0, textDecoration: "underline", marginBottom: 10, display: "block" }}>← Back</button>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Add taught lesson</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Record a lesson you taught when no event plan was posted — saves directly to the lessons collection.
                </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Successes */}
                {successes.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {successes.map((s, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "var(--success-subtle)", border: "1px solid rgba(16,185,129,0.2)" }}>
                                <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span>
                                <span style={{ fontSize: 13, color: "var(--success-text)" }}>{s}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Venue */}
                    <Field label="Venue">
                        <select
                            value={venueId}
                            onChange={(e) => setVenueId(e.target.value)}
                            disabled={saving}
                            style={{ ...inputStyle, cursor: "pointer" }}
                        >
                            <option value="">Select venue…</option>
                            {venues.map((v) => (
                                <option key={v._id} value={v._id}>{v.name}</option>
                            ))}
                        </select>
                    </Field>

                    {/* Date + Time */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <Field label="Date">
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} style={inputStyle} />
                        </Field>
                        <Field label="Time">
                            <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="6:30 PM" disabled={saving} style={inputStyle} />
                        </Field>
                    </div>

                    {/* Dance */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dance</span>
                        {danceId ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, padding: "7px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)" }}>
                                    {danceName}
                                </div>
                                <button type="button" onClick={clearDance} disabled={saving}
                                    style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", flexShrink: 0 }}>
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <DanceSearch onPick={pickDance} />
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>or enter manually</span>
                                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                                </div>
                                <input
                                    value={danceName}
                                    onChange={(e) => setDanceName(e.target.value)}
                                    placeholder="Dance name (no database match needed)"
                                    disabled={saving}
                                    style={inputStyle}
                                />
                            </div>
                        )}
                    </div>

                    {err && <p style={{ fontSize: 13, color: "var(--danger)" }}>{err}</p>}

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <ActionButton label={saving ? "Saving…" : "Save lesson"} loading={saving} onClick={save} />
                        {selectedVenueName && date && time.trim() && (danceName || danceId) && (
                            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                                {danceName} · {selectedVenueName} · {date}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
