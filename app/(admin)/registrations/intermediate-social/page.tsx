"use client";

import React, { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";

type AttendeeStatus = "registered" | "approved" | "waitlisted" | "removed";
type Tab = "registered" | "guestlist" | "waitlist";

interface EmailRecord {
    templateId: string;
    subject: string;
    sentAt: string;
}

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
    emails: EmailRecord[];
}

const EVENT_DATE = "Saturday, September 12, 2026";
const EVENT_SHORT = "Sep 12";

interface EmailTemplate {
    id: string;
    label: string;
    subject: string;
    body: (firstName: string) => string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
    {
        id: "guestlist-confirmed",
        label: "Guestlist Confirmed",
        subject: `You're on the guestlist! — LDCO Int LD Social ${EVENT_SHORT}`,
        body: (name) => `Hi ${name},\n\nGreat news — you've been approved for the LDCO Intermediate Line Dance Social!\n\nDate: ${EVENT_DATE}\nLocation: [VENUE]\nTime: [TIME]\n\nReply if you have any questions.\n\nSee you on the dance floor,\nStephen`,
    },
    {
        id: "waitlist",
        label: "Waitlist Notice",
        subject: `Waitlist — LDCO Int LD Social ${EVENT_SHORT}`,
        body: (name) => `Hi ${name},\n\nThank you for registering for the LDCO Intermediate Line Dance Social on ${EVENT_DATE}!\n\nWe've reached capacity, but you're on the waitlist. We'll reach out as soon as a spot opens up.\n\nStephen`,
    },
    {
        id: "reminder",
        label: "Reminder",
        subject: `Reminder: LDCO Int LD Social — ${EVENT_DATE}`,
        body: (name) => `Hi ${name},\n\nJust a reminder that the LDCO Intermediate Line Dance Social is coming up!\n\nDate: ${EVENT_DATE}\nLocation: [VENUE]\nTime: [TIME]\n\nLooking forward to seeing you there!\n\nStephen`,
    },
    {
        id: "custom",
        label: "Custom",
        subject: `LDCO Int LD Social — ${EVENT_SHORT}`,
        body: (name) => `Hi ${name},\n\n`,
    },
];

function gmailUrl(to: string, subject: string, body: string) {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function templateLabel(id: string) {
    return EMAIL_TEMPLATES.find((t) => t.id === id)?.label ?? id;
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

    function onEmailLogged(id: string, email: EmailRecord) {
        setRegistrations(prev => prev.map(r =>
            r._id === id ? { ...r, emails: [...r.emails, email] } : r
        ));
    }

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
                            onEmailLogged={onEmailLogged}
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
                            onEmailLogged={onEmailLogged}
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
                            onEmailLogged={onEmailLogged}
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
    onEmailLogged,
}: {
    rows: Registration[];
    pending: Record<string, string>;
    actions: (r: Registration, isMobile: boolean) => React.ReactNode;
    emptyMessage?: string;
    onEmailLogged: (id: string, email: EmailRecord) => void;
}) {
    const isMobile = useIsMobile();
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

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
                {rows.map((r) => {
                    const open = expandedRow === r._id;
                    return (
                        <div key={r._id} style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            overflow: "hidden",
                            opacity: pending[r._id] ? 0.6 : 1,
                            transition: "opacity 0.15s",
                        }}>
                            {/* Compact header — always visible */}
                            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                    <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {r.name}
                                    </p>
                                    <div style={{ flexShrink: 0 }}><PaymentCell reg={r} /></div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    {r.agreedToWaiver
                                        ? <Badge text="✓ Waiver" color="#15803d" bg="rgba(34,197,94,0.12)" />
                                        : <Badge text="✗ Waiver" color="var(--danger-text)" bg="var(--danger-subtle)" />
                                    }
                                    {r.requests.length > 0 && (
                                        <Badge text={`${r.requests.length} req`} color="var(--text-secondary)" bg="var(--surface-raised)" />
                                    )}
                                    {r.emails.length > 0 && (
                                        <Badge text={`✉ ${r.emails.length}`} color="var(--accent-text)" bg="var(--accent-subtle)" />
                                    )}
                                    <button
                                        onClick={() => setExpandedRow(open ? null : r._id)}
                                        style={{
                                            marginLeft: "auto", fontSize: 11, padding: "3px 8px",
                                            borderRadius: 4, border: "1px solid var(--border)",
                                            background: "transparent", color: "var(--text-tertiary)", cursor: "pointer",
                                        }}
                                    >
                                        {open ? "▲ Less" : "▼ More"}
                                    </button>
                                </div>
                            </div>

                            {/* Expandable details */}
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
                                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Emails</p>
                                        <EmailPanel reg={r} isMobile onLogged={(email) => onEmailLogged(r._id, email)} />
                                    </div>
                                </div>
                            )}

                            {/* Actions — always visible at bottom */}
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
                                padding: "10px 14px",
                                fontSize: 11, fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.06em",
                                color: "var(--text-secondary)",
                            }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const open = expandedRow === r._id;
                        return (
                            <React.Fragment key={r._id}>
                                <tr
                                    onClick={() => setExpandedRow(open ? null : r._id)}
                                    style={{
                                        borderBottom: "1px solid var(--border)",
                                        opacity: pending[r._id] ? 0.6 : 1,
                                        transition: "opacity 0.15s",
                                        cursor: "pointer",
                                        background: open ? "var(--surface-raised)" : undefined,
                                    }}
                                >
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
                                            {r.requests.length > 0 && (
                                                <Badge text={`${r.requests.length} req`} color="var(--text-secondary)" bg="var(--surface-raised)" />
                                            )}
                                            {r.emails.length > 0 && (
                                                <Badge text={`✉ ${r.emails.length}`} color="var(--accent-text)" bg="var(--accent-subtle)" />
                                            )}
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
                                                <EmailPanel reg={r} isMobile={false} onLogged={(email) => onEmailLogged(r._id, email)} />
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

function EmailPanel({ reg, isMobile, onLogged }: {
    reg: Registration;
    isMobile: boolean;
    onLogged: (email: EmailRecord) => void;
}) {
    const [sending, setSending] = useState<string | null>(null);
    const firstName = reg.name.trim().split(" ")[0] || reg.name;

    async function handleSend(template: EmailTemplate) {
        window.open(gmailUrl(reg.email, template.subject, template.body(firstName)), "_blank");
        setSending(template.id);
        const record: EmailRecord = { templateId: template.id, subject: template.subject, sentAt: new Date().toISOString() };
        try {
            const res = await fetch(`/api/admin/registrations/${reg._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ addEmail: record }),
            });
            if (res.ok) onLogged(record);
        } finally {
            setSending(null);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* History */}
            {reg.emails.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 2 }}>
                    {reg.emails.map((e, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--success-text)" }}>✓</span>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>
                                {templateLabel(e.templateId)}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                                {new Date(e.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {reg.emails.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>No emails sent yet</p>
            )}
            {/* Template buttons */}
            <div style={isMobile
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }
                : { display: "flex", gap: 6, flexWrap: "wrap" }
            }>
                {EMAIL_TEMPLATES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => handleSend(t)}
                        disabled={sending !== null}
                        style={{
                            fontSize: 12, fontWeight: 500,
                            padding: isMobile ? "9px 0" : "4px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--text-secondary)",
                            cursor: sending !== null ? "not-allowed" : "pointer",
                            opacity: sending !== null ? 0.6 : 1,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {sending === t.id ? "Opening…" : `✉ ${t.label}`}
                    </button>
                ))}
            </div>
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
