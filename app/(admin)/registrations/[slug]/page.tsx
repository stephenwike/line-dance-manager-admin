"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { type EventMeta } from "@/lib/eventTemplates";

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Parse "Saturday, September 19, 2026" → "2026-09-19"
function parseDateISO(longDate: string): string {
    try {
        const d = new Date(longDate);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        }
    } catch { /* empty */ }
    return "";
}

// Parse "12:00 PM" → "12:00" (HH:MM 24h)
function parseTime24(t: string): string {
    const match = t.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return "";
    let h = parseInt(match[1]);
    const min = match[2];
    const period = match[3].toUpperCase();
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
}

// Parse "12:00 PM – 4:00 PM" → { start: "12:00", end: "16:00" }
function parseTimeRange(range: string): { start: string; end: string } {
    const parts = range.split(/\s*[–\-]\s*/);
    return { start: parseTime24(parts[0] ?? ""), end: parseTime24(parts[1] ?? "") };
}

// ── Venue types ───────────────────────────────────────────────────────────────

interface VenueDoc {
    _id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
}

function fmtVenueAddress(v: VenueDoc) {
    return [v.address, v.city, v.state].filter(Boolean).join(", ");
}

// ── Edit form state ───────────────────────────────────────────────────────────

interface EditForm {
    title: string;
    shortTitle: string;
    dateISO: string;
    startTime: string;
    endTime: string;
    venueName: string;
    venueAddress: string;
}

