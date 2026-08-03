"use client";

import { useEffect, useState } from "react";
import { ActionButton, PageShell } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface EventType { _id: string; title: string; isActive: boolean }

interface TemplateLesson {
    time: string | null;
    dance: string | null;
    level: string | null;
    link: string | null;
}

interface EventTemplate {
    _id: string;
    eventTypeId: string;
    name: string;
    isDefault: boolean;
    lessons: TemplateLesson[];
}

interface LessonRow { id: string; time: string; dance: string; level: string; link: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

function blankRow(): LessonRow {
    return { id: uid(), time: "", dance: "", level: "", link: "" };
}

function lessonSummary(lessons: TemplateLesson[]): string {
    if (lessons.length === 0) return "No lessons";
    return lessons.map((l) => {
        const parts = [l.time ?? "—", l.dance ?? "(variable)", l.level ?? "(variable)"].filter(Boolean);
        return parts.join(" · ");
    }).join("  |  ");
}

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "6px 9px", fontSize: 13, borderRadius: 7,
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

// ── Lesson editor shared by create + edit ────────────────────────────────────

function LessonEditor({ rows, onChange }: {
    rows: LessonRow[];
    onChange: (rows: LessonRow[]) => void;
}) {
    function update(id: string, patch: Partial<LessonRow>) {
        onChange(rows.map((r) => r.id === id ? { ...r, ...patch } : r));
    }
    function add() { onChange([...rows, blankRow()]); }
    function remove(id: string) { onChange(rows.filter((r) => r.id !== id)); }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No lesson slots yet. Add one below.</p>
            )}
            {rows.map((r, idx) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 1fr auto", gap: 6, alignItems: "end" }}>
                    <Field label={idx === 0 ? "Time" : ""}>
                        <input value={r.time} onChange={(e) => update(r.id, { time: e.target.value })}
                            placeholder="5:30 PM" style={inputStyle} />
                    </Field>
                    <Field label={idx === 0 ? "Dance" : ""}>
                        <input value={r.dance} onChange={(e) => update(r.id, { dance: e.target.value })}
                            placeholder="blank = variable" style={inputStyle} />
                    </Field>
                    <Field label={idx === 0 ? "Level" : ""}>
                        <input value={r.level} onChange={(e) => update(r.id, { level: e.target.value })}
                            placeholder="blank = variable" style={inputStyle} />
                    </Field>
                    <Field label={idx === 0 ? "Link" : ""}>
                        <input value={r.link} onChange={(e) => update(r.id, { link: e.target.value })}
                            placeholder="blank = variable" style={inputStyle} />
                    </Field>
                    <button
                        type="button"
                        onClick={() => remove(r.id)}
                        style={{ fontSize: 16, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", alignSelf: "end", marginBottom: 1 }}
                    >
                        ×
                    </button>
                </div>
            ))}
            <div>
                <button type="button" onClick={add}
                    style={{ fontSize: 20, color: "var(--accent-text)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>
                    +
                </button>
            </div>
        </div>
    );
}

// ── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({ tmpl, onSaved, onDeleted }: {
    tmpl: EventTemplate;
    onSaved: (updated: EventTemplate) => void;
    onDeleted: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(tmpl.name);
    const [isDefault, setIsDefault] = useState(tmpl.isDefault);
    const [rows, setRows] = useState<LessonRow[]>(() =>
        tmpl.lessons.map((l) => ({ id: uid(), time: l.time ?? "", dance: l.dance ?? "", level: l.level ?? "", link: l.link ?? "" }))
    );

    useEffect(() => { setIsDefault(tmpl.isDefault); }, [tmpl.isDefault]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function save() {
        if (!name.trim()) { setErr("Name is required"); return; }
        setSaving(true);
        setErr(null);
        try {
            const res = await fetch(`/api/admin/bld/event-templates/${tmpl._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    isDefault,
                    lessons: rows.map((r) => ({
                        time: r.time.trim() || null,
                        dance: r.dance.trim() || null,
                        level: r.level.trim() || null,
                        link: r.link.trim() || null,
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            onSaved({
                ...tmpl, name: name.trim(), isDefault,
                lessons: rows.map((r) => ({
                    time: r.time.trim() || null,
                    dance: r.dance.trim() || null,
                    level: r.level.trim() || null,
                    link: r.link.trim() || null,
                })),
            });
            setEditing(false);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    async function del() {
        if (!confirm(`Delete template "${tmpl.name}"?`)) return;
        try {
            const res = await fetch(`/api/admin/bld/event-templates/${tmpl._id}`, { method: "DELETE" });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Delete failed"); }
            onDeleted();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    return (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {/* Header row */}
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, background: "var(--surface)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{tmpl.name}</p>
                        {tmpl.isDefault && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-text)", background: "var(--accent-subtle)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Default
                            </span>
                        )}
                    </div>
                    {!editing && (
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {lessonSummary(tmpl.lessons)}
                        </p>
                    )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => { setEditing((e) => !e); setErr(null); }}
                        style={{ fontSize: 12, color: "var(--accent-text)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                        {editing ? "Cancel" : "Edit"}
                    </button>
                    <button type="button" onClick={del}
                        style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                        Delete
                    </button>
                </div>
            </div>

            {/* Edit panel */}
            {editing && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--surface-raised)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <Field label="Template name">
                        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                    </Field>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--text-primary)" }}>
                        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                        Default template for this event type
                    </label>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                            Lesson Slots — leave fields blank for variable values
                        </p>
                        <LessonEditor rows={rows} onChange={setRows} />
                    </div>
                    {err && <p style={{ fontSize: 12, color: "var(--danger)" }}>{err}</p>}
                    <ActionButton label={saving ? "Saving…" : "Save"} loading={saving} onClick={save} />
                </div>
            )}
        </div>
    );
}

// ── CreateForm ────────────────────────────────────────────────────────────────

function CreateForm({ eventTypes, onCreated }: {
    eventTypes: EventType[];
    onCreated: (tmpl: EventTemplate) => void;
}) {
    const [open, setOpen] = useState(false);
    const [eventTypeId, setEventTypeId] = useState("");
    const [name, setName] = useState("");
    const [isDefault, setIsDefault] = useState(false);
    const [rows, setRows] = useState<LessonRow[]>([blankRow()]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    function reset() {
        setEventTypeId(""); setName(""); setIsDefault(false); setRows([blankRow()]); setErr(null);
    }

    async function create() {
        if (!eventTypeId) { setErr("Select an event type"); return; }
        if (!name.trim()) { setErr("Name is required"); return; }
        setSaving(true);
        setErr(null);
        try {
            const res = await fetch("/api/admin/bld/event-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventTypeId,
                    name: name.trim(),
                    isDefault,
                    lessons: rows.map((r) => ({
                        time: r.time.trim() || null,
                        dance: r.dance.trim() || null,
                        level: r.level.trim() || null,
                        link: r.link.trim() || null,
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Create failed");
            onCreated({ _id: data._id, eventTypeId, name: name.trim(), isDefault, lessons: rows.map((r) => ({ time: r.time.trim() || null, dance: r.dance.trim() || null, level: r.level.trim() || null, link: r.link.trim() || null })) });
            reset();
            setOpen(false);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    if (!open) {
        return (
            <ActionButton label="+ New Template" onClick={() => setOpen(true)} />
        );
    }

    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>New Template</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="Event type">
                    <select value={eventTypeId} onChange={(e) => setEventTypeId(e.target.value)} style={inputStyle}>
                        <option value="">— select —</option>
                        {eventTypes.map((et) => (
                            <option key={et._id} value={et._id}>{et.title}{!et.isActive ? " (inactive)" : ""}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Template name">
                    <input value={name} onChange={(e) => setName(e.target.value)}
                        placeholder='e.g. "Standard 2-lesson" or "Partner dance night"'
                        style={inputStyle} />
                </Field>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--text-primary)" }}>
                    <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                    Default template for this event type
                </label>
                <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                        Lesson Slots — leave fields blank for variable values
                    </p>
                    <LessonEditor rows={rows} onChange={setRows} />
                </div>
                {err && <p style={{ fontSize: 12, color: "var(--danger)" }}>{err}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                    <ActionButton label={saving ? "Saving…" : "Create"} loading={saving} onClick={create} />
                    <ActionButton label="Cancel" variant="ghost" onClick={() => { reset(); setOpen(false); }} />
                </div>
            </div>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EventTemplatesPage() {
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [templates, setTemplates] = useState<EventTemplate[]>([]);
    const [filterEtId, setFilterEtId] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/admin/bld/event-types").then((r) => r.json()).catch(() => []),
            fetch("/api/admin/bld/event-templates").then((r) => r.json()).catch(() => []),
        ]).then(([ets, tmpls]) => {
            setEventTypes(Array.isArray(ets) ? ets : []);
            setTemplates(Array.isArray(tmpls) ? tmpls : []);
        }).finally(() => setLoading(false));
    }, []);

    const filtered = filterEtId
        ? templates.filter((t) => t.eventTypeId === filterEtId)
        : templates;

    // Group by event type for display
    const etMap = new Map(eventTypes.map((et) => [et._id, et]));
    const grouped: Array<{ et: EventType | undefined; etId: string; tmpls: EventTemplate[] }> = [];
    const seen = new Set<string>();
    for (const t of filtered) {
        if (!seen.has(t.eventTypeId)) {
            seen.add(t.eventTypeId);
            grouped.push({
                et: etMap.get(t.eventTypeId),
                etId: t.eventTypeId,
                tmpls: filtered.filter((x) => x.eventTypeId === t.eventTypeId),
            });
        }
    }

    function handleCreated(tmpl: EventTemplate) {
        setTemplates((prev) => {
            const cleared = tmpl.isDefault
                ? prev.map((t) => t.eventTypeId === tmpl.eventTypeId ? { ...t, isDefault: false } : t)
                : prev;
            return [...cleared, tmpl];
        });
    }
    function handleSaved(updated: EventTemplate) {
        setTemplates((prev) => prev.map((t) => {
            if (t._id === updated._id) return updated;
            if (updated.isDefault && t.eventTypeId === updated.eventTypeId) return { ...t, isDefault: false };
            return t;
        }));
    }
    function handleDeleted(id: string) {
        setTemplates((prev) => prev.filter((t) => t._id !== id));
    }

    return (
        <PageShell title="Event Templates" count={templates.length} loading={loading}>
            {loading ? (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <CreateForm eventTypes={eventTypes} onCreated={handleCreated} />

                    {eventTypes.length > 1 && templates.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Filter:</span>
                            <select
                                value={filterEtId}
                                onChange={(e) => setFilterEtId(e.target.value)}
                                style={{ ...inputStyle, width: "auto", minWidth: 180 }}
                            >
                                <option value="">All event types</option>
                                {eventTypes.map((et) => (
                                    <option key={et._id} value={et._id}>{et.title}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {filtered.length === 0 && (
                        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                            {templates.length === 0 ? "No templates yet. Create your first one above." : "No templates for this event type."}
                        </p>
                    )}

                    {grouped.map(({ et, etId, tmpls }) => (
                        <div key={etId}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                                {et?.title ?? etId}
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {tmpls.map((tmpl) => (
                                    <TemplateCard
                                        key={tmpl._id}
                                        tmpl={tmpl}
                                        onSaved={handleSaved}
                                        onDeleted={() => handleDeleted(tmpl._id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </PageShell>
    );
}
