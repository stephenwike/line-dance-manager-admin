"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { buildEmailTemplates, type EventMeta, type EmailTemplate } from "@/lib/eventTemplates";

// ── Types ─────────────────────────────────────────────────────────────────────

type AttendeeStatus = "registered" | "approved" | "waitlisted" | "removed";
type AttendeeTab = "registered" | "guestlist" | "waitlist" | "removed";
type MainTab = "attendees" | "tally";

interface EmailRecord { templateId: string; subject: string; sentAt: string }

interface Registration {
    _id: string; name: string; email: string; phone: string | null; address: string | null;
    agreedToWaiver: boolean; waiverSignedAt: string | null; waiverSignature: string | null;
    paymentStatus: "pending" | "paid"; paymentMethod: "stripe" | "venmo" | null;
    stripeSessionId: string | null; paidAt: string | null; createdAt: string | null;
    attendeeStatus: AttendeeStatus;
    catering: boolean;
    requests: { text: string; danceId: string | null }[];
    emails: EmailRecord[];
}

interface TallyEntry {
    key: string; danceId: string | null; displayName: string; count: number;
    requestors: string[]; songName: string | null; songArtist: string | null; durationMs: number | null;
}

interface TallyData {
    eventSlug: string; totalRegistrations: number; registrantsWithRequests: number;
    totalRequests: number; dances: TallyEntry[];
}

interface VenueDoc { _id: string; name: string; address: string | null; city: string | null; state: string | null }

