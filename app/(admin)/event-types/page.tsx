"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, Badge, ActionButton } from "@/components/ui";

interface Venue { _id: string; name: string }

interface EventType {
    _id: string;
    title: string;
    level: string;
    price: string;
    venueId: string | null;
    isActive: boolean;
    defaultStartTime: string;
    defaultDurationMinutes: number;
    isOneOff: boolean;
}

interface Frequency {
    _id: string;
    eventTypeId: string;
    kind: "WEEKLY" | "MONTHLY_NTH_WEEKDAY" | "ONE_TIME";
    byDay?: string[];
    weekday?: string;
    nth?: number;
    startTime: string;
    durationMinutes: number;
    startDate?: string;
    endDate?: string | null;
    isActive: boolean;
}

const DOW: Record<string, string> = { SU: "Sun", MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat" };

function nthLabel(n: number) {
    return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function freqSummary(f: Frequency) {
    const time = `${f.startTime} · ${f.durationMinutes}m`;
    const window = f.startDate || f.endDate ? ` (${f.startDate ?? "any"} → ${f.endDate ?? "open"})` : "";
    if (f.kind === "WEEKLY") {
        const days = (f.byDay ?? []).map((d) => DOW[d] ?? d).join(", ");
        return `Weekly: ${days || "(no days)"} · ${time}${window}`;
    }
    if (f.kind === "MONTHLY_NTH_WEEKDAY") {
        return `Monthly: ${nthLabel(f.nth ?? 1)} ${DOW[f.weekday ?? ""] ?? f.weekday} · ${time}${window}`;
    }
    return `One-time · ${time}${window}`;
}

function fmtDuration(mins: number) {
    if (!mins) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
};
const selectStyle: React.CSSProperties = { ...inputStyle };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {label}
            </span>
            {children}
        </label>
    );
}

interface FormState {
    title: string; level: string; price: string; venueId: string;
    defaultStartTime: string; defaultDurationMinutes: number; isActive: boolean;
}

function EventTypeForm({
    initial, venues, saving, err, onSave, onCancel,
}: {
    initial: FormState;
    venues: Venue[];
    saving: boolean;
    err: string | null;
    onSave: (f: FormState) => void;
    onCancel: () => void;
}) {
    const [f, setF] = useState<FormState>(initial);
    const set = (patch: Partial<FormState>) => setF((prev) => ({ ...prev, ...patch }));

    const canSave = !!f.title.trim() && !!f.venueId;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="Title *">
                    <input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Charlie's Country Night" style={inputStyle} />
                </Field>
                <Field label="Venue *">
                    <select value={f.venueId} onChange={(e) => set({ venueId: e.target.value })} style={selectStyle}>
                        <option value="">— select venue —</option>
                        {venues.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
                    </select>
                </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="Level">
                    <input value={f.level} onChange={(e) => set({ level: e.target.value })} placeholder="All Levels" style={inputStyle} />
                </Field>
                <Field label="Price">
                    <input value={f.price} onChange={(e) => set({ price: e.target.value })} placeholder="FREE" style={inputStyle} />
                </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <Field label="Default start time">
                    <input value={f.defaultStartTime} onChange={(e) => set({ defaultStartTime: e.target.value })} placeholder="5:00 PM" style={inputStyle} />
                </Field>
                <Field label="Duration (minutes)">
                    <input type="number" min={1} value={f.defaultDurationMinutes || ""} onChange={(e) => set({ defaultDurationMinutes: Number(e.target.value) })} placeholder="180" style={inputStyle} />
                </Field>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-primary)", paddingBottom: 2, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
                    Active
                </label>
            </div>

            {err && <p style={{ fontSize: 12, color: "var(--danger)" }}>{err}</p>}

            <div style={{ display: "flex", gap: 8 }}>
                <ActionButton label={saving ? "Saving…" : "Save"} onClick={() => onSave(f)} loading={saving || !canSave} />
                <ActionButton label="Cancel" variant="ghost" onClick={onCancel} />
            </div>
        </div>
    );
}

