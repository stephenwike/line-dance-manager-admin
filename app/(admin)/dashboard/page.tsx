"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui";
import { parseTime12ToMinutes, minutesToTime12 } from "@/lib/time";

// ── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
    time: string | null;
    danceId: string | null;
    dance: string | null;
    level: string | null;
    link: string | null;
    committed: boolean;
}
interface CommitEvent {
    _id: string; eventTypeId: string; date: string; startTime: string; endTime: string;
    lessons: Lesson[];
    eventType: { title: string; level: string } | null;
}
interface Occurrence {
    key: string; eventTypeId: string; date: string; startTime: string;
    durationMinutes: number; endTime: string | null;
    eventType: { _id: string; title: string; level: string } | null;
}
interface Stats {
    dances: number; instructorClaims: number; venueClaims: number;
    reports: number; feedSessions: number; feedTransactions: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function ymd(d: Date) { return d.toISOString().slice(0, 10); }

function distributeTimes(startTime: string, endTime: string, count: number): Array<string | null> {
    if (count === 0) return [];
    const s = parseTime12ToMinutes(startTime);
    const e = parseTime12ToMinutes(endTime);
    if (s === null || e === null || e <= s) return Array(count).fill(null);
    const spacing = (e - s) / count;
    return Array.from({ length: count }, (_, i) => minutesToTime12(Math.round(s + i * spacing)));
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function fmtDate(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function todayLong() {
    return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub, href, linkLabel }: { title: string; sub: string; href?: string; linkLabel?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{sub}</p>
            </div>
            {href && (
                <Link href={href} style={{ fontSize: 12, color: "var(--accent-text)", textDecoration: "underline", flexShrink: 0 }}>
                    {linkLabel}
                </Link>
            )}
        </div>
    );
}

function GreenCheck({ label }: { label: string }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 18px", borderRadius: 10,
            background: "var(--success-subtle)", border: "1px solid rgba(16,185,129,0.2)",
            fontSize: 13, fontWeight: 500, color: "var(--success-text)",
        }}>
            <span style={{ fontSize: 15 }}>✓</span>
            {label}
        </div>
    );
}

// ── Dance search ─────────────────────────────────────────────────────────────

interface DanceHit { _id: string; danceName: string; stepsheet: string | null; difficulty: string | null }

