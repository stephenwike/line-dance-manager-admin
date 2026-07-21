"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell, ActionButton, Badge } from "@/components/ui";
import { computeDurationMinutes, endTimeFromStartAndDuration } from "@/lib/time";

type DOW = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

interface EventType {
    _id: string;
    title: string;
    defaultStartTime: string;
    defaultDurationMinutes: number;
    isActive: boolean;
}

interface Frequency {
    _id: string;
    eventTypeId: string;
    kind: "WEEKLY" | "MONTHLY_NTH_WEEKDAY" | "ONE_TIME";
    byDay?: DOW[];
    weekday?: DOW;
    nth?: number;
    startTime: string;
    durationMinutes: number;
    startDate?: string;
    endDate?: string | null;
    isActive: boolean;
}

const DAYS: DOW[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DOW_LABEL: Record<string, string> = { SU: "Sun", MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat" };

function nthLabel(n: number) {
    return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function summary(f: Frequency) {
    const endTime = endTimeFromStartAndDuration(f.startTime, f.durationMinutes);
    const time = `${f.startTime} – ${endTime}`;
    const window = f.startDate || f.endDate ? ` (${f.startDate ?? "any"} → ${f.endDate ?? "open"})` : "";
    if (f.kind === "ONE_TIME") return `One-time: ${f.startDate ?? "(no date)"} · ${time}`;
    if (f.kind === "WEEKLY") {
        const days = (f.byDay ?? []).map((d) => DOW_LABEL[d]).join(", ");
        return `Weekly: ${days || "(no days)"} · ${time}${window}`;
    }
    return `Monthly: ${nthLabel(f.nth ?? 1)} ${DOW_LABEL[f.weekday ?? "FR"]} · ${time}${window}`;
}

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
};

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

function DayPicker({ selected, onChange }: { selected: DOW[]; onChange: (days: DOW[]) => void }) {
    function toggle(d: DOW) {
        const s = new Set(selected);
        if (s.has(d)) s.delete(d); else s.add(d);
        onChange(DAYS.filter((x) => s.has(x)));
    }
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DAYS.map((d) => {
                const on = selected.includes(d);
                return (
                    <label key={d} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-subtle)" : "var(--surface-raised)", cursor: "pointer", fontSize: 12, fontWeight: on ? 600 : 400, color: on ? "var(--accent-text)" : "var(--text-secondary)", userSelect: "none" }}>
                        <input type="checkbox" style={{ display: "none" }} checked={on} onChange={() => toggle(d)} />
                        {DOW_LABEL[d]}
                    </label>
                );
            })}
        </div>
    );
}

interface FreqFormState {
    kind: Frequency["kind"];
    byDay: DOW[];
    nth: number;
    weekday: DOW;
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
}

function FreqFormFields({ f, set, err }: { f: FreqFormState; set: (p: Partial<FreqFormState>) => void; err: string | null }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {f.kind === "WEEKLY" && (
                <Field label="Days of week">
                    <DayPicker selected={f.byDay} onChange={(byDay) => set({ byDay })} />
                </Field>
            )}
            {f.kind === "MONTHLY_NTH_WEEKDAY" && (
                <div className="grid-2" style={{ gap: 8 }}>
                    <Field label="Which">
                        <select value={f.nth} onChange={(e) => set({ nth: Number(e.target.value) })} style={inputStyle}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{nthLabel(n)}</option>)}
                        </select>
                    </Field>
                    <Field label="Weekday">
                        <select value={f.weekday} onChange={(e) => set({ weekday: e.target.value as DOW })} style={inputStyle}>
                            {DAYS.map((d) => <option key={d} value={d}>{DOW_LABEL[d]}</option>)}
                        </select>
                    </Field>
                </div>
            )}
            {f.kind === "ONE_TIME" && (
                <Field label="Date">
                    <input value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} placeholder="YYYY-MM-DD" style={{ ...inputStyle, maxWidth: 200 }} />
                </Field>
            )}

            <div className="grid-2" style={{ gap: 8 }}>
                <Field label="Start time">
                    <input value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} placeholder="5:00 PM" style={inputStyle} />
                </Field>
                <Field label="End time">
                    <input value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} placeholder="8:00 PM" style={inputStyle} />
                </Field>
            </div>

            {f.kind !== "ONE_TIME" && (
                <div className="grid-2" style={{ gap: 8 }}>
                    <Field label="Active from (optional)">
                        <input value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} placeholder="YYYY-MM-DD" style={inputStyle} />
                    </Field>
                    <Field label="Active until (optional)">
                        <input value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} placeholder="YYYY-MM-DD" style={inputStyle} />
                    </Field>
                </div>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-primary)" }}>
                <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
                Active
            </label>

            {err && <p style={{ fontSize: 12, color: "var(--danger)" }}>{err}</p>}
        </div>
    );
}