export default function EventTypesPage() {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [frequencies, setFrequencies] = useState<Frequency[]>([]);
    const [loading, setLoading] = useState(true);
    const [hideInactive, setHideInactive] = useState(true);

    const [showAdd, setShowAdd] = useState(false);
    const [addSaving, setAddSaving] = useState(false);
    const [addErr, setAddErr] = useState<string | null>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [editErr, setEditErr] = useState<string | null>(null);

    const [expandedId, setExpandedId] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        try {
            const [v, et, fr] = await Promise.all([
                fetch("/api/admin/bld/venues").then((r) => r.json()),
                fetch("/api/admin/bld/event-types").then((r) => r.json()),
                fetch("/api/admin/bld/frequencies").then((r) => r.json()),
            ]);
            setVenues(Array.isArray(v) ? v : []);
            setEventTypes(Array.isArray(et) ? et : []);
            setFrequencies(Array.isArray(fr) ? fr : []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    const venueById = useMemo(() => new Map(venues.map((v) => [v._id, v])), [venues]);

    const freqsByEventType = useMemo(() => {
        const map = new Map<string, Frequency[]>();
        for (const f of frequencies) {
            const key = String(f.eventTypeId);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(f);
        }
        return map;
    }, [frequencies]);

    const visible = useMemo(
        () => hideInactive ? eventTypes.filter((et) => et.isActive) : eventTypes,
        [eventTypes, hideInactive]
    );

    const defaultVenueId = venues.length > 0 ? venues[0]._id : "";
    const blankForm: FormState = { title: "", level: "All Levels", price: "FREE", venueId: defaultVenueId, defaultStartTime: "5:00 PM", defaultDurationMinutes: 180, isActive: true };

    async function handleAdd(f: FormState) {
        setAddErr(null);
        setAddSaving(true);
        try {
            const res = await fetch("/api/admin/bld/event-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(f),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setShowAdd(false);
            load();
        } catch (e: unknown) {
            setAddErr(e instanceof Error ? e.message : String(e));
        } finally {
            setAddSaving(false);
        }
    }

    async function handleEdit(id: string, f: FormState) {
        setEditErr(null);
        setEditSaving(true);
        try {
            const res = await fetch(`/api/admin/bld/event-types/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(f),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setEditingId(null);
            load();
        } catch (e: unknown) {
            setEditErr(e instanceof Error ? e.message : String(e));
        } finally {
            setEditSaving(false);
        }
    }

    return (
        <PageShell title="Event Types" count={visible.length} loading={loading}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} />
                    Hide inactive
                </label>
                <ActionButton label="+ Add event type" onClick={() => { setShowAdd(true); setAddErr(null); }} />
            </div>

            {/* Add form */}
            {showAdd && venues.length === 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        You need at least one venue first. <a href="/venues" style={{ color: "var(--accent)" }}>Add a venue →</a>
                    </p>
                </div>
            )}
            {showAdd && venues.length > 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Add event type</p>
                    <EventTypeForm
                        initial={{ ...blankForm, venueId: defaultVenueId }}
                        venues={venues}
                        saving={addSaving}
                        err={addErr}
                        onSave={handleAdd}
                        onCancel={() => setShowAdd(false)}
                    />
                </div>
            )}

            {!loading && visible.length === 0 && !showAdd && (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "24px 0" }}>
                    {hideInactive ? 'No active event types. Uncheck "Hide inactive" to see all.' : "No event types yet."}
                </p>
            )}

            {/* Event type cards */}
            {visible.map((et) => {
                const venue = et.venueId ? venueById.get(et.venueId) : null;
                const freqs = freqsByEventType.get(et._id) ?? [];
                const activeFreqs = freqs.filter((f) => f.isActive);
                const inactiveFreqs = freqs.filter((f) => !f.isActive);
                const isExpanded = expandedId === et._id;
                const isEditing = editingId === et._id;

                const subtitle = [et.level, et.price, venue?.name].filter(Boolean).join(" · ");
                const timeMeta = [et.defaultStartTime, fmtDuration(et.defaultDurationMinutes)].filter(Boolean).join(" · ");

                return (
                    <div key={et._id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                            <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : et._id)}
                                style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-tertiary)", fontSize: 11, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                {isExpanded ? "▲" : "▼"}
                            </button>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{et.title}</span>
                                    {!et.isActive && <Badge label="inactive" color="orange" />}
                                    {et.isOneOff && <Badge label="one-off" color="blue" />}
                                </div>
                                {subtitle && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{subtitle}</p>}
                                {timeMeta && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{timeMeta}</p>}
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (isEditing) { setEditingId(null); setEditErr(null); }
                                    else { setEditingId(et._id); setExpandedId(et._id); setEditErr(null); }
                                }}
                                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0 }}
                            >
                                {isEditing ? "Cancel" : "Edit"}
                            </button>
                        </div>

                        {/* Expanded body */}
                        {isExpanded && (
                            <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px 14px", background: "var(--surface-raised)", display: "flex", flexDirection: "column", gap: 12 }}>
                                {isEditing ? (
                                    <EventTypeForm
                                        initial={{ title: et.title, level: et.level, price: et.price, venueId: et.venueId ?? "", defaultStartTime: et.defaultStartTime, defaultDurationMinutes: et.defaultDurationMinutes, isActive: et.isActive }}
                                        venues={venues}
                                        saving={editSaving}
                                        err={editErr}
                                        onSave={(f) => handleEdit(et._id, f)}
                                        onCancel={() => { setEditingId(null); setEditErr(null); }}
                                    />
                                ) : (
                                    <>
                                        {/* Frequencies */}
                                        <div>
                                            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                                                Frequencies
                                            </p>
                                            {freqs.length === 0 ? (
                                                <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No frequencies yet — add them in the Frequencies page.</p>
                                            ) : (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                                    {activeFreqs.map((f) => (
                                                        <p key={f._id} style={{ fontSize: 12, color: "var(--text-primary)" }}>· {freqSummary(f)}</p>
                                                    ))}
                                                    {inactiveFreqs.map((f) => (
                                                        <p key={f._id} style={{ fontSize: 12, color: "var(--text-tertiary)" }}>· {freqSummary(f)} (inactive)</p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{et._id}</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </PageShell>
    );
}