interface EditForm {
    title: string; shortTitle: string; dateISO: string;
    startTime: string; endTime: string; venueName: string; venueAddress: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateLong(iso: string) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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

function parseDateISO(longDate: string): string {
    try {
        const d = new Date(longDate);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
    } catch { /* empty */ }
    return "";
}

function parseTime24(t: string): string {
    const match = t.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return "";
    let h = parseInt(match[1]);
    const min = match[2], period = match[3].toUpperCase();
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
}

function parseTimeRange(range: string): { start: string; end: string } {
    const parts = range.split(/\s*[–\-]\s*/);
    return { start: parseTime24(parts[0] ?? ""), end: parseTime24(parts[1] ?? "") };
}

function fmtVenueAddress(v: VenueDoc) {
    return [v.address, v.city, v.state].filter(Boolean).join(", ");
}

function eventToForm(ev: EventMeta): EditForm {
    const { start, end } = parseTimeRange(ev.time ?? "");
    return {
        title: ev.title, shortTitle: ev.shortTitle,
        dateISO: parseDateISO(ev.date),
        startTime: start || "12:00", endTime: end || "16:00",
        venueName: ev.venueName, venueAddress: ev.venueAddress,
    };
}

function gmailUrl(to: string, subject: string, body: string) {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EventOverviewPage() {
    const { slug } = useParams<{ slug: string }>();

    // Event metadata + edit
    const [event, setEvent] = useState<EventMeta | null>(null);
    const [eventLoading, setEventLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState<EditForm | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [venues, setVenues] = useState<VenueDoc[]>([]);

    // Registrations
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [regsLoading, setRegsLoading] = useState(true);
    const [pending, setPending] = useState<Record<string, string>>({});

    // Tabs
    const [mainTab, setMainTab] = useState<MainTab>("attendees");
    const [attendeeTab, setAttendeeTab] = useState<AttendeeTab>("registered");
    const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

    // Tally (lazy)
    const [tallyData, setTallyData] = useState<TallyData | null>(null);
    const [tallyLoading, setTallyLoading] = useState(false);
    const [tallyError, setTallyError] = useState<string | null>(null);
    const [tallyLoaded, setTallyLoaded] = useState(false);
    const [removedData, setRemovedData] = useState<TallyData | null>(null);
    const [showRemoved, setShowRemoved] = useState(false);
    const [removedLoading, setRemovedLoading] = useState(false);
    const [unlinkedOnly, setUnlinkedOnly] = useState(false);

    useEffect(() => {
        if (!slug) return;
        fetch(`/api/admin/events/${slug}`)
            .then(r => r.ok ? r.json() : null)
            .then(ev => { if (ev) setEvent(ev); })
            .finally(() => setEventLoading(false));

        fetch(`/api/admin/registrations?event=${slug}`)
            .then(r => { if (r.status === 401) { window.location.href = "/login"; return []; } return r.ok ? r.json() : []; })
            .then(data => setRegistrations(data))
            .finally(() => setRegsLoading(false));

        fetch("/api/admin/bld/venues")
            .then(r => r.ok ? r.json() : [])
            .then(setVenues)
            .catch(() => {});
    }, [slug]);

    async function loadTally() {
        if (tallyLoaded) return;
        setTallyLoading(true); setTallyError(null);
        try {
            const res = await fetch(`/api/admin/registrations/tally?event=${slug}`);
            if (res.status === 401) { window.location.href = "/login"; return; }
            if (!res.ok) throw new Error("Failed to load");
            setTallyData(await res.json());
            setTallyLoaded(true);
        } catch (e) {
            setTallyError(e instanceof Error ? e.message : "Failed to load tally.");
        } finally { setTallyLoading(false); }
    }

    function handleMainTab(tab: MainTab) {
        setMainTab(tab);
        if (tab === "tally") loadTally();
    }

    // Edit form
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
                method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
            });
            if (!res.ok) { setSaveError((await res.json()).error ?? "Save failed"); return; }
            setEvent(prev => prev ? { ...prev, ...patch } : prev);
            setEditing(false);
        } catch { setSaveError("Network error"); }
        finally { setSaving(false); }
    }

    // Registration actions
    function onEmailLogged(id: string, email: EmailRecord) {
        setRegistrations(prev => prev.map(r => r._id === id ? { ...r, emails: [...r.emails, email] } : r));
    }
    async function setStatus(id: string, attendeeStatus: AttendeeStatus) {
        setPending(p => ({ ...p, [id]: attendeeStatus }));
        try {
            const res = await fetch(`/api/admin/registrations/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attendeeStatus }),
            });
            if (res.ok) setRegistrations(prev => prev.map(r => r._id === id ? { ...r, attendeeStatus } : r));
        } finally { setPending(p => { const n = { ...p }; delete n[id]; return n; }); }
    }
    async function markPaid(id: string) {
        setPending(p => ({ ...p, [id]: "paid" }));
        try {
            const res = await fetch(`/api/admin/registrations/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markPaid: true }),
            });
            if (res.ok) setRegistrations(prev => prev.map(r =>
                r._id === id ? { ...r, paymentStatus: "paid", paymentMethod: "venmo", paidAt: new Date().toISOString() } : r
            ));
        } finally { setPending(p => { const n = { ...p }; delete n[id]; return n; }); }
    }
    async function toggleCatering(id: string, current: boolean) {
        setPending(p => ({ ...p, [id]: "catering" }));
        try {
            const res = await fetch(`/api/admin/registrations/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ catering: !current }),
            });
            if (res.ok) setRegistrations(prev => prev.map(r => r._id === id ? { ...r, catering: !current } : r));
        } finally { setPending(p => { const n = { ...p }; delete n[id]; return n; }); }
    }

    // Tally actions
    function handleRenamed(key: string, newName: string) {
        setTallyData(prev => prev ? { ...prev, dances: prev.dances.map(d => d.key === key ? { ...d, displayName: newName } : d) } : prev);
    }
    function handleLinked(key: string, danceId: string, danceName: string) {
        setTallyData(prev => {
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
    function exportCsv() {
        if (!tallyData) return;
        const sorted = [...tallyData.dances].sort((a, b) => a.displayName.localeCompare(b.displayName));
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

    // Derived
    const registered = registrations.filter(r => r.attendeeStatus === "registered");
    const guestlist = registrations.filter(r => r.attendeeStatus === "approved");
    const waitlist = registrations.filter(r => r.attendeeStatus === "waitlisted");
    const removedRegs = registrations.filter(r => r.attendeeStatus === "removed");
    const active = registrations.filter(r => r.attendeeStatus !== "removed");
    const stats = {
        total: active.length,
        guestlist: guestlist.length,
        waitlist: waitlist.length,
        pending: registered.length,
        paid: active.filter(r => r.paymentStatus === "paid").length,
        catering: active.filter(r => r.catering).length,
    };
    const templates = event ? buildEmailTemplates(event) : [];
    const attendeeTabs: { key: AttendeeTab; label: string; count: number }[] = [
        { key: "registered", label: "Pending Review", count: registered.length },
        { key: "guestlist", label: "Guestlist", count: guestlist.length },
        { key: "waitlist", label: "Waitlist", count: waitlist.length },
        { key: "removed", label: "Removed", count: removedRegs.length },
    ];
    const previewDate = editForm?.dateISO ? formatDateLong(editForm.dateISO) : null;
    const previewTime = editForm ? [editForm.startTime, editForm.endTime].filter(Boolean).map(fmt12).join(" – ") : null;
    const visibleDances = tallyData ? (unlinkedOnly ? tallyData.dances.filter(d => !d.danceId) : tallyData.dances) : [];
    const maxCount = visibleDances[0]?.count ?? 1;

    return (
        <div className="page-pad">
            {previewTemplate && <EmailPreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />}

            {/* ── Page header ───────────────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                gap: 16, paddingBottom: 20, marginBottom: 20,
                borderBottom: "1px solid var(--border)",
            }}>
                <div style={{ minWidth: 0 }}>
                    {eventLoading ? (
                        <>
                            <div style={{ height: 30, width: 220, borderRadius: 6, background: "var(--border)", marginBottom: 8 }} />
                            <div style={{ height: 16, width: 320, borderRadius: 4, background: "var(--border)", opacity: 0.6 }} />
                        </>
                    ) : (
                        <>
                            <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.015em", marginBottom: 4, lineHeight: 1.1 }}>
                                {event?.shortTitle ?? slug}
                            </h1>
                            {event && (
                                <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 10 }}>{event.title}</p>
                            )}
                            {event && !editing && (
                                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0 }}>
                                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{event.date}</span>
                                    <span style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 8px", userSelect: "none" }}>·</span>
                                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{event.time}</span>
                                    <span style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 8px", userSelect: "none" }}>·</span>
                                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{event.venueName}</span>
                                    {event.venueAddress && (
                                        <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 6 }}>({event.venueAddress})</span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                {event && !editing && (
                    <button onClick={startEdit} style={{
                        fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 7,
                        border: "1px solid var(--border)", background: "transparent",
                        color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0,
                        letterSpacing: "0.01em",
                    }}>✎ Edit</button>
                )}
            </div>

            {/* ── Edit form ─────────────────────────────────────────── */}
            {editing && editForm && (
                <form onSubmit={handleSave} style={{
                    background: "var(--surface)", border: "1px solid var(--accent)",
                    borderRadius: 12, padding: "20px 24px", marginBottom: 24,
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
                                venues={venues} venueName={editForm.venueName} venueAddress={editForm.venueAddress}
                                onChangeName={v => setF("venueName", v)} onChangeAddress={v => setF("venueAddress", v)}
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

            {/* ── Stats bar ─────────────────────────────────────────── */}
            {!regsLoading && !editing && (
                <div style={{
                    display: "flex", flexWrap: "wrap",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 10, overflow: "hidden", marginBottom: 24,
                }}>
                    {([
                        { label: "Total", value: stats.total, color: "var(--text-primary)" },
                        { label: "Guestlist", value: stats.guestlist, color: "var(--success-text)" },
                        { label: "Waitlist", value: stats.waitlist, color: "var(--warning-text)" },
                        { label: "Pending", value: stats.pending, color: stats.pending > 0 ? "var(--danger-text)" : "var(--text-primary)" },
                        { label: "Paid", value: stats.paid, color: "var(--accent-text)" },
                        ...(stats.catering > 0 ? [{ label: "BBQ", value: stats.catering, color: "var(--warning-text)" }] : []),
                    ] as { label: string; value: number; color: string }[]).map((s, i, arr) => (
                        <div key={s.label} style={{
                            flex: "1 1 80px", padding: "14px 18px", textAlign: "center",
                            borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-tertiary)" }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Main tabs (primary nav) ────────────────────────────── */}
            {!editing && (
                <>
                    <div style={{
                        display: "flex", background: "var(--surface-raised)",
                        borderRadius: 10, padding: 4, marginBottom: 20, gap: 4,
                        border: "1px solid var(--border)",
                    }}>
                        {([
                            { key: "attendees" as MainTab, label: regsLoading ? "Attendees" : `Attendees (${stats.total})` },
                            { key: "tally" as MainTab, label: "Request Tally" },
                        ]).map(t => (
                            <button key={t.key} onClick={() => handleMainTab(t.key)} style={{
                                flex: 1, padding: "9px 20px", borderRadius: 7, border: "none",
                                background: mainTab === t.key ? "var(--surface)" : "transparent",
                                boxShadow: mainTab === t.key ? "0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px var(--border)" : "none",
                                fontSize: 14, fontWeight: mainTab === t.key ? 600 : 400,
                                color: mainTab === t.key ? "var(--text-primary)" : "var(--text-secondary)",
                                cursor: "pointer", transition: "all 0.15s",
                            }}>{t.label}</button>
                        ))}
                    </div>

                    {/* ── Attendees tab ─────────────────────────────────── */}
                    {mainTab === "attendees" && (
                        <>
                            {/* Sub-tabs */}
                            <div style={{
                                display: "flex", gap: 0,
                                borderBottom: "1px solid var(--border)", marginBottom: 16,
                            }}>
                                {attendeeTabs.map(t => {
                                    const active = attendeeTab === t.key;
                                    const urgent = t.key === "registered" && t.count > 0;
                                    return (
                                        <button key={t.key} onClick={() => setAttendeeTab(t.key)} style={{
                                            padding: "7px 16px", border: "none", background: "transparent",
                                            cursor: "pointer", fontSize: 13,
                                            fontWeight: active ? 600 : 400,
                                            color: active ? "var(--text-primary)" : "var(--text-secondary)",
                                            borderBottom: active ? "2px solid var(--text-primary)" : "2px solid transparent",
                                            marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
                                            transition: "color 0.15s",
                                        }}>
                                            {t.label}
                                            {t.count > 0 && (
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                                                    background: urgent && !active ? "var(--danger-subtle)"
                                                        : active ? "rgba(0,0,0,0.08)" : "rgba(148,163,184,0.15)",
                                                    color: urgent && !active ? "var(--danger-text)"
                                                        : active ? "var(--text-primary)" : "var(--text-tertiary)",
                                                }}>{t.count}</span>
                                            )}
                                        </button>
                                    );
                                })}
                                {templates.length > 0 && (
                                    <div style={{
                                        marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
                                        paddingBottom: 2,
                                    }}>
                                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>Preview:</span>
                                        {templates.filter(t => t.id !== "custom").map(t => (
                                            <button key={t.id} onClick={() => setPreviewTemplate(t)} style={{
                                                fontSize: 11, padding: "3px 8px", borderRadius: 5,
                                                border: "1px solid var(--border)", background: "transparent",
                                                color: "var(--text-tertiary)", cursor: "pointer", whiteSpace: "nowrap",
                                            }}>{t.label}</button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {regsLoading && <p style={{ color: "var(--text-secondary)" }}>Loading…</p>}

                            {!regsLoading && attendeeTab === "registered" && (
                                <RegistrationTable rows={registered} pending={pending} onEmailLogged={onEmailLogged} templates={templates} onToggleCatering={toggleCatering}
                                    actions={(r, mobile) => mobile ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                <ActionButton label="Approve" loading={pending[r._id] === "approved"} onClick={() => setStatus(r._id, "approved")}
                                                    style={{ color: "var(--success-text)", border: "1.5px solid rgba(16,185,129,0.35)", background: "var(--success-subtle)", padding: "10px 0" }} />
                                                <ActionButton label="Waitlist" loading={pending[r._id] === "waitlisted"} onClick={() => setStatus(r._id, "waitlisted")}
                                                    style={{ color: "var(--text-secondary)", border: "1px solid var(--border)", background: "transparent", padding: "10px 0" }} />
                                            </div>
                                            {r.paymentStatus !== "paid" && (
                                                <ActionButton label="Mark Paid" loading={pending[r._id] === "paid"} onClick={() => markPaid(r._id)}
                                                    style={{ color: "var(--warning-text)", border: "1.5px solid rgba(245,158,11,0.4)", background: "var(--warning-subtle)", width: "100%", padding: "10px 0" }} />
                                            )}
                                            <ActionButton label="Remove" loading={pending[r._id] === "removed"} onClick={() => setStatus(r._id, "removed")}
                                                style={{ color: "var(--danger-text)", border: "1.5px solid rgba(239,68,68,0.3)", background: "var(--danger-subtle)", width: "100%", padding: "10px 0" }} />
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                            {r.paymentStatus !== "paid" && (
                                                <ActionButton label="Mark Paid" loading={pending[r._id] === "paid"} onClick={() => markPaid(r._id)}
                                                    style={{ color: "var(--warning-text)", border: "1.5px solid rgba(245,158,11,0.4)", background: "var(--warning-subtle)" }} />
                                            )}
                                            <ActionButton label="Approve" loading={pending[r._id] === "approved"} onClick={() => setStatus(r._id, "approved")}
                                                style={{ color: "var(--success-text)", border: "1.5px solid rgba(16,185,129,0.35)", background: "var(--success-subtle)" }} />
                                            <ActionButton label="Waitlist" loading={pending[r._id] === "waitlisted"} onClick={() => setStatus(r._id, "waitlisted")}
                                                style={{ color: "var(--text-secondary)", border: "1px solid var(--border)", background: "transparent" }} />
                                            <ActionButton label="Remove" loading={pending[r._id] === "removed"} onClick={() => setStatus(r._id, "removed")}
                                                style={{ color: "var(--danger-text)", border: "1.5px solid rgba(239,68,68,0.3)", background: "var(--danger-subtle)" }} />
                                        </div>
                                    )}
                                />
                            )}

                            {!regsLoading && attendeeTab === "guestlist" && (
                                <RegistrationTable rows={guestlist} pending={pending} onEmailLogged={onEmailLogged} templates={templates} onToggleCatering={toggleCatering}
                                    actions={(r, mobile) => (
                                        <ActionButton label="Remove" loading={pending[r._id] === "removed"} onClick={() => setStatus(r._id, "removed")}
                                            style={{ color: "var(--danger-text)", border: "1.5px solid rgba(239,68,68,0.3)", background: "var(--danger-subtle)", ...(mobile ? { width: "100%", padding: "10px 0" } : {}) }} />
                                    )}
                                    emptyMessage="No one on the guestlist yet. Approve registrations to add them."
                                />
                            )}

                            {!regsLoading && attendeeTab === "waitlist" && (
                                <RegistrationTable rows={waitlist} pending={pending} onEmailLogged={onEmailLogged} templates={templates} onToggleCatering={toggleCatering}
                                    actions={(r, mobile) => (
                                        <ActionButton label="Approve" loading={pending[r._id] === "approved"} onClick={() => setStatus(r._id, "approved")}
                                            style={{ color: "var(--success-text)", border: "1.5px solid rgba(16,185,129,0.35)", background: "var(--success-subtle)", ...(mobile ? { width: "100%", padding: "10px 0" } : {}) }} />
                                    )}
                                    emptyMessage="No one on the waitlist."
                                />
                            )}

                            {!regsLoading && attendeeTab === "removed" && (
                                <RegistrationTable rows={removedRegs} pending={pending} onEmailLogged={onEmailLogged} templates={templates} onToggleCatering={toggleCatering}
                                    actions={(r, mobile) => (
                                        <ActionButton label="Restore" loading={pending[r._id] === "registered"} onClick={() => setStatus(r._id, "registered")}
                                            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)", background: "transparent", ...(mobile ? { width: "100%", padding: "10px 0" } : {}) }} />
                                    )}
                                    emptyMessage="No removed attendees."
                                />
                            )}
                        </>
                    )}

                    {/* ── Tally tab ─────────────────────────────────────── */}
                    {mainTab === "tally" && (
                        <>
                            {tallyLoading && <p style={{ color: "var(--text-secondary)" }}>Loading…</p>}
                            {tallyError && <p style={{ color: "var(--danger-text)" }}>{tallyError}</p>}

                            {tallyData && (
                                <>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                                        <TallyStatCard label="Total Registrations" value={tallyData.totalRegistrations} />
                                        <TallyStatCard label="Submitted Requests" value={tallyData.registrantsWithRequests} />
                                        <TallyStatCard label="Total Requests" value={tallyData.totalRequests} />
                                        <TallyStatCard label="Unique Dances" value={tallyData.dances.length} />
                                        <button onClick={() => setUnlinkedOnly(v => !v)} style={{
                                            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
                                            border: `1px solid ${unlinkedOnly ? "var(--accent)" : "var(--border)"}`,
                                            background: unlinkedOnly ? "var(--accent-subtle)" : "transparent",
                                            color: unlinkedOnly ? "var(--accent-text)" : "var(--text-secondary)",
                                            cursor: "pointer", whiteSpace: "nowrap", alignSelf: "center",
                                        }}>{unlinkedOnly ? "✓ Unlinked only" : "Show unlinked only"}</button>
                                        <button onClick={toggleRemoved} style={{
                                            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
                                            border: `1px solid ${showRemoved ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                                            background: showRemoved ? "var(--danger-subtle)" : "transparent",
                                            color: showRemoved ? "var(--danger-text)" : "var(--text-secondary)",
                                            cursor: "pointer", whiteSpace: "nowrap", alignSelf: "center",
                                        }}>{showRemoved ? "✓ Removed requests" : "Show removed requests"}</button>
                                        <button onClick={exportCsv} style={{
                                            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
                                            border: "1px solid var(--border)", background: "var(--surface)",
                                            color: "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap", alignSelf: "center",
                                        }}>↓ Export guaranteed list</button>
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
                                                                    <EditableEntryName entry={entry} eventSlug={slug} onRenamed={handleRenamed} onLinked={handleLinked} />
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
                        </>
                    )}
                </>
            )}
        </div>
    );
}