function buildPayload(f: FreqFormState) {
    const durationMinutes = computeDurationMinutes(f.startTime, f.endTime);
    if (durationMinutes === null) throw new Error("End time must be after start time");
    if (f.kind === "WEEKLY" && f.byDay.length === 0) throw new Error("Pick at least one day");
    if (f.kind === "ONE_TIME" && !f.startDate.trim()) throw new Error("Date is required for a one-time frequency");

    const payload: Record<string, unknown> = {
        kind: f.kind, startTime: f.startTime.trim(), durationMinutes, isActive: f.isActive,
    };
    if (f.kind === "WEEKLY") payload.byDay = f.byDay;
    if (f.kind === "MONTHLY_NTH_WEEKDAY") { payload.nth = f.nth; payload.weekday = f.weekday; }
    if (f.startDate.trim()) payload.startDate = f.startDate.trim();
    if (f.kind !== "ONE_TIME" && f.endDate.trim()) payload.endDate = f.endDate.trim();
    return payload;
}

function FrequenciesInner() {
    const searchParams = useSearchParams();
    const scopedId = searchParams.get("eventTypeId");

    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [freqs, setFreqs] = useState<Frequency[]>([]);
    const [loading, setLoading] = useState(true);

    const [showAdd, setShowAdd] = useState(false);
    const [addEventTypeId, setAddEventTypeId] = useState("");
    const [addKind, setAddKind] = useState<Frequency["kind"]>("WEEKLY");
    const [addForm, setAddForm] = useState<FreqFormState>({
        kind: "WEEKLY", byDay: ["MO"], nth: 1, weekday: "FR",
        startTime: "5:00 PM", endTime: "8:00 PM", startDate: "", endDate: "", isActive: true,
    });
    const [addSaving, setAddSaving] = useState(false);
    const [addErr, setAddErr] = useState<string | null>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<FreqFormState | null>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [editErr, setEditErr] = useState<string | null>(null);

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const [ets, fs] = await Promise.all([
                fetch("/api/admin/bld/event-types").then((r) => r.json()),
                fetch("/api/admin/bld/frequencies").then((r) => r.json()),
            ]);
            const etList: EventType[] = Array.isArray(ets) ? ets : [];
            setEventTypes(etList);
            setFreqs(Array.isArray(fs) ? fs : []);

            const preferred = scopedId && etList.some((x) => x._id === scopedId)
                ? scopedId : etList[0]?._id ?? "";
            if (preferred && !addEventTypeId) {
                setAddEventTypeId(preferred);
                const et = etList.find((x) => x._id === preferred);
                if (et) setAddForm((p) => ({
                    ...p,
                    startTime: et.defaultStartTime || p.startTime,
                    endTime: endTimeFromStartAndDuration(et.defaultStartTime || p.startTime, et.defaultDurationMinutes || 180),
                }));
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [scopedId]); // eslint-disable-line react-hooks/exhaustive-deps

    const etById = useMemo(() => new Map(eventTypes.map((et) => [et._id, et])), [eventTypes]);

    const visible = useMemo(() => {
        const base = scopedId ? freqs.filter((f) => f.eventTypeId === scopedId) : freqs;
        return base.slice().sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return String(a.eventTypeId).localeCompare(String(b.eventTypeId)) || a.startTime.localeCompare(b.startTime);
        });
    }, [freqs, scopedId]);

    function setAdd(p: Partial<FreqFormState>) { setAddForm((prev) => ({ ...prev, ...p })); }
    function setEdit(p: Partial<FreqFormState>) { setEditForm((prev) => prev ? { ...prev, ...p } : prev); }

    function applyEventTypeDefaults(etId: string) {
        setAddEventTypeId(etId);
        const et = etById.get(etId);
        if (et) setAddForm((p) => ({
            ...p,
            startTime: et.defaultStartTime || p.startTime,
            endTime: endTimeFromStartAndDuration(et.defaultStartTime || p.startTime, et.defaultDurationMinutes || 180),
        }));
    }

    async function handleAdd() {
        setAddErr(null);
        try {
            const payload = buildPayload({ ...addForm, kind: addKind });
            setAddSaving(true);
            const res = await fetch("/api/admin/bld/frequencies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, eventTypeId: addEventTypeId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setShowAdd(false);
            setAddForm((p) => ({ ...p, byDay: ["MO"], startDate: "", endDate: "" }));
            load();
        } catch (e: unknown) {
            setAddErr(e instanceof Error ? e.message : String(e));
        } finally {
            setAddSaving(false);
        }
    }

    function startEdit(f: Frequency) {
        setEditingId(f._id);
        setEditErr(null);
        setConfirmDeleteId(null);
        setEditForm({
            kind: f.kind, byDay: f.byDay ?? [], nth: f.nth ?? 1, weekday: f.weekday ?? "FR",
            startTime: f.startTime,
            endTime: endTimeFromStartAndDuration(f.startTime, f.durationMinutes),
            startDate: f.startDate ?? "", endDate: f.endDate ?? "", isActive: f.isActive,
        });
    }

    async function handleSaveEdit(f: Frequency) {
        if (!editForm) return;
        setEditErr(null);
        try {
            const payload = buildPayload(editForm);
            setEditSaving(true);
            const res = await fetch(`/api/admin/bld/frequencies/${f._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setEditingId(null);
            setEditForm(null);
            load();
        } catch (e: unknown) {
            setEditErr(e instanceof Error ? e.message : String(e));
        } finally {
            setEditSaving(false);
        }
    }

    async function toggleActive(f: Frequency) {
        await fetch(`/api/admin/bld/frequencies/${f._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !f.isActive }),
        });
        load();
    }

    async function handleDelete(id: string) {
        setDeleting(true);
        try {
            await fetch(`/api/admin/bld/frequencies/${id}`, { method: "DELETE" });
            setConfirmDeleteId(null);
            if (editingId === id) { setEditingId(null); setEditForm(null); }
            load();
        } finally {
            setDeleting(false);
        }
    }

    return (
        <PageShell title="Frequencies" count={visible.length} loading={loading}>
            {/* Scope indicator */}
            {scopedId && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Showing: <strong>{etById.get(scopedId)?.title ?? scopedId}</strong>
                    </span>
                    <a href="/frequencies" style={{ fontSize: 12, color: "var(--accent)" }}>Show all</a>
                </div>
            )}

            {/* Toolbar */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <ActionButton label="+ Add frequency" onClick={() => { setShowAdd(true); setAddErr(null); }} />
            </div>

            {/* Add form */}
            {showAdd && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Add frequency</p>

                    {eventTypes.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            Create an event type first. <a href="/event-types" style={{ color: "var(--accent)" }}>Go to Event Types →</a>
                        </p>
                    ) : (
                        <>
                            <div className="grid-2" style={{ gap: 8 }}>
                                <Field label="Event type">
                                    <select value={addEventTypeId} onChange={(e) => applyEventTypeDefaults(e.target.value)} style={inputStyle}>
                                        {eventTypes.map((et) => (
                                            <option key={et._id} value={et._id}>{et.title}{!et.isActive ? " (inactive)" : ""}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Kind">
                                    <select value={addKind} onChange={(e) => { const k = e.target.value as Frequency["kind"]; setAddKind(k); setAdd({ kind: k }); }} style={inputStyle}>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY_NTH_WEEKDAY">Monthly (Nth weekday)</option>
                                        <option value="ONE_TIME">One-time</option>
                                    </select>
                                </Field>
                            </div>
                            <FreqFormFields f={{ ...addForm, kind: addKind }} set={setAdd} err={addErr} />
                            <div style={{ display: "flex", gap: 8 }}>
                                <ActionButton label={addSaving ? "Saving…" : "Create"} onClick={handleAdd} loading={addSaving} />
                                <ActionButton label="Cancel" variant="ghost" onClick={() => setShowAdd(false)} />
                            </div>
                        </>
                    )}
                </div>
            )}

            {!loading && visible.length === 0 && !showAdd && (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "24px 0" }}>No frequencies yet.</p>
            )}

            {/* Frequency cards */}
            {visible.map((f) => {
                const et = etById.get(f.eventTypeId);
                const isEditing = editingId === f._id;
                const isConfirmDelete = confirmDeleteId === f._id;

                return (
                    <div key={f._id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                        {/* Header */}
                        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                                        {et?.title ?? f.eventTypeId}
                                    </span>
                                    {!f.isActive && <Badge label="inactive" color="orange" />}
                                </div>
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", flexShrink: 0 }}>
                                    {f.kind === "WEEKLY" ? "weekly" : f.kind === "MONTHLY_NTH_WEEKDAY" ? "monthly" : "one-time"}
                                </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{summary(f)}</p>
                        </div>

                        {/* Actions */}
                        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", background: "var(--surface-raised)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <button
                                type="button"
                                onClick={() => isEditing ? (setEditingId(null), setEditForm(null), setEditErr(null)) : startEdit(f)}
                                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer" }}
                            >
                                {isEditing ? "Cancel edit" : "Edit"}
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleActive(f)}
                                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer" }}
                            >
                                {f.isActive ? "Make inactive" : "Make active"}
                            </button>

                            {isConfirmDelete ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, color: "var(--danger)" }}>Delete this frequency?</span>
                                    <ActionButton label={deleting ? "Deleting…" : "Yes, delete"} variant="danger" onClick={() => handleDelete(f._id)} loading={deleting} />
                                    <ActionButton label="Cancel" variant="ghost" onClick={() => setConfirmDeleteId(null)} />
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { setConfirmDeleteId(f._id); setEditingId(null); setEditForm(null); }}
                                    style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent", cursor: "pointer" }}
                                >
                                    Delete
                                </button>
                            )}
                        </div>

                        {/* Inline edit form */}
                        {isEditing && editForm && (
                            <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                    Edit — {f.kind === "WEEKLY" ? "weekly" : f.kind === "MONTHLY_NTH_WEEKDAY" ? "monthly" : "one-time"} (kind is locked)
                                </p>
                                <FreqFormFields f={editForm} set={setEdit} err={editErr} />
                                <div style={{ display: "flex", gap: 8 }}>
                                    <ActionButton label={editSaving ? "Saving…" : "Save changes"} onClick={() => handleSaveEdit(f)} loading={editSaving} />
                                    <ActionButton label="Cancel" variant="ghost" onClick={() => { setEditingId(null); setEditForm(null); setEditErr(null); }} />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </PageShell>
    );
}

export default function FrequenciesPage() {
    return (
        <Suspense>
            <FrequenciesInner />
        </Suspense>
    );
}