function eventToForm(ev: EventMeta): EditForm {
    const { start, end } = parseTimeRange(ev.time ?? "");
    return {
        title: ev.title,
        shortTitle: ev.shortTitle,
        dateISO: parseDateISO(ev.date),
        startTime: start || "12:00",
        endTime: end || "16:00",
        venueName: ev.venueName,
        venueAddress: ev.venueAddress,
    };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

interface Stats { total: number; guestlist: number; waitlist: number; pending: number; paid: number }

function computeStats(regs: { attendeeStatus: string; paymentStatus: string }[]): Stats {
    const active = regs.filter(r => r.attendeeStatus !== "removed");
    return {
        total: active.length,
        guestlist: active.filter(r => r.attendeeStatus === "approved").length,
        waitlist: active.filter(r => r.attendeeStatus === "waitlisted").length,
        pending: active.filter(r => r.attendeeStatus === "registered").length,
        paid: active.filter(r => r.paymentStatus === "paid").length,
    };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EventOverviewPage() {
    const { slug } = useParams<{ slug: string }>();
    const [event, setEvent] = useState<EventMeta | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState<EditForm | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [venues, setVenues] = useState<VenueDoc[]>([]);

    useEffect(() => {
        if (!slug) return;
        Promise.all([
            fetch(`/api/admin/events/${slug}`).then(r => r.ok ? r.json() : null),
            fetch(`/api/admin/registrations?event=${slug}`).then(r => r.ok ? r.json() : []),
        ]).then(([ev, regs]) => {
            if (ev) setEvent(ev);
            if (Array.isArray(regs)) setStats(computeStats(regs));
        }).finally(() => setLoading(false));

        fetch("/api/admin/bld/venues")
            .then(r => r.ok ? r.json() : [])
            .then(setVenues)
            .catch(() => {});
    }, [slug]);

    function startEdit() {
        if (event) { setEditForm(eventToForm(event)); setEditing(true); setSaveError(null); }
    }

    function setF<K extends keyof EditForm>(field: K, value: EditForm[K]) {
        setEditForm(prev => prev ? { ...prev, [field]: value } : prev);
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!editForm) return;
        setSaving(true); setSaveError(null);
        const timeParts = [editForm.startTime, editForm.endTime].filter(Boolean).map(fmt12);
        const patch = {
            title: editForm.title.trim(),
            shortTitle: editForm.shortTitle.trim() || editForm.title.trim(),
            date: formatDateLong(editForm.dateISO),
            dateShort: formatDateShort(editForm.dateISO),
            time: timeParts.join(" – "),
            venueName: editForm.venueName.trim(),
            venueAddress: editForm.venueAddress.trim(),
        };
        try {
            const res = await fetch(`/api/admin/events/${slug}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!res.ok) { setSaveError((await res.json()).error ?? "Save failed"); return; }
            setEvent(prev => prev ? { ...prev, ...patch } : prev);
            setEditing(false);
        } catch { setSaveError("Network error"); }
        finally { setSaving(false); }
    }

    const previewDate = editForm?.dateISO ? formatDateLong(editForm.dateISO) : null;
    const previewTime = editForm ? [editForm.startTime, editForm.endTime].filter(Boolean).map(fmt12).join(" – ") : null;

    const cards = [
        { href: `/registrations/${slug}/attendees`, icon: "🎟️", label: "Attendees", description: "Review registrations, manage guestlist and waitlist, send emails.", stat: stats ? `${stats.total} registered` : null },
        { href: `/registrations/${slug}/tally`, icon: "📊", label: "Request Tally", description: "See dance request counts, link requests to the catalog, export the guaranteed list.", stat: null },
    ];

    return (
        <div className="page-pad">
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 28 }}>
                <div>
                    {loading ? (
                        <div style={{ height: 28, width: 200, borderRadius: 6, background: "var(--border)" }} />
                    ) : (
                        <>
                            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                                {event?.shortTitle ?? slug}
                            </h1>
                            {event && <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>{event.title}</p>}
                        </>
                    )}
                </div>
                {event && !editing && (
                    <button onClick={startEdit} style={{
                        fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "transparent",
                        color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0,
                    }}>✎ Edit Details</button>
                )}
            </div>

            {/* Edit form */}
            {editing && editForm && (
                <form onSubmit={handleSave} style={{
                    background: "var(--surface)", border: "1px solid var(--accent)",
                    borderRadius: 12, padding: "20px 24px", marginBottom: 28,
                }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>Edit Event Details</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>

                        <FLabel label="Title" span>
                            <input value={editForm.title} onChange={e => setF("title", e.target.value)} required style={inputStyle} />
                        </FLabel>

                        <FLabel label="Short Title" hint="Used in nav and email subjects">
                            <input value={editForm.shortTitle} onChange={e => setF("shortTitle", e.target.value)} placeholder={editForm.title} style={inputStyle} />
                        </FLabel>

                        <FLabel label="Date">
                            <input type="date" value={editForm.dateISO} onChange={e => setF("dateISO", e.target.value)} required style={inputStyle} />
                            {previewDate && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{previewDate}</p>}
                        </FLabel>

                        <FLabel label="Time">
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input type="time" value={editForm.startTime} onChange={e => setF("startTime", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                                <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>–</span>
                                <input type="time" value={editForm.endTime} onChange={e => setF("endTime", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                            </div>
                            {previewTime && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{previewTime}</p>}
                        </FLabel>

                        <FLabel label="Venue" hint="Type to search or edit freely" span>
                            <VenueTypeahead
                                venues={venues}
                                venueName={editForm.venueName}
                                venueAddress={editForm.venueAddress}
                                onChangeName={v => setF("venueName", v)}
                                onChangeAddress={v => setF("venueAddress", v)}
                                onSelect={v => { setF("venueName", v.name); setF("venueAddress", fmtVenueAddress(v)); }}
                            />
                        </FLabel>
                    </div>

                    {saveError && <p style={{ fontSize: 12, color: "var(--danger-text)", marginTop: 12 }}>{saveError}</p>}

                    <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                        <button type="submit" disabled={saving} style={{
                            fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 8,
                            border: "none", background: "var(--accent)", color: "#fff",
                            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                        }}>{saving ? "Saving…" : "Save Changes"}</button>
                        <button type="button" onClick={() => setEditing(false)} style={{
                            fontSize: 13, padding: "8px 16px", borderRadius: 8,
                            border: "1px solid var(--border)", background: "transparent",
                            color: "var(--text-secondary)", cursor: "pointer",
                        }}>Cancel</button>
                    </div>
                </form>
            )}

            {/* Event details (read view) */}
            {event && !editing && (
                <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                    padding: "20px 24px", marginBottom: 32,
                    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16,
                }}>
                    <Detail label="Date" value={event.date} />
                    <Detail label="Time" value={event.time} />
                    <Detail label="Venue" value={event.venueName} sub={event.venueAddress} />
                </div>
            )}

            {/* Stats */}
            {stats && !editing && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12, marginBottom: 32 }}>
                    <StatCard label="Total" value={stats.total} />
                    <StatCard label="Guestlist" value={stats.guestlist} color="var(--success-text)" bg="var(--success-subtle)" />
                    <StatCard label="Waitlist" value={stats.waitlist} color="var(--warning-text)" bg="var(--warning-subtle)" />
                    <StatCard label="Pending" value={stats.pending} />
                    <StatCard label="Paid" value={stats.paid} color="var(--accent-text)" bg="var(--accent-subtle)" />
                </div>
            )}

            {/* Section cards */}
            {!editing && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                    {cards.map(card => (
                        <Link key={card.href} href={card.href} style={{ textDecoration: "none" }}>
                            <div style={{
                                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                                padding: "20px 24px", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
                            }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px var(--accent-subtle)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                    <span style={{ fontSize: 22 }}>{card.icon}</span>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{card.label}</span>
                                    {card.stat && (
                                        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "var(--surface-raised)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }}>
                                            {card.stat}
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{card.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Venue typeahead ───────────────────────────────────────────────────────────

function VenueTypeahead({ venues, venueName, venueAddress, onChangeName, onChangeAddress, onSelect }: {
    venues: VenueDoc[]; venueName: string; venueAddress: string;
    onChangeName: (v: string) => void; onChangeAddress: (v: string) => void;
    onSelect: (v: VenueDoc) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const filtered = venueName.trim()
        ? venues.filter(v => v.name.toLowerCase().includes(venueName.toLowerCase()))
        : venues;

    useEffect(() => {
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
            <div ref={ref} style={{ position: "relative" }}>
                <input value={venueName} onChange={e => { onChangeName(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)} placeholder="Midnight Toad"
                    style={inputStyle} autoComplete="off" />
                {open && filtered.length > 0 && (
                    <div style={{
                        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 8, zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                        maxHeight: 220, overflowY: "auto",
                    }}>
                        {filtered.map((v, i) => (
                            <button key={v._id} type="button"
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
                                {fmtVenueAddress(v) && <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{fmtVenueAddress(v)}</p>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <input value={venueAddress} onChange={e => onChangeAddress(e.target.value)}
                placeholder="5302 S Federal Cir #A, Littleton, CO 80123" style={inputStyle} />
        </div>
    );
}

// ── Shared ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 6,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
};

function FLabel({ label, hint, span, children }: {
    label: string; hint?: string; span?: boolean; children: React.ReactNode;
}) {
    return (
        <div style={span ? { gridColumn: "1 / -1" } : {}}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>
                {label}{hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, opacity: 0.75 }}>— {hint}</span>}
            </p>
            {children}
        </div>
    );
}

function Detail({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{value}</p>
            {sub && <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0", whiteSpace: "pre-line" }}>{sub}</p>}
        </div>
    );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color?: string; bg?: string }) {
    return (
        <div style={{ background: bg ?? "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 20px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: color ?? "var(--text-primary)", margin: 0, lineHeight: 1 }}>{value}</p>
        </div>
    );
}
