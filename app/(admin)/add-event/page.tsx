"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui";
import { parseTime12ToMinutes, minutesToTime12 } from "@/lib/time";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Venue { _id: string; name: string; city?: string | null; state?: string | null }
interface EventType {
    _id: string; title: string; level?: string | null; price?: string | null;
    venueId?: string | null; isActive?: boolean;
    defaultStartTime?: string | null; defaultDurationMinutes?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function venueLabel(v: Venue | null | undefined) {
    if (!v) return "Unknown venue";
    const loc = [v.city, v.state].filter(Boolean).join(", ");
    return loc ? `${v.name} (${loc})` : v.name;
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AddEventPage() {
    const router = useRouter();

    const [venues, setVenues] = useState<Venue[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [loading, setLoading] = useState(true);

    const [eventTypeId, setEventTypeId] = useState("");
    const [date, setDate] = useState(todayLocal);
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [touchedTimes, setTouchedTimes] = useState(false);
    const [endDayOffset, setEndDayOffset] = useState<0 | 1>(0);

    // Inline new event type form
    const [showNewType, setShowNewType] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newVenueId, setNewVenueId] = useState("");
    const [newLevel, setNewLevel] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [creatingType, setCreatingType] = useState(false);

    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const venuesById = useMemo(() => new Map(venues.map((v) => [v._id, v])), [venues]);
    const selectedType = useMemo(() => eventTypes.find((et) => et._id === eventTypeId) ?? null, [eventTypes, eventTypeId]);
    const selectedVenue = useMemo(() => selectedType?.venueId ? venuesById.get(selectedType.venueId) ?? null : null, [selectedType, venuesById]);

    async function loadLookups(selectId?: string) {
        setLoading(true);
        try {
            const [vRes, etRes] = await Promise.all([
                fetch("/api/admin/bld/venues").then((r) => r.json()),
                fetch("/api/admin/bld/event-types").then((r) => r.json()),
            ]);
            const vArr: Venue[] = Array.isArray(vRes) ? vRes : [];
            const etArr: EventType[] = Array.isArray(etRes) ? etRes : [];
            setVenues(vArr);
            setEventTypes(etArr);
            if (!newVenueId && vArr.length) setNewVenueId(vArr[0]._id);
            if (selectId) setEventTypeId(selectId);
            else if (!eventTypeId && etArr.length) setEventTypeId(etArr[0]._id);
        } catch {
            setErr("Failed to load event types and venues");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadLookups(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-fill times from event type defaults
    useEffect(() => {
        if (!selectedType || touchedTimes) return;
        const defStart = selectedType.defaultStartTime?.trim() ?? "";
        const defDur = Number(selectedType.defaultDurationMinutes ?? 0);
        if (defStart && parseTime12ToMinutes(defStart) !== null) {
            setStartTime(defStart);
            if (defDur > 0) {
                const startM = parseTime12ToMinutes(defStart)!;
                setEndTime(minutesToTime12(startM + defDur));
            }
        }
    }, [selectedType?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    async function createEventType() {
        if (!newTitle.trim()) { setErr("Title is required"); return; }
        if (!newVenueId) { setErr("Venue is required"); return; }
        setCreatingType(true);
        setErr(null);
        try {
            const res = await fetch("/api/admin/bld/event-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    venueId: newVenueId,
                    level: newLevel.trim() || null,
                    price: newPrice.trim() || null,
                    isActive: false,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            setShowNewType(false);
            setNewTitle(""); setNewLevel(""); setNewPrice("");
            setTouchedTimes(false);
            await loadLookups(String(data.eventTypeId ?? data._id ?? ""));
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setCreatingType(false);
        }
    }

    async function createEvent() {
        setErr(null);
        if (!eventTypeId) { setErr("Select an event type"); return; }
        if (!date) { setErr("Date is required"); return; }
        if (parseTime12ToMinutes(startTime) === null) { setErr("Invalid start time (e.g. 6:30 PM)"); return; }
        if (parseTime12ToMinutes(endTime) === null) { setErr("Invalid end time (e.g. 8:00 PM)"); return; }
        if (endDayOffset === 0 && (parseTime12ToMinutes(endTime) ?? 0) <= (parseTime12ToMinutes(startTime) ?? 0)) {
            setErr("End time must be after start time"); return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/admin/bld/one-off-event", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventTypeId, date, startTime, endTime, endDayOffset }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            router.push(`/events/${data.eventId}`);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ padding: "32px 36px", maxWidth: 680 }}>
            <div style={{ marginBottom: 24 }}>
                <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", padding: 0, textDecoration: "underline", marginBottom: 10, display: "block" }}>← Back</button>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Add special event</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Create a one-off event occurrence. You'll be taken to the event page to plan lessons.
                </p>
            </div>

            {err && <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 16 }}>{err}</p>}

            {loading ? (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Event Type */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Event type</p>
                            <button type="button" onClick={() => setShowNewType((v) => !v)}
                                style={{ fontSize: 12, color: "var(--accent-text)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                {showNewType ? "Cancel" : "+ New event type"}
                            </button>
                        </div>

                        <Field label="Event type">
                            <select
                                value={eventTypeId}
                                onChange={(e) => { setEventTypeId(e.target.value); setTouchedTimes(false); }}
                                style={{ ...inputStyle, cursor: "pointer" }}
                            >
                                {eventTypes.map((et) => (
                                    <option key={et._id} value={et._id}>
                                        {et.title}{et.venueId ? ` — ${venueLabel(venuesById.get(et.venueId))}` : ""}
                                        {et.isActive === false ? " (special)" : ""}
                                    </option>
                                ))}
                            </select>
                            {selectedType && (
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                    {venueLabel(selectedVenue)} · {selectedType.level || "No level"} · {selectedType.price || "No price"}
                                </span>
                            )}
                        </Field>

                        {showNewType && (
                            <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>New event type</p>
                                <Field label="Title">
                                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Holiday Special" style={inputStyle} />
                                </Field>
                                <Field label="Venue">
                                    <select value={newVenueId} onChange={(e) => setNewVenueId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                        {venues.map((v) => <option key={v._id} value={v._id}>{venueLabel(v)}</option>)}
                                    </select>
                                </Field>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <Field label="Level (optional)">
                                        <input value={newLevel} onChange={(e) => setNewLevel(e.target.value)} placeholder="e.g. All levels" style={inputStyle} />
                                    </Field>
                                    <Field label="Price (optional)">
                                        <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="e.g. $10" style={inputStyle} />
                                    </Field>
                                </div>
                                <div>
                                    <ActionButton label={creatingType ? "Creating…" : "Create event type"} loading={creatingType} onClick={createEventType} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Occurrence */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>When</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <Field label="Date">
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
                            </Field>
                            <Field label="Start time">
                                <input value={startTime} onChange={(e) => { setTouchedTimes(true); setStartTime(e.target.value); }} placeholder="6:30 PM" style={inputStyle} />
                            </Field>
                            <Field label="End time">
                                <input value={endTime} onChange={(e) => { setTouchedTimes(true); setEndTime(e.target.value); }} placeholder="9:00 PM" style={inputStyle} />
                            </Field>
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                            <input type="checkbox" checked={endDayOffset === 1} onChange={(e) => { setTouchedTimes(true); setEndDayOffset(e.target.checked ? 1 : 0); }} />
                            Ends after midnight
                        </label>
                    </div>

                    {/* Submit */}
                    <div style={{ display: "flex", gap: 8 }}>
                        <ActionButton label={saving ? "Creating…" : "Create & plan lessons"} loading={saving} onClick={createEvent} />
                        <ActionButton label="Back" variant="ghost" onClick={() => router.back()} />
                    </div>
                </div>
            )}
        </div>
    );
}
