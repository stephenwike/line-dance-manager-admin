"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface Entry {
    _id: string;
    email: string;
    note: string | null;
    expiresAt: string | null;
    createdAt: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isActive(entry: Entry) {
    if (!entry.expiresAt) return true;
    return new Date(entry.expiresAt) > new Date();
}

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

// ── Add form ─────────────────────────────────────────────────────────────────

function AddForm({ onAdded }: { onAdded: (entry: Entry) => void }) {
    const [email, setEmail] = useState("");
    const [note, setNote] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit() {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes("@")) { setErr("Valid email required"); return; }
        setErr(null);
        setSaving(true);
        try {
            const res = await fetch("/api/admin/feed/free-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmed,
                    note: note.trim() || null,
                    expiresAt: expiresAt || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            onAdded({ _id: data._id, email: trimmed, note: note.trim() || null, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, createdAt: new Date().toISOString() });
            setEmail(""); setNote(""); setExpiresAt("");
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Grant free access</p>
            <div className="grid-3" style={{ gap: 10 }}>
                <Field label="Email">
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" style={inputStyle}
                        onKeyDown={(e) => e.key === "Enter" && submit()} />
                </Field>
                <Field label="Note (optional)">
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Beta tester" style={inputStyle} />
                </Field>
                <Field label="Expires (optional)">
                    <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
                </Field>
            </div>
            {err && <p style={{ fontSize: 12, color: "var(--danger)" }}>{err}</p>}
            <div>
                <ActionButton label={saving ? "Adding…" : "Grant access"} loading={saving} onClick={submit} />
            </div>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FeedFreeAccessPage() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [renewing, setRenewing] = useState<string | null>(null);
    const [renewDate, setRenewDate] = useState("");
    const [renewSaving, setRenewSaving] = useState(false);
    const [filter, setFilter] = useState<"all" | "active" | "expired">("active");

    useEffect(() => {
        fetch("/api/admin/feed/free-access")
            .then((r) => r.json())
            .then((d) => setEntries(Array.isArray(d) ? d : []))
            .catch(() => setErr("Failed to load"))
            .finally(() => setLoading(false));
    }, []);

    async function remove(id: string) {
        setRemoving(id);
        try {
            const res = await fetch("/api/admin/feed/free-access", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setEntries((prev) => prev.filter((e) => e._id !== id));
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setRemoving(null);
        }
    }

    function startRenew(id: string) {
        const oneYear = new Date();
        oneYear.setFullYear(oneYear.getFullYear() + 1);
        setRenewDate(oneYear.toISOString().slice(0, 10));
        setRenewing(id);
    }

    async function confirmRenew(id: string) {
        if (!renewDate) return;
        setRenewSaving(true);
        try {
            const res = await fetch("/api/admin/feed/free-access", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, expiresAt: renewDate }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            setEntries((prev) => prev.map((e) =>
                e._id === id ? { ...e, expiresAt: data.expiresAt } : e
            ));
            setRenewing(null);
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setRenewSaving(false);
        }
    }

    const visible = entries.filter((e) => {
        if (filter === "active") return isActive(e);
        if (filter === "expired") return !isActive(e);
        return true;
    });

    const activeCount = entries.filter(isActive).length;
    const expiredCount = entries.filter((e) => !isActive(e)).length;

    return (
        <div className="page-pad" style={{ maxWidth: 800 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Free Access</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Users on this list bypass the Stripe payment requirement in the DJ feed. Use for test accounts and trusted users.
                </p>
            </div>

            <div style={{ marginBottom: 20 }}>
                <AddForm onAdded={(entry) => setEntries((prev) => [entry, ...prev])} />
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {(["active", "expired", "all"] as const).map((f) => {
                    const count = f === "active" ? activeCount : f === "expired" ? expiredCount : entries.length;
                    const active = filter === f;
                    return (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            padding: "5px 14px", borderRadius: 20, border: "1px solid var(--border)",
                            background: active ? "var(--text-primary)" : "var(--surface)",
                            color: active ? "var(--surface)" : "var(--text-secondary)",
                            fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer",
                        }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)} · {count}
                        </button>
                    );
                })}
            </div>

            {loading && <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>}
            {err && <p style={{ fontSize: 13, color: "var(--danger)" }}>{err}</p>}

            {!loading && visible.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary)", fontSize: 14 }}>
                    No {filter !== "all" ? filter : ""} entries.
                </div>
            )}

            {!loading && visible.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    {visible.map((entry, i) => {
                        const active = isActive(entry);
                        const isRenewing = renewing === entry._id;
                        return (
                            <div key={entry._id} style={{
                                background: "var(--surface)",
                                borderBottom: i < visible.length - 1 ? "1px solid var(--border)" : "none",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px" }}>
                                    {/* Status dot */}
                                    <div style={{
                                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                        background: active ? "var(--success)" : "var(--text-disabled)",
                                    }} />

                                    {/* Email + note */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {entry.email}
                                        </p>
                                        {entry.note && (
                                            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{entry.note}</p>
                                        )}
                                    </div>

                                    {/* Expiry */}
                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                        {entry.expiresAt ? (
                                            <>
                                                <p style={{ fontSize: 11, color: active ? "var(--text-secondary)" : "var(--danger)", fontWeight: active ? 400 : 600 }}>
                                                    {active ? "Expires" : "Expired"}
                                                </p>
                                                <p style={{ fontSize: 12, color: active ? "var(--text-primary)" : "var(--danger)" }}>
                                                    {fmtDate(entry.expiresAt)}
                                                </p>
                                            </>
                                        ) : (
                                            <span style={{ fontSize: 12, color: "var(--success-text)", fontWeight: 600, background: "var(--success-subtle)", padding: "2px 8px", borderRadius: 20 }}>
                                                Permanent
                                            </span>
                                        )}
                                    </div>

                                    {/* Added */}
                                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                                        <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Added</p>
                                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtDate(entry.createdAt)}</p>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
                                        {!active && (
                                            <button
                                                onClick={() => isRenewing ? setRenewing(null) : startRenew(entry._id)}
                                                style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}
                                            >
                                                {isRenewing ? "Cancel" : "Renew"}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => remove(entry._id)}
                                            disabled={removing === entry._id}
                                            style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: removing === entry._id ? "wait" : "pointer", padding: "4px 0", textDecoration: "underline" }}
                                        >
                                            {removing === entry._id ? "…" : "Remove"}
                                        </button>
                                    </div>
                                </div>

                                {/* Inline renew form */}
                                {isRenewing && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 12px 38px", borderTop: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                                        <input
                                            type="date"
                                            value={renewDate}
                                            onChange={(e) => setRenewDate(e.target.value)}
                                            autoFocus
                                            style={{ ...inputStyle, width: "auto", flex: "0 0 160px" }}
                                        />
                                        <button
                                            onClick={() => confirmRenew(entry._id)}
                                            disabled={renewSaving || !renewDate}
                                            style={{
                                                padding: "7px 16px", borderRadius: 8, border: "none",
                                                background: "var(--accent)", color: "#fff",
                                                fontSize: 12, fontWeight: 600,
                                                cursor: renewSaving ? "wait" : "pointer",
                                                opacity: !renewDate ? 0.5 : 1,
                                            }}
                                        >
                                            {renewSaving ? "Saving…" : "Confirm"}
                                        </button>
                                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>New expiry for {entry.email}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
