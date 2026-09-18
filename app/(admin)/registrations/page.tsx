"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type EventMeta } from "@/lib/eventTemplates";

interface VenueDoc {
    _id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
}

function venueAddress(v: VenueDoc) {
    return [v.address, v.city, v.state].filter(Boolean).join(", ");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDateLong(iso: string) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
}

function formatDateShort(iso: string) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmt12(t: string) {
    if (!t) return "";
    const [h, min] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${period}`;
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
    title: string;
    shortTitle: string;
    dateISO: string;
    startTime: string;
    endTime: string;
    venueName: string;
    venueAddress: string;
    slugOverride: string;
}

const BLANK: FormState = {
    title: "", shortTitle: "", dateISO: "",
    startTime: "12:00", endTime: "16:00",
    venueName: "", venueAddress: "", slugOverride: "",
};

function buildPayload(f: FormState) {
    const short = f.shortTitle.trim() || f.title.trim();
    const autoSlug = slugify(`${short} ${f.dateISO}`);
    const timeParts = [f.startTime, f.endTime].filter(Boolean).map(fmt12);
    return {
        title: f.title.trim(),
        shortTitle: short,
        slug: f.slugOverride.trim() || autoSlug,
        date: formatDateLong(f.dateISO),
        dateShort: formatDateShort(f.dateISO),
        time: timeParts.join(" – "),
        venueName: f.venueName.trim(),
        venueAddress: f.venueAddress.trim(),
    };
}

function derivedSlug(f: FormState) {
    const short = f.shortTitle.trim() || f.title.trim();
    return f.slugOverride.trim() || slugify(`${short} ${f.dateISO}`);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SpecialEventsPage() {
    const [events, setEvents] = useState<EventMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormState>(BLANK);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [venues, setVenues] = useState<VenueDoc[]>([]);

    async function load() {
        setLoading(true);
        fetch("/api/admin/events")
            .then(r => r.ok ? r.json() : [])
            .then(setEvents)
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        fetch("/api/admin/bld/venues")
            .then(r => r.ok ? r.json() : [])
            .then(setVenues)
            .catch(() => {});
    }, []);

    useEffect(() => { load(); }, []);

    function set<K extends keyof FormState>(field: K, value: FormState[K]) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setSaveError(null);
        try {
            const payload = buildPayload(form);
            const res = await fetch("/api/admin/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) { setSaveError(data.error ?? "Failed to create event"); return; }
            setForm(BLANK);
            setShowForm(false);
            await load();
        } catch {
            setSaveError("Network error");
        } finally {
            setSaving(false);
        }
    }

    const slug = derivedSlug(form);
    const previewDate = form.dateISO ? formatDateLong(form.dateISO) : null;
    const previewTime = [form.startTime, form.endTime].filter(Boolean).map(fmt12).join(" – ");

    return (
        <div className="page-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Special Events</h1>
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Manage registrations and request tallies for special events.</p>
                </div>
                <button
                    onClick={() => { setShowForm(s => !s); setSaveError(null); setForm(BLANK); }}
                    style={{
                        fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 8,
                        border: "1px solid var(--accent)", background: showForm ? "transparent" : "var(--accent)",
                        color: showForm ? "var(--accent-text)" : "#fff",
                        cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    }}
                >
                    {showForm ? "Cancel" : "+ Add Event"}
                </button>
            </div>

            {/* Add event form */}
            {showForm && (
                <form onSubmit={handleCreate} style={{
                    background: "var(--surface)", border: "1px solid var(--accent)",
                    borderRadius: 12, padding: "20px 24px", marginBottom: 28,
                }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>New Event</p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>

                        {/* Title */}
                        <Field label="Title" span>
                            <input
                                value={form.title}
                                onChange={e => set("title", e.target.value)}
                                required
                                placeholder="Intermediate Line Dance Social"
                                style={inputStyle}
                            />
                        </Field>

                        {/* Short title */}
                        <Field label="Short Title" hint="Used in nav and email subjects">
                            <input
                                value={form.shortTitle}
                                onChange={e => set("shortTitle", e.target.value)}
                                placeholder={form.title || "Int LD Social"}
                                style={inputStyle}
                            />
                        </Field>

                        {/* Date */}
                        <Field label="Date">
                            <input
                                type="date"
                                value={form.dateISO}
                                onChange={e => set("dateISO", e.target.value)}
                                required
                                style={inputStyle}
                            />
                            {previewDate && (
                                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{previewDate}</p>
                            )}
                        </Field>

                        {/* Start + end time */}
                        <Field label="Time">
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                    type="time"
                                    value={form.startTime}
                                    onChange={e => set("startTime", e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>–</span>
                                <input
                                    type="time"
                                    value={form.endTime}
                                    onChange={e => set("endTime", e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                            </div>
                            {previewTime && (
                                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{previewTime}</p>
                            )}
                        </Field>

                        {/* Venue — typeahead across both columns */}
                        <Field label="Venue" hint="Type to search, or enter a new one" span>
                            <VenueTypeahead
                                venues={venues}
                                venueName={form.venueName}
                                venueAddress={form.venueAddress}
                                onChangeName={v => set("venueName", v)}
                                onChangeAddress={v => set("venueAddress", v)}
                                onSelect={v => {
                                    set("venueName", v.name);
                                    set("venueAddress", venueAddress(v));
                                }}
                            />
                        </Field>

                        {/* Slug — full width, editable but shows auto-generated preview */}
                        <Field label="Slug" hint="Auto-generated — edit to override" span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "var(--text-tertiary)", flexShrink: 0 }}>/registrations/</span>
                                <input
                                    value={form.slugOverride}
                                    onChange={e => set("slugOverride", e.target.value)}
                                    placeholder={slug || "event-slug"}
                                    style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                                />
                            </div>
                            {slug && !form.slugOverride && (
                                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                                    Will use: <code style={{ fontFamily: "monospace" }}>{slug}</code>
                                </p>
                            )}
                        </Field>
                    </div>

                    {saveError && (
                        <p style={{ fontSize: 12, color: "var(--danger-text)", marginTop: 12 }}>{saveError}</p>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                        <button type="submit" disabled={saving} style={{
                            fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 8,
                            border: "none", background: "var(--accent)", color: "#fff",
                            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                        }}>
                            {saving ? "Creating…" : "Create Event"}
                        </button>
                        <button type="button" onClick={() => { setShowForm(false); setForm(BLANK); }} style={{
                            fontSize: 13, padding: "8px 16px", borderRadius: 8,
                            border: "1px solid var(--border)", background: "transparent",
                            color: "var(--text-secondary)", cursor: "pointer",
                        }}>Cancel</button>
                    </div>
                </form>
            )}

            {/* Event list */}
            {loading ? (
                <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>
            ) : events.length === 0 ? (
                <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                    padding: "48px 24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 14,
                }}>
                    No events yet. Click <strong>+ Add Event</strong> to create one.
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {events.map(ev => (
                        <Link key={ev.slug} href={`/registrations/${ev.slug}`} style={{ textDecoration: "none" }}>
                            <div style={{
                                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                                padding: "16px 20px", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                                transition: "border-color 0.15s",
                            }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                            >
                                <div>
                                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{ev.shortTitle}</p>
                                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                                        {ev.date}{ev.time ? ` · ${ev.time}` : ""}
                                    </p>
                                    {ev.venueName && (
                                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{ev.venueName}</p>
                                    )}
                                </div>
                                <span style={{ fontSize: 18, color: "var(--text-tertiary)", flexShrink: 0 }}>→</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Venue typeahead ───────────────────────────────────────────────────────────

function VenueTypeahead({ venues, venueName, venueAddress: addrValue, onChangeName, onChangeAddress, onSelect }: {
    venues: VenueDoc[];
    venueName: string;
    venueAddress: string;
    onChangeName: (v: string) => void;
    onChangeAddress: (v: string) => void;
    onSelect: (v: VenueDoc) => void;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filtered = venueName.trim()
        ? venues.filter(v => v.name.toLowerCase().includes(venueName.toLowerCase()))
        : venues;

    // Close on outside click
    useEffect(() => {
        function handle(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    return (
        <div ref={containerRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
            {/* Name with dropdown */}
            <div style={{ position: "relative" }}>
                <input
                    value={venueName}
                    onChange={e => { onChangeName(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Midnight Toad"
                    style={inputStyle}
                    autoComplete="off"
                />
                {open && filtered.length > 0 && (
                    <div style={{
                        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 8, zIndex: 50, overflow: "hidden",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                        maxHeight: 220, overflowY: "auto",
                    }}>
                        {filtered.map((v, i) => (
                            <button
                                key={v._id}
                                type="button"
                                onMouseDown={e => { e.preventDefault(); onSelect(v); setOpen(false); }}
                                style={{
                                    display: "block", width: "100%", textAlign: "left",
                                    padding: "9px 12px", border: "none",
                                    borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                                    background: "transparent", cursor: "pointer",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-raised)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{v.name}</p>
                                {venueAddress(v) && (
                                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{venueAddress(v)}</p>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Address */}
            <input
                value={addrValue}
                onChange={e => onChangeAddress(e.target.value)}
                placeholder="5302 S Federal Cir #A, Littleton, CO 80123"
                style={inputStyle}
            />
        </div>
    );
}

// ── Shared styles / sub-components ───────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 6,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
};

function Field({ label, hint, span, children }: {
    label: string; hint?: string; span?: boolean; children: React.ReactNode;
}) {
    return (
        <div style={span ? { gridColumn: "1 / -1" } : {}}>
            <p style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6,
            }}>
                {label}
                {hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, opacity: 0.75 }}>— {hint}</span>}
            </p>
            {children}
        </div>
    );
}