function DanceSearchInput({ value, danceId, disabled, onChange, onPick, onClear }: {
    value: string;
    danceId: string | null;
    disabled?: boolean;
    onChange: (v: string) => void;
    onPick: (hit: DanceHit) => void;
    onClear: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hits, setHits] = useState<DanceHit[]>([]);
    const latestRef = useRef("");

    useEffect(() => {
        if (danceId) { setHits([]); setOpen(false); return; }
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
    }, [value, danceId]);

    if (danceId) {
        return (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", padding: "5px 0" }}>{value}</span>
                <button type="button" onClick={onClear} disabled={disabled}
                    style={{ fontSize: 11, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", flexShrink: 0 }}>
                    clear
                </button>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, position: "relative" }}>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="Search dance…"
                onFocus={() => { if (hits.length > 0) setOpen(true); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                style={{
                    width: "100%", padding: "5px 8px", fontSize: 13, borderRadius: 6,
                    border: "1px solid var(--border)", background: "var(--surface-raised)",
                    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
                }}
            />
            {(open || loading) && (
                <div style={{ position: "absolute", zIndex: 50, top: "100%", marginTop: 2, left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 180, overflowY: "auto" }}>
                    {loading ? (
                        <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>Searching…</p>
                    ) : hits.length === 0 ? (
                        <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>No results</p>
                    ) : hits.map((h) => (
                        <button key={h._id} type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { onPick(h); setOpen(false); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{h.danceName}</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{h.difficulty ?? "No level"}{h.stepsheet ? " · has stepsheet" : ""}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── TaughtCard ───────────────────────────────────────────────────────────────

type LessonRow = {
    id: string;
    dance: string;
    committed: boolean;
    time: string | null;
    level: string | null;
    danceId: string | null;
    link: string | null;
};

function TaughtCard({ ev, onDone }: { ev: CommitEvent; onDone: () => void }) {
    const [rows, setRows] = useState<LessonRow[]>(() =>
        ev.lessons.map((l) => ({
            id: uid(),
            dance: l.dance ?? "",
            committed: l.committed,
            time: l.time,
            level: l.level,
            danceId: l.danceId,
            link: l.link,
        }))
    );
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [savedMsg, setSavedMsg] = useState(false);
    const [done, setDone] = useState(false);

    function updateRow(id: string, patch: Partial<LessonRow>) {
        setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
        setSavedMsg(false);
    }

    function addRow() {
        setRows((prev) => [...prev, { id: uid(), dance: "", committed: false, time: null, level: null, danceId: null, link: null }]);
        setSavedMsg(false);
    }

    function removeRow(id: string) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setSavedMsg(false);
    }

    function buildLessons(markTaught: boolean) {
        const times = distributeTimes(ev.startTime, ev.endTime, rows.length);
        return rows.map((r, i) => ({
            time: times[i] ?? null,
            danceId: r.danceId,
            dance: r.dance.trim() || null,
            level: r.level,
            link: r.link,
            committed: markTaught ? true : r.committed,
        }));
    }

    async function patchEvent(lessons: object[]) {
        const res = await fetch(`/api/admin/bld/events/${ev._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessons }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
    }

    async function save() {
        setSaving(true);
        setErr(null);
        try {
            await patchEvent(buildLessons(false));
            setSavedMsg(true);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    async function markTaught() {
        setSaving(true);
        setErr(null);
        try {
            await patchEvent(buildLessons(true));
            setDone(true);
            setTimeout(onDone, 1500);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    async function skip() {
        setSaving(true);
        setErr(null);
        try {
            await patchEvent([]);
            onDone();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    if (done) {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "var(--success-subtle)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span style={{ fontSize: 20, color: "var(--success)" }}>✓</span>
                <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--success-text)" }}>{ev.eventType?.title ?? ev.eventTypeId}</p>
                    <p style={{ fontSize: 12, color: "var(--success-text)", opacity: 0.8, marginTop: 2 }}>{fmtDate(ev.date)} · marked taught</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                    {ev.eventType?.title ?? ev.eventTypeId}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                    {fmtDate(ev.date)} · {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ""}
                    {ev.eventType?.level && <span style={{ color: "var(--text-tertiary)" }}> · {ev.eventType.level}</span>}
                </p>
            </div>

            {/* Lesson rows */}
            <div style={{ padding: "10px 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "4px 0" }}>No lessons yet. Add one below or skip this event.</p>
                )}
                {rows.map((r, i) => {
                    const previewTimes = distributeTimes(ev.startTime, ev.endTime, rows.length);
                    const previewTime = previewTimes[i] ?? null;
                    return (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {previewTime && (
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0, width: 68 }}>
                                    {previewTime}
                                </span>
                            )}
                            <DanceSearchInput
                                value={r.dance}
                                danceId={r.danceId}
                                disabled={saving}
                                onChange={(v) => updateRow(r.id, { dance: v, danceId: null })}
                                onPick={(hit) => updateRow(r.id, { dance: hit.danceName, danceId: hit._id, link: hit.stepsheet ?? r.link })}
                                onClear={() => updateRow(r.id, { dance: "", danceId: null })}
                            />
                            <button
                                type="button"
                                onClick={() => removeRow(r.id)}
                                disabled={saving}
                                style={{ fontSize: 16, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: "2px 4px", flexShrink: 0 }}
                            >
                                ×
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Add row */}
            <div style={{ padding: "8px 16px 0" }}>
                <button
                    type="button"
                    onClick={addRow}
                    disabled={saving}
                    style={{ fontSize: 18, lineHeight: 1, color: "var(--accent-text)", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}
                >
                    +
                </button>
            </div>

            {/* Footer */}
            {err && <p style={{ margin: "8px 16px 0", fontSize: 12, color: "var(--danger)" }}>{err}</p>}
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <ActionButton label={saving ? "Saving…" : "Save"} variant="ghost" loading={saving} onClick={save} />
                <ActionButton label={saving ? "Saving…" : "Mark Taught"} loading={saving} onClick={markTaught} />
                {savedMsg && !err && (
                    <span style={{ fontSize: 12, color: "var(--success-text)", fontWeight: 600 }}>✓ Saved</span>
                )}
                <button
                    type="button"
                    onClick={skip}
                    disabled={saving}
                    style={{ fontSize: 12, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginLeft: "auto" }}
                >
                    Skip event
                </button>
                <Link href={`/events/${ev._id}`} style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "underline" }}>
                    Open event ↗
                </Link>
            </div>
        </div>
    );
}

// ── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({ occ }: { occ: Occurrence }) {
    const href = `/plan-lesson?eventTypeId=${occ.eventTypeId}&date=${occ.date}&startTime=${encodeURIComponent(occ.startTime)}&durationMinutes=${occ.durationMinutes}&title=${encodeURIComponent(occ.eventType?.title ?? "")}`;
    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {occ.eventType?.title ?? occ.eventTypeId}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                        {fmtDate(occ.date)} · {occ.startTime}
                        {occ.endTime ? ` – ${occ.endTime}` : ""}
                        {occ.eventType?.level && <span style={{ color: "var(--text-tertiary)" }}> · {occ.eventType.level}</span>}
                    </p>
                </div>
                <Link
                    href={href}
                    style={{
                        fontSize: 13, fontWeight: 600, color: "var(--accent-text)",
                        textDecoration: "none", background: "var(--accent-subtle)",
                        padding: "6px 14px", borderRadius: 8, flexShrink: 0,
                        whiteSpace: "nowrap",
                    }}
                >
                    Plan →
                </Link>
            </div>
        </div>
    );
}

// ── RandomPickerWidget ───────────────────────────────────────────────────────

const DIFFICULTIES = ["Beginner", "Improver", "Intermediate", "Advanced"] as const;

interface PickedDance {
    id: string;
    danceName: string;
    difficulty: string;
    choreographerNames: string[];
    stepsheet: string | null;
}

interface ChoreographerOption {
    id: string;
    name: string;
}

function difficultyChipColor(d: string) {
    switch (d.toLowerCase()) {
        case "beginner": return { bg: "#f0fdf4", border: "#86efac", text: "#166534" };
        case "improver": return { bg: "#f0f9ff", border: "#7dd3fc", text: "#075985" };
        case "intermediate": return { bg: "#fff7ed", border: "#fdba74", text: "#9a3412" };
        case "advanced": return { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" };
        default: return { bg: "var(--surface-raised)", border: "var(--border)", text: "var(--text-secondary)" };
    }
}

function RandomPickerWidget() {
    const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
    const [selectedChoreographers, setSelectedChoreographers] = useState<ChoreographerOption[]>([]);
    const [choreoQuery, setChoreoQuery] = useState("");
    const [choreoSuggestions, setChoreoSuggestions] = useState<ChoreographerOption[]>([]);
    const [choreoOpen, setChoreoOpen] = useState(false);
    const [count, setCount] = useState(5);
    const [picking, setPicking] = useState(false);
    const [picks, setPicks] = useState<PickedDance[]>([]);
    const [pickErr, setPickErr] = useState("");
    const [noneFound, setNoneFound] = useState(false);

    useEffect(() => {
        const q = choreoQuery.trim();
        if (q.length < 2) { setChoreoSuggestions([]); setChoreoOpen(false); return; }
        const t = setTimeout(async () => {
            try {
                const data = await fetch(`/api/admin/choreographers?q=${encodeURIComponent(q)}`).then(r => r.json());
                const filtered = (Array.isArray(data) ? data : [])
                    .filter((c: { id: string }) => !selectedChoreographers.some(s => s.id === c.id))
                    .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
                setChoreoSuggestions(filtered);
                setChoreoOpen(filtered.length > 0);
            } catch { setChoreoSuggestions([]); }
        }, 250);
        return () => clearTimeout(t);
    }, [choreoQuery, selectedChoreographers]);

    function toggleDifficulty(d: string) {
        setSelectedDifficulties(prev =>
            prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
        );
        setPicks([]);
        setNoneFound(false);
    }

    function addChoreographer(c: ChoreographerOption) {
        setSelectedChoreographers(prev => [...prev, c]);
        setChoreoQuery("");
        setChoreoSuggestions([]);
        setChoreoOpen(false);
        setPicks([]);
        setNoneFound(false);
    }

    function removeChoreographer(id: string) {
        setSelectedChoreographers(prev => prev.filter(c => c.id !== id));
        setPicks([]);
        setNoneFound(false);
    }

    async function pick() {
        setPicking(true);
        setPickErr("");
        setNoneFound(false);
        try {
            const res = await fetch("/api/admin/dances/random", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    difficulties: selectedDifficulties,
                    choreographerIds: selectedChoreographers.map(c => c.id),
                    count,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            if (Array.isArray(data) && data.length === 0) { setNoneFound(true); setPicks([]); }
            else setPicks(Array.isArray(data) ? data : []);
        } catch (e: unknown) {
            setPickErr(e instanceof Error ? e.message : "Failed to fetch");
        } finally {
            setPicking(false);
        }
    }

    const chipBase: React.CSSProperties = {
        padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
        border: "1px solid", cursor: "pointer", background: "none",
        transition: "opacity 0.1s",
    };

    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            {/* Filters */}
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Difficulty */}
                <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                        Difficulty
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {DIFFICULTIES.map(d => {
                            const active = selectedDifficulties.includes(d);
                            const col = difficultyChipColor(d);
                            return (
                                <button key={d} onClick={() => toggleDifficulty(d)} style={{
                                    ...chipBase,
                                    background: active ? col.bg : "none",
                                    borderColor: active ? col.border : "var(--border)",
                                    color: active ? col.text : "var(--text-secondary)",
                                }}>
                                    {d}
                                </button>
                            );
                        })}
                        {selectedDifficulties.length > 0 && (
                            <button onClick={() => { setSelectedDifficulties([]); setPicks([]); setNoneFound(false); }} style={{
                                ...chipBase, borderColor: "transparent", color: "var(--text-tertiary)", fontSize: 11,
                            }}>
                                clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Choreographers */}
                <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                        Choreographers
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: selectedChoreographers.length > 0 ? 8 : 0 }}>
                        {selectedChoreographers.map(c => (
                            <span key={c.id} style={{
                                display: "flex", alignItems: "center", gap: 5,
                                padding: "3px 10px", borderRadius: 20, fontSize: 12,
                                background: "var(--accent-subtle)", border: "1px solid var(--accent-border, var(--border))",
                                color: "var(--accent-text)",
                            }}>
                                {c.name}
                                <button onClick={() => removeChoreographer(c.id)} style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    color: "var(--accent-text)", fontSize: 13, lineHeight: 1, padding: 0, opacity: 0.6,
                                }}>×</button>
                            </span>
                        ))}
                    </div>
                    <div style={{ position: "relative", maxWidth: 280 }}>
                        <input
                            value={choreoQuery}
                            onChange={e => setChoreoQuery(e.target.value)}
                            onFocus={() => { if (choreoSuggestions.length > 0) setChoreoOpen(true); }}
                            onBlur={() => setTimeout(() => setChoreoOpen(false), 150)}
                            placeholder="Search choreographer…"
                            style={{
                                width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 8,
                                border: "1px solid var(--border)", background: "var(--surface-raised)",
                                color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
                            }}
                        />
                        {choreoOpen && choreoSuggestions.length > 0 && (
                            <div style={{ position: "absolute", zIndex: 50, top: "100%", marginTop: 2, left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 180, overflowY: "auto" }}>
                                {choreoSuggestions.map(c => (
                                    <button key={c.id} type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => addChoreographer(c)}
                                        style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-raised)")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quantity + Pick button */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Count
                        </p>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={count}
                            onChange={e => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                            style={{
                                width: 60, padding: "5px 8px", fontSize: 13, borderRadius: 8,
                                border: "1px solid var(--border)", background: "var(--surface-raised)",
                                color: "var(--text-primary)", outline: "none", textAlign: "center",
                            }}
                        />
                    </div>
                    <button
                        onClick={pick}
                        disabled={picking}
                        style={{
                            padding: "7px 20px", borderRadius: 8, border: "none",
                            background: "var(--accent)", color: "#fff",
                            fontSize: 13, fontWeight: 600, cursor: picking ? "wait" : "pointer",
                            opacity: picking ? 0.7 : 1,
                        }}
                    >
                        {picking ? "Picking…" : "Pick"}
                    </button>
                    {picks.length > 0 && (
                        <button
                            onClick={pick}
                            disabled={picking}
                            style={{ fontSize: 12, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                        >
                            Re-roll
                        </button>
                    )}
                </div>

                {pickErr && <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>{pickErr}</p>}
            </div>

            {/* Results */}
            {noneFound && (
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-tertiary)" }}>
                    No dances match those filters.
                </div>
            )}
            {picks.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                    {picks.map((d, i) => {
                        const col = difficultyChipColor(d.difficulty);
                        return (
                            <div key={d.id} style={{
                                display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                                borderBottom: i < picks.length - 1 ? "1px solid var(--border)" : "none",
                            }}>
                                <span style={{ fontSize: 12, fontWeight: 700, minWidth: 20, color: "var(--text-tertiary)", textAlign: "right" }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {d.danceName}
                                    </p>
                                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {d.choreographerNames.join(", ") || "Unknown"}
                                    </p>
                                </div>
                                {d.difficulty && (
                                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, border: `1px solid ${col.border}`, color: col.text, background: col.bg, flexShrink: 0 }}>
                                        {d.difficulty}
                                    </span>
                                )}
                                {d.stepsheet && (
                                    <a href={d.stepsheet} target="_blank" rel="noopener noreferrer"
                                        style={{ fontSize: 11, color: "var(--accent-text)", textDecoration: "none", flexShrink: 0 }}>
                                        ↗
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

const STAT_ITEMS = [
    { key: "instructorClaims" as const, label: "Instructor Claims", href: "/instructor-claims", color: "#0891b2" },
    { key: "venueClaims" as const, label: "Venue Claims", href: "/venue-claims", color: "#7c3aed" },
    { key: "reports" as const, label: "Reports", href: "/reports", color: "#dc2626" },
    { key: "feedSessions" as const, label: "Feed Sessions", href: "/feed-reports", color: "#059669" },
    { key: "feedTransactions" as const, label: "Feed Transactions", href: "/feed-transactions", color: "#d97706" },
];

function StatPills({ stats }: { stats: Stats | null }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STAT_ITEMS.map(({ key, label, href, color }) => {
                const val = stats?.[key] ?? 0;
                return (
                    <Link
                        key={key}
                        href={href}
                        style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 14px", borderRadius: 20,
                            background: "var(--surface)", border: "1px solid var(--border)",
                            textDecoration: "none", transition: "box-shadow 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                    >
                        <span style={{ fontSize: 15, fontWeight: 700, color: stats && val > 0 ? color : "var(--text-tertiary)", minWidth: 18, textAlign: "center" }}>
                            {stats ? val : "·"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                    </Link>
                );
            })}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [commitEvents, setCommitEvents] = useState<CommitEvent[]>([]);
    const [unplanned, setUnplanned] = useState<Occurrence[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const now = new Date();
        const today = ymd(now);
        const sevenDaysAgo = ymd(addDays(now, -7));
        const fourteenDaysOut = ymd(addDays(now, 14));

        Promise.all([
            fetch(`/api/admin/bld/commit-lessons?from=${sevenDaysAgo}&to=${today}`).then((r) => r.json()).catch(() => []),
            fetch(`/api/admin/bld/occurrences?from=${today}&to=${fourteenDaysOut}&onlyUnplanned=true`).then((r) => r.json()).catch(() => []),
            fetch("/api/admin/stats").then((r) => r.json()).catch(() => null),
        ]).then(([commits, occs, st]) => {
            const nowMins = now.getHours() * 60 + now.getMinutes();
            const allCommits: CommitEvent[] = Array.isArray(commits) ? commits : [];
            setCommitEvents(allCommits.filter((ev) => {
                if (ev.date < today) return true;
                const startMins = parseTime12ToMinutes(ev.startTime);
                return startMins !== null && startMins <= nowMins;
            }));
            setUnplanned(Array.isArray(occs) ? occs : []);
            setStats(st ?? null);
        }).finally(() => setLoading(false));
    }, []);

    return (
        <div className="page-pad" style={{ maxWidth: 760 }}>
            {/* Greeting */}
            <div style={{ marginBottom: 36 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{greeting()}</h1>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>{todayLong()}</p>
            </div>

            {loading ? (
                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Loading…</div>
            ) : (
                <>
                    {/* Mark as Taught */}
                    <div style={{ marginBottom: 36 }}>
                        <SectionHeader
                            title="Mark as Taught"
                            sub="Past 7 days · lessons from events you haven't marked yet"
                            href="/commit-lessons"
                            linkLabel="See all →"
                        />
                        {commitEvents.length === 0 ? (
                            <GreenCheck label="All recent lessons marked as taught — nice work!" />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {commitEvents.map((ev) => (
                                    <TaughtCard
                                        key={ev._id}
                                        ev={ev}
                                        onDone={() => setCommitEvents((prev) => prev.filter((e) => e._id !== ev._id))}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Needs Planning */}
                    <div style={{ marginBottom: 36 }}>
                        <SectionHeader
                            title="Needs Planning"
                            sub="Next 14 days · no lesson plan yet"
                            href="/lesson-overview"
                            linkLabel="See all →"
                        />
                        {unplanned.length === 0 ? (
                            <GreenCheck label="All upcoming events planned" />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {unplanned.map((occ) => (
                                    <PlanCard key={occ.key} occ={occ} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Random Dance Picker */}
                    <div style={{ marginBottom: 36 }}>
                        <SectionHeader title="Random Dance Picker" sub="Pull dances at random from your catalog" />
                        <RandomPickerWidget />
                    </div>

                    {/* Review Queue */}
                    <div>
                        <SectionHeader title="Review Queue" sub="Pending items across the platform" />
                        <StatPills stats={stats} />
                    </div>
                </>
            )}
        </div>
    );
}
