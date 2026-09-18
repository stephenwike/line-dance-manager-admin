"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type EventMeta } from "@/lib/eventTemplates";

interface NewEventForm {
    title: string;
    shortTitle: string;
    slug: string;
    date: string;
    dateShort: string;
    time: string;
    venueName: string;
    venueAddress: string;
}

const BLANK: NewEventForm = {
    title: "", shortTitle: "", slug: "",
    date: "", dateShort: "", time: "",
    venueName: "", venueAddress: "",
};

function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function SpecialEventsPage() {
    const [events, setEvents] = useState<EventMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<NewEventForm>(BLANK);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        fetch("/api/admin/events")
            .then(r => r.ok ? r.json() : [])
            .then(setEvents)
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); }, []);

    function set(field: keyof NewEventForm, value: string) {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            // Auto-generate slug from shortTitle + dateShort when both are present
            if ((field === "shortTitle" || field === "dateShort") && !prev.slug) {
                const base = `${next.shortTitle} ${next.dateShort}`.trim();
                if (base) next.slug = slugify(base);
            }
            return next;
        });
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setSaveError(null);
        try {
            const res = await fetch("/api/admin/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
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

    return (
        <div className="page-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Special Events</h1>
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Manage registrations and request tallies for special events.</p>
                </div>
                <button
                    onClick={() => { setShowForm(s => !s); setSaveError(null); }}
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
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>New Event</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                        <Field label="Title" placeholder="Intermediate Line Dance Social">
                            <input value={form.title} onChange={e => set("title", e.target.value)} required placeholder="Intermediate Line Dance Social" style={inputStyle} />
                        </Field>
                        <Field label="Short Title" placeholder="Int LD Social">
                            <input value={form.shortTitle} onChange={e => set("shortTitle", e.target.value)} required placeholder="Int LD Social" style={inputStyle} />
                        </Field>
                        <Field label="Date" placeholder="Saturday, October 10, 2026">
                            <input value={form.date} onChange={e => set("date", e.target.value)} required placeholder="Saturday, October 10, 2026" style={inputStyle} />
                        </Field>
                        <Field label="Date (short)" placeholder="Oct 10">
                            <input value={form.dateShort} onChange={e => set("dateShort", e.target.value)} required placeholder="Oct 10" style={inputStyle} />
                        </Field>
                        <Field label="Time" placeholder="12:00 PM – 4:00 PM">
                            <input value={form.time} onChange={e => set("time", e.target.value)} placeholder="12:00 PM – 4:00 PM" style={inputStyle} />
                        </Field>
                        <Field label="Slug" hint="Auto-generated — edit to customize">
                            <input value={form.slug} onChange={e => set("slug", e.target.value)} required placeholder="int-ld-social-oct-10" style={inputStyle} />
                        </Field>
                        <Field label="Venue Name" placeholder="Midnight Toad">
                            <input value={form.venueName} onChange={e => set("venueName", e.target.value)} placeholder="Midnight Toad" style={inputStyle} />
                        </Field>
                        <Field label="Venue Address" placeholder="5302 S Federal Cir #A, Littleton, CO">
                            <input value={form.venueAddress} onChange={e => set("venueAddress", e.target.value)} placeholder="5302 S Federal Cir #A, Littleton, CO" style={inputStyle} />
                        </Field>
                    </div>
                    {saveError && (
                        <p style={{ fontSize: 12, color: "var(--danger-text)", marginTop: 12 }}>{saveError}</p>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        <button type="submit" disabled={saving} style={{
                            fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 8,
                            border: "none", background: "var(--accent)", color: "#fff",
                            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                        }}>
                            {saving ? "Creating…" : "Create Event"}
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} style={{
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

const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 6,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
};

function Field({ label, hint, children, placeholder: _p }: {
    label: string; hint?: string; children: React.ReactNode; placeholder?: string;
}) {
    return (
        <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 4 }}>
                {label}{hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, opacity: 0.75 }}>— {hint}</span>}
            </p>
            {children}
        </div>
    );
}