// ── EditableEntryName ─────────────────────────────────────────────────────────

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
        setValue(entry.displayName); setSearchResults([]); setSaveError(null); setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    }
    function cancel() { setEditing(false); setSearchResults([]); setSaveError(null); }
    function handleEnter() { if (searchResults.length > 0) linkToDance(searchResults[0]); else saveRename(); }

    async function saveRename() {
        const trimmed = value.trim();
        if (!trimmed || trimmed === entry.displayName) { cancel(); return; }
        setSaving(true); setSaveError(null);
        try {
            const res = await fetch("/api/admin/registrations/tally", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
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
                method: "PATCH", headers: { "Content-Type": "application/json" },
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
                            >{d.danceName}</button>
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

// ── EmailPreviewModal ─────────────────────────────────────────────────────────

function EmailPreviewModal({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
    const body = template.body("Laurie");
    return (
        <div onClick={onClose} style={{
            position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
            <div onClick={(e) => e.stopPropagation()} style={{
                background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)",
                width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column",
                overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 4 }}>
                            Preview · {template.label}
                        </p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{template.subject}</p>
                    </div>
                    <button onClick={onClose} style={{
                        padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
                        background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
                    }}>Close</button>
                </div>
                <div style={{ padding: "20px", overflowY: "auto" }}>
                    <pre style={{ margin: 0, fontFamily: "inherit", fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{body}</pre>
                </div>
                <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-tertiary)" }}>
                    Sample name: "Laurie" — click outside to dismiss
                </div>
            </div>
        </div>
    );
}

// ── RegistrationTable ─────────────────────────────────────────────────────────

function RegistrationTable({
    rows, pending, actions, emptyMessage = "No registrations yet.", onEmailLogged, templates, onToggleCatering,
}: {
    rows: Registration[];
    pending: Record<string, string>;
    actions: (r: Registration, isMobile: boolean) => React.ReactNode;
    emptyMessage?: string;
    onEmailLogged: (id: string, email: EmailRecord) => void;
    templates: EmailTemplate[];
    onToggleCatering: (id: string, current: boolean) => void;
}) {
    const isMobile = useIsMobile();
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    if (rows.length === 0) {
        return <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>{emptyMessage}</p>;
    }

    if (isMobile) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((r) => {
                    const open = expandedRow === r._id;
                    return (
                        <div key={r._id} style={{
                            background: "var(--surface)", border: "1px solid var(--border)",
                            borderRadius: 10, overflow: "hidden",
                            opacity: pending[r._id] ? 0.6 : 1, transition: "opacity 0.15s",
                        }}>
                            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                    <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
                                    <div style={{ flexShrink: 0 }}><PaymentCell reg={r} /></div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    {r.agreedToWaiver
                                        ? <Badge text="✓ Waiver" color="#15803d" bg="rgba(34,197,94,0.12)" />
                                        : <Badge text="✗ Waiver" color="var(--danger-text)" bg="var(--danger-subtle)" />
                                    }
                                    {r.catering && <Badge text="🍖 BBQ" color="var(--warning-text)" bg="var(--warning-subtle)" />}
                                    {r.requests.length > 0 && <Badge text={`${r.requests.length} req`} color="var(--text-secondary)" bg="var(--surface-raised)" />}
                                    {r.emails.length > 0 && <Badge text={`✉ ${r.emails.length}`} color="var(--accent-text)" bg="var(--accent-subtle)" />}
                                    <button onClick={() => setExpandedRow(open ? null : r._id)} style={{
                                        marginLeft: "auto", fontSize: 11, padding: "3px 8px",
                                        borderRadius: 4, border: "1px solid var(--border)",
                                        background: "transparent", color: "var(--text-tertiary)", cursor: "pointer",
                                    }}>{open ? "▲ Less" : "▼ More"}</button>
                                </div>
                            </div>
                            {open && (
                                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-raised)" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                        <a href={`mailto:${r.email}`} style={{ fontSize: 13, color: "var(--accent-text)", textDecoration: "none" }}>{r.email}</a>
                                        {r.phone && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.phone}</span>}
                                        {r.address && <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{r.address}</span>}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        {r.agreedToWaiver ? (
                                            <>
                                                <Badge text="Waiver signed" color="#15803d" bg="rgba(34,197,94,0.12)" />
                                                {r.waiverSignature && <span style={{ fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic" }}>"{r.waiverSignature}"</span>}
                                            </>
                                        ) : (
                                            <Badge text="Waiver not signed" color="var(--danger-text)" bg="var(--danger-subtle)" />
                                        )}
                                    </div>
                                    {r.requests.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {r.requests.map((req, i) => (
                                                <span key={i} style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px" }}>
                                                    {req.text}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {r.createdAt && (
                                        <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                            Registered {new Date(r.createdAt).toLocaleDateString()} at {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    )}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                            {r.catering ? "🍖 BBQ catering add-on" : "No BBQ add-on"}
                                        </span>
                                        <button onClick={() => onToggleCatering(r._id, r.catering)} disabled={!!pending[r._id]} style={{
                                            fontSize: 11, padding: "3px 10px", borderRadius: 6,
                                            border: r.catering ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(245,158,11,0.4)",
                                            background: r.catering ? "var(--danger-subtle)" : "var(--warning-subtle)",
                                            color: r.catering ? "var(--danger-text)" : "var(--warning-text)",
                                            cursor: pending[r._id] ? "not-allowed" : "pointer", opacity: pending[r._id] ? 0.6 : 1,
                                        }}>{r.catering ? "Remove BBQ" : "Add BBQ"}</button>
                                    </div>
                                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Emails</p>
                                        <EmailPanel reg={r} isMobile templates={templates} onLogged={(email) => onEmailLogged(r._id, email)} />
                                    </div>
                                </div>
                            )}
                            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", background: open ? "var(--surface)" : undefined }}>
                                {actions(r, true)}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                        <th style={{ width: 36 }} />
                        {["Name", "Status", ""].map((h, i) => (
                            <th key={i} style={{
                                textAlign: i === 2 ? "right" : "left",
                                padding: "10px 14px", fontSize: 11, fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)",
                            }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const open = expandedRow === r._id;
                        return (
                            <React.Fragment key={r._id}>
                                <tr onClick={() => setExpandedRow(open ? null : r._id)} style={{
                                    borderBottom: "1px solid var(--border)",
                                    opacity: pending[r._id] ? 0.6 : 1, transition: "opacity 0.15s",
                                    cursor: "pointer", background: open ? "var(--surface-raised)" : undefined,
                                }}>
                                    <td style={{ padding: "12px 8px 12px 14px", color: "var(--text-tertiary)", fontSize: 11, userSelect: "none" }}>
                                        {open ? "▼" : "▶"}
                                    </td>
                                    <td style={{ padding: "12px 14px" }}>
                                        <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</p>
                                        {r.address && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{r.address}</p>}
                                    </td>
                                    <td style={{ padding: "12px 14px" }}>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                            <PaymentCell reg={r} />
                                            {r.agreedToWaiver
                                                ? <Badge text="✓ Waiver" color="#15803d" bg="rgba(34,197,94,0.12)" />
                                                : <Badge text="✗ Waiver" color="var(--danger-text)" bg="var(--danger-subtle)" />
                                            }
                                            {r.catering && <Badge text="🍖 BBQ" color="var(--warning-text)" bg="var(--warning-subtle)" />}
                                            {r.requests.length > 0 && <Badge text={`${r.requests.length} req`} color="var(--text-secondary)" bg="var(--surface-raised)" />}
                                            {r.emails.length > 0 && <Badge text={`✉ ${r.emails.length}`} color="var(--accent-text)" bg="var(--accent-subtle)" />}
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
                                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                            {actions(r, false)}
                                        </div>
                                    </td>
                                </tr>
                                {open && (
                                    <tr style={{ background: "var(--surface-raised)" }}>
                                        <td colSpan={4} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <a href={`mailto:${r.email}`} style={{ fontSize: 13, color: "var(--accent-text)", textDecoration: "none" }}>{r.email}</a>
                                                    {r.phone && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.phone}</span>}
                                                    {r.createdAt && (
                                                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                                                            Registered {new Date(r.createdAt).toLocaleDateString()} at {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                        {r.agreedToWaiver ? (
                                                            <>
                                                                <Badge text="Waiver signed" color="#15803d" bg="rgba(34,197,94,0.12)" />
                                                                {r.waiverSignature && <span style={{ fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic" }}>"{r.waiverSignature}"</span>}
                                                            </>
                                                        ) : (
                                                            <Badge text="Waiver not signed" color="var(--danger-text)" bg="var(--danger-subtle)" />
                                                        )}
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                            {r.catering ? "🍖 BBQ catering add-on" : "No BBQ add-on"}
                                                        </span>
                                                        <button onClick={() => onToggleCatering(r._id, r.catering)} disabled={!!pending[r._id]} style={{
                                                            fontSize: 11, padding: "2px 8px", borderRadius: 5,
                                                            border: r.catering ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(245,158,11,0.4)",
                                                            background: r.catering ? "var(--danger-subtle)" : "var(--warning-subtle)",
                                                            color: r.catering ? "var(--danger-text)" : "var(--warning-text)",
                                                            cursor: pending[r._id] ? "not-allowed" : "pointer", opacity: pending[r._id] ? 0.6 : 1,
                                                        }}>{r.catering ? "Remove BBQ" : "Add BBQ"}</button>
                                                    </div>
                                                    {r.requests.length > 0 && (
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                            {r.requests.map((req, i) => (
                                                                <span key={i} style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px" }}>
                                                                    {req.text}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Emails</p>
                                                <EmailPanel reg={r} isMobile={false} templates={templates} onLogged={(email) => onEmailLogged(r._id, email)} />
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ── EmailPanel ────────────────────────────────────────────────────────────────

function EmailPanel({ reg, isMobile, templates, onLogged }: {
    reg: Registration; isMobile: boolean; templates: EmailTemplate[]; onLogged: (email: EmailRecord) => void;
}) {
    const [sending, setSending] = useState<string | null>(null);
    const firstName = reg.name.trim().split(" ")[0] || reg.name;

    async function handleSend(template: EmailTemplate) {
        window.open(gmailUrl(reg.email, template.subject, template.body(firstName)), "_blank");
        setSending(template.id);
        const record: EmailRecord = { templateId: template.id, subject: template.subject, sentAt: new Date().toISOString() };
        try {
            const res = await fetch(`/api/admin/registrations/${reg._id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ addEmail: record }),
            });
            if (res.ok) onLogged(record);
        } finally { setSending(null); }
    }

    const templateLabel = (id: string) => templates.find(t => t.id === id)?.label ?? id;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reg.emails.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 2 }}>
                    {reg.emails.map((e, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--success-text)" }}>✓</span>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{templateLabel(e.templateId)}</span>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                                {new Date(e.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {reg.emails.length === 0 && <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>No emails sent yet</p>}
            <div style={isMobile
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }
                : { display: "flex", gap: 6, flexWrap: "wrap" }
            }>
                {templates.map((t) => (
                    <button key={t.id} onClick={() => handleSend(t)} disabled={sending !== null} style={{
                        fontSize: 12, fontWeight: 500,
                        padding: isMobile ? "9px 0" : "4px 10px",
                        borderRadius: 6, border: "1px solid var(--border)",
                        background: "var(--surface)", color: "var(--text-secondary)",
                        cursor: sending !== null ? "not-allowed" : "pointer",
                        opacity: sending !== null ? 0.6 : 1, whiteSpace: "nowrap",
                    }}>
                        {sending === t.id ? "Opening…" : `✉ ${t.label}`}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── VenueTypeahead ────────────────────────────────────────────────────────────

function VenueTypeahead({ venues, venueName, venueAddress, onChangeName, onChangeAddress, onSelect }: {
    venues: VenueDoc[]; venueName: string; venueAddress: string;
    onChangeName: (v: string) => void; onChangeAddress: (v: string) => void;
    onSelect: (v: VenueDoc) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const filtered = venueName.trim() ? venues.filter(v => v.name.toLowerCase().includes(venueName.toLowerCase())) : venues;

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
                    onFocus={() => setOpen(true)} placeholder="Midnight Toad" style={inputStyle} autoComplete="off" />
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

// ── Small components ──────────────────────────────────────────────────────────

function ActionButton({ label, loading, onClick, style }: {
    label: string; loading: boolean; onClick: () => void; style: React.CSSProperties;
}) {
    return (
        <button onClick={onClick} disabled={loading} style={{
            fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
            whiteSpace: "nowrap", ...style,
        }}>{loading ? "…" : label}</button>
    );
}

function TallyStatCard({ label, value }: { label: string; value: number }) {
    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 20px", minWidth: 110 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1 }}>{value}</p>
        </div>
    );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
    return (
        <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: bg, color }}>{text}</span>
    );
}

function PaymentCell({ reg }: { reg: Registration }) {
    if (reg.paymentStatus === "paid") {
        return (
            <div>
                <Badge text="Paid" color="var(--success-text)" bg="var(--success-subtle)" />
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                    {reg.paymentMethod === "stripe" ? "Card" : "Venmo"}
                    {reg.paidAt && ` · ${new Date(reg.paidAt).toLocaleDateString()}`}
                </div>
            </div>
        );
    }
    if (reg.paymentMethod === "venmo") return <Badge text="Venmo Pending" color="var(--warning-text)" bg="var(--warning-subtle)" />;
    return <Badge text="Pending" color="var(--text-secondary)" bg="rgba(148,163,184,0.12)" />;
}

const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 6,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
};

function FLabel({ label, hint, span, children }: { label: string; hint?: string; span?: boolean; children: React.ReactNode }) {
    return (
        <div style={span ? { gridColumn: "1 / -1" } : {}}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>
                {label}{hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, opacity: 0.75 }}>— {hint}</span>}
            </p>
            {children}
        </div>
    );
}

