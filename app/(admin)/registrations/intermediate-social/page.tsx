"use client";

import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";

type AttendeeStatus = "registered" | "approved" | "waitlisted" | "removed";
type Tab = "registered" | "guestlist" | "waitlist";

interface Registration {
    _id: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    agreedToWaiver: boolean;
    waiverSignedAt: string | null;
    waiverSignature: string | null;
    paymentStatus: "pending" | "paid";
    paymentMethod: "stripe" | "venmo" | null;
    stripeSessionId: string | null;
    paidAt: string | null;
    createdAt: string | null;
    attendeeStatus: AttendeeStatus;
    requests: { text: string; danceId: string | null }[];
}

export default function IntermediateSocialRegistrations() {
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("registered");
    const [pending, setPending] = useState<Record<string, string>>({});

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/registrations?event=intermediate-social-2026-09-12");
            if (res.status === 401) { window.location.href = "/login"; return; }
            setRegistrations(await res.json());
        } catch {
            setError("Failed to load registrations.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function setStatus(id: string, attendeeStatus: AttendeeStatus) {
        setPending(p => ({ ...p, [id]: attendeeStatus }));
        try {
            const res = await fetch(`/api/admin/registrations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attendeeStatus }),
            });
            if (res.ok) {
                setRegistrations(prev => prev.map(r => r._id === id ? { ...r, attendeeStatus } : r));
            }
        } finally {
            setPending(p => { const n = { ...p }; delete n[id]; return n; });
        }
    }

    async function markPaid(id: string) {
        setPending(p => ({ ...p, [id]: "paid" }));
        try {
            const res = await fetch(`/api/admin/registrations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markPaid: true }),
            });
            if (res.ok) {
                setRegistrations(prev => prev.map(r =>
                    r._id === id ? { ...r, paymentStatus: "paid", paymentMethod: "venmo", paidAt: new Date().toISOString() } : r
                ));
            }
        } finally {
            setPending(p => { const n = { ...p }; delete n[id]; return n; });
        }
    }

    const registered = registrations.filter(r => r.attendeeStatus === "registered");
    const guestlist = registrations.filter(r => r.attendeeStatus === "approved");
    const waitlist = registrations.filter(r => r.attendeeStatus === "waitlisted");

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: "registered", label: "Registered", count: registered.length },
        { key: "guestlist", label: "Guestlist", count: guestlist.length },
        { key: "waitlist", label: "Waitlist", count: waitlist.length },
    ];

    return (
        <div className="page-pad">
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                    Int LD Social
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
                    Intermediate Line Dance Social · Sep 12, 2026
                </p>
            </div>

            {loading && <p style={{ color: "var(--text-secondary)" }}>Loading…</p>}
            {error && <p style={{ color: "var(--danger-text)" }}>{error}</p>}

            {!loading && !error && (
                <>
                    {/* Summary row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
                        <StatCard label="Total" value={registrations.filter(r => r.attendeeStatus !== "removed").length} />
                        <StatCard label="Guestlist" value={guestlist.length} color="var(--success-text)" bg="var(--success-subtle)" />
                        <StatCard label="Waitlist" value={waitlist.length} color="var(--warning-text)" bg="var(--warning-subtle)" />
                        <StatCard label="Pending Review" value={registered.length} />
                    </div>

                    {/* Tab bar */}
                    <div style={{
                        display: "flex",
                        gap: 2,
                        borderBottom: "1px solid var(--border)",
                        marginBottom: 20,
                    }}>
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                style={{
                                    padding: "8px 16px",
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: tab === t.key ? 600 : 400,
                                    color: tab === t.key ? "var(--accent-text)" : "var(--text-secondary)",
                                    borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
                                    marginBottom: -1,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    transition: "color 0.15s",
                                }}
                            >
                                {t.label}
                                {t.count > 0 && (
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 10,
                                        background: tab === t.key ? "var(--accent-subtle)" : "rgba(148,163,184,0.15)",
                                        color: tab === t.key ? "var(--accent-text)" : "var(--text-tertiary)",
                                    }}>{t.count}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {tab === "registered" && (
                        <RegistrationTable
                            rows={registered}
                            pending={pending}
                            actions={(r, mobile) => mobile ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        <ActionButton
                                            label="Approve"
                                            loading={pending[r._id] === "approved"}
                                            onClick={() => setStatus(r._id, "approved")}
                                            style={{ color: "var(--success-text)", border: "1.5px solid rgba(16,185,129,0.35)", background: "var(--success-subtle)", padding: "10px 0" }}
                                        />
                                        <ActionButton
                                            label="Waitlist"
                                            loading={pending[r._id] === "waitlisted"}
                                            onClick={() => setStatus(r._id, "waitlisted")}
                                            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)", background: "transparent", padding: "10px 0" }}
                                        />
                                    </div>
                                    {r.paymentStatus !== "paid" && (
                                        <ActionButton
                                            label="Mark Paid"
                                            loading={pending[r._id] === "paid"}
                                            onClick={() => markPaid(r._id)}
                                            style={{ color: "var(--warning-text)", border: "1.5px solid rgba(245,158,11,0.4)", background: "var(--warning-subtle)", width: "100%", padding: "10px 0" }}
                                        />
                                    )}
                                    <ActionButton
                                        label="Remove"
                                        loading={pending[r._id] === "removed"}
                                        onClick={() => setStatus(r._id, "removed")}
                                        style={{ color: "var(--danger-text)", border: "1.5px solid rgba(239,68,68,0.3)", background: "var(--danger-subtle)", width: "100%", padding: "10px 0" }}
                                    />
                                </div>
                            ) : (
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                    {r.paymentStatus !== "paid" && (
                                        <ActionButton
                                            label="Mark Paid"
                                            loading={pending[r._id] === "paid"}
                                            onClick={() => markPaid(r._id)}
                                            style={{ color: "var(--warning-text)", border: "1.5px solid rgba(245,158,11,0.4)", background: "var(--warning-subtle)" }}
                                        />
                                    )}
                                    <ActionButton
                                        label="Approve"
                                        loading={pending[r._id] === "approved"}
                                        onClick={() => setStatus(r._id, "approved")}
                                        style={{ color: "var(--success-text)", border: "1.5px solid rgba(16,185,129,0.35)", background: "var(--success-subtle)" }}
                                    />
                                    <ActionButton
                                        label="Waitlist"
                                        loading={pending[r._id] === "waitlisted"}
                                        onClick={() => setStatus(r._id, "waitlisted")}
                                        style={{ color: "var(--text-secondary)", border: "1px solid var(--border)", background: "transparent" }}
                                    />
                                    <ActionButton
                                        label="Remove"
                                        loading={pending[r._id] === "removed"}
                                        onClick={() => setStatus(r._id, "removed")}
                                        style={{ color: "var(--danger-text)", border: "1.5px solid rgba(239,68,68,0.3)", background: "var(--danger-subtle)" }}
                                    />
                                </div>
                            )}
                        />
                    )}

                    {tab === "guestlist" && (
                        <RegistrationTable
                            rows={guestlist}
                            pending={pending}
                            actions={(r, mobile) => (
                                <ActionButton
                                    label="Remove"
                                    loading={pending[r._id] === "removed"}
                                    onClick={() => setStatus(r._id, "removed")}
                                    style={{ color: "var(--danger-text)", border: "1.5px solid rgba(239,68,68,0.3)", background: "var(--danger-subtle)", ...(mobile ? { width: "100%", padding: "10px 0" } : {}) }}
                                />
                            )}
                            emptyMessage="No one on the guestlist yet. Approve registrations to add them."
                        />
                    )}

                    {tab === "waitlist" && (
                        <RegistrationTable
                            rows={waitlist}
                            pending={pending}
                            actions={(r, mobile) => (
                                <ActionButton
                                    label="Approve"
                                    loading={pending[r._id] === "approved"}
                                    onClick={() => setStatus(r._id, "approved")}
                                    style={{ color: "var(--success-text)", border: "1.5px solid rgba(16,185,129,0.35)", background: "var(--success-subtle)", ...(mobile ? { width: "100%", padding: "10px 0" } : {}) }}
                                />
                            )}
                            emptyMessage="No one on the waitlist."
                        />
                    )}
                </>
            )}
        </div>
    );
}

function RegistrationTable({
    rows,
    pending,
    actions,
    emptyMessage = "No registrations yet.",
}: {
    rows: Registration[];
    pending: Record<string, string>;
    actions: (r: Registration, isMobile: boolean) => React.ReactNode;
    emptyMessage?: string;
}) {
    const isMobile = useIsMobile();

    if (rows.length === 0) {
        return (
            <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
                {emptyMessage}
            </p>
        );
    }

    if (isMobile) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((r) => (
                    <div key={r._id} style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        opacity: pending[r._id] ? 0.6 : 1,
                        transition: "opacity 0.15s",
                    }}>
                        {/* Name + payment */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
                                {r.address && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.address}</p>}
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <PaymentCell reg={r} />
                            </div>
                        </div>

                        {/* Contact */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <a href={`mailto:${r.email}`} style={{ fontSize: 13, color: "var(--accent-text)", textDecoration: "none" }}>
                                {r.email}
                            </a>
                            {r.phone && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.phone}</span>}
                        </div>

                        {/* Waiver */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {r.agreedToWaiver ? (
                                <>
                                    <Badge text="Waiver signed" color="#15803d" bg="rgba(34,197,94,0.12)" />
                                    {r.waiverSignature && (
                                        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic" }}>
                                            "{r.waiverSignature}"
                                        </span>
                                    )}
                                </>
                            ) : (
                                <Badge text="Waiver not signed" color="var(--danger-text)" bg="var(--danger-subtle)" />
                            )}
                        </div>

                        {/* Requests */}
                        {r.requests.length > 0 && (
                            <div>
                                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                                    Requests
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    {r.requests.map((req, i) => (
                                        <span key={i} style={{
                                            fontSize: 11, color: "var(--text-secondary)",
                                            background: "var(--surface-raised)",
                                            border: "1px solid var(--border)",
                                            borderRadius: 4, padding: "2px 6px",
                                        }}>
                                            {req.text}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Registered date */}
                        {r.createdAt && (
                            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                Registered {new Date(r.createdAt).toLocaleDateString()} at {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                        )}

                        {/* Actions */}
                        <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                            {actions(r, true)}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
        }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                        {["Name", "Email", "Phone", "Waiver", "Payment", "Requests", "Registered"].map(h => (
                            <th key={h} style={{
                                textAlign: "left", padding: "10px 14px",
                                fontSize: 11, fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.06em",
                                color: "var(--text-secondary)", whiteSpace: "nowrap",
                            }}>{h}</th>
                        ))}
                        <th style={{ width: 160 }} />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r._id} style={{
                            borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
                            opacity: pending[r._id] ? 0.6 : 1,
                            transition: "opacity 0.15s",
                        }}>
                            <td style={{ padding: "12px 14px", fontWeight: 500, color: "var(--text-primary)" }}>
                                {r.name}
                                {r.address && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{r.address}</div>}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                                <a href={`mailto:${r.email}`} style={{ color: "var(--accent-text)", textDecoration: "none", fontSize: 13 }}>
                                    {r.email}
                                </a>
                            </td>
                            <td style={{ padding: "12px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                                {r.phone || <span style={{ opacity: 0.35 }}>—</span>}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                                {r.agreedToWaiver ? (
                                    <div>
                                        <Badge text="Signed" color="#15803d" bg="rgba(34,197,94,0.12)" />
                                        {r.waiverSignature && (
                                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3, fontStyle: "italic" }}>
                                                "{r.waiverSignature}"
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Badge text="Not signed" color="var(--danger-text)" bg="var(--danger-subtle)" />
                                )}
                            </td>
                            <td style={{ padding: "12px 14px" }}><PaymentCell reg={r} /></td>
                            <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                                {r.requests.length === 0 ? (
                                    <span style={{ opacity: 0.35, fontSize: 13 }}>—</span>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                        {r.requests.map((req, i) => (
                                            <span key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                                {req.text}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </td>
                            <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>
                                {r.createdAt ? (
                                    <>
                                        {new Date(r.createdAt).toLocaleDateString()}
                                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                            {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                    </>
                                ) : "—"}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "right" }}>{actions(r, false)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ActionButton({
    label,
    loading,
    onClick,
    style,
}: {
    label: string;
    loading: boolean;
    onClick: () => void;
    style: React.CSSProperties;
}) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 6,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                whiteSpace: "nowrap",
                ...style,
            }}
        >
            {loading ? "…" : label}
        </button>
    );
}

function StatCard({ label, value, color, bg }: {
    label: string;
    value: number;
    color?: string;
    bg?: string;
}) {
    return (
        <div style={{
            background: bg ?? "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 20px",
            minWidth: 100,
        }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>
                {label}
            </p>
            <p style={{ fontSize: 26, fontWeight: 700, color: color ?? "var(--text-primary)", margin: 0, lineHeight: 1 }}>
                {value}
            </p>
        </div>
    );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
    return (
        <span style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 4,
            background: bg,
            color,
        }}>{text}</span>
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
    if (reg.paymentMethod === "venmo") {
        return <Badge text="Venmo Pending" color="var(--warning-text)" bg="var(--warning-subtle)" />;
    }
    return <Badge text="Pending" color="var(--text-secondary)" bg="rgba(148,163,184,0.12)" />;
}
