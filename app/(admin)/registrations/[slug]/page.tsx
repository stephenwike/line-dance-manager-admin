"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { type EventMeta } from "@/lib/eventTemplates";

interface RegistrationSummary {
    attendeeStatus: string;
    paymentStatus: string;
}

interface Stats {
    total: number;
    guestlist: number;
    waitlist: number;
    pending: number;
    paid: number;
}

function computeStats(regs: RegistrationSummary[]): Stats {
    const active = regs.filter(r => r.attendeeStatus !== "removed");
    return {
        total: active.length,
        guestlist: active.filter(r => r.attendeeStatus === "approved").length,
        waitlist: active.filter(r => r.attendeeStatus === "waitlisted").length,
        pending: active.filter(r => r.attendeeStatus === "registered").length,
        paid: active.filter(r => r.paymentStatus === "paid").length,
    };
}

export default function EventOverviewPage() {
    const { slug } = useParams<{ slug: string }>();
    const [event, setEvent] = useState<EventMeta | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        Promise.all([
            fetch(`/api/admin/events/${slug}`).then(r => r.ok ? r.json() : null),
            fetch(`/api/admin/registrations?event=${slug}`).then(r => r.ok ? r.json() : []),
        ]).then(([ev, regs]) => {
            if (ev) setEvent(ev);
            if (Array.isArray(regs)) setStats(computeStats(regs));
        }).finally(() => setLoading(false));
    }, [slug]);

    const cards = [
        {
            href: `/registrations/${slug}/attendees`,
            icon: "🎟️",
            label: "Attendees",
            description: "Review registrations, manage guestlist and waitlist, send emails.",
            stat: stats ? `${stats.total} registered` : null,
        },
        {
            href: `/registrations/${slug}/tally`,
            icon: "📊",
            label: "Request Tally",
            description: "See dance request counts, link requests to the catalog, export the guaranteed list.",
            stat: null,
        },
    ];

    return (
        <div className="page-pad">
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                {loading ? (
                    <div style={{ height: 28, width: 200, borderRadius: 6, background: "var(--border)", marginBottom: 8 }} />
                ) : (
                    <>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                            {event?.shortTitle ?? slug}
                        </h1>
                        {event && (
                            <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>
                                {event.title}
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Event details */}
            {event && (
                <div style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "20px 24px",
                    marginBottom: 32,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 16,
                }}>
                    <Detail label="Date" value={event.date} />
                    <Detail label="Time" value={event.time} />
                    <Detail label="Venue" value={event.venueName} sub={event.venueAddress} />
                </div>
            )}

            {/* Stats row */}
            {stats && (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                    gap: 12,
                    marginBottom: 32,
                }}>
                    <StatCard label="Total" value={stats.total} />
                    <StatCard label="Guestlist" value={stats.guestlist} color="var(--success-text)" bg="var(--success-subtle)" />
                    <StatCard label="Waitlist" value={stats.waitlist} color="var(--warning-text)" bg="var(--warning-subtle)" />
                    <StatCard label="Pending" value={stats.pending} />
                    <StatCard label="Paid" value={stats.paid} color="var(--accent-text)" bg="var(--accent-subtle)" />
                </div>
            )}

            {/* Section links */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                {cards.map(card => (
                    <Link key={card.href} href={card.href} style={{ textDecoration: "none" }}>
                        <div style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: "20px 24px",
                            cursor: "pointer",
                            transition: "border-color 0.15s, box-shadow 0.15s",
                        }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
                                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px var(--accent-subtle)";
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                <span style={{ fontSize: 22 }}>{card.icon}</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{card.label}</span>
                                {card.stat && (
                                    <span style={{
                                        marginLeft: "auto", fontSize: 11, fontWeight: 700,
                                        padding: "2px 8px", borderRadius: 20,
                                        background: "var(--surface-raised)", color: "var(--text-tertiary)",
                                        border: "1px solid var(--border)",
                                    }}>{card.stat}</span>
                                )}
                            </div>
                            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                                {card.description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

function Detail({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 4 }}>
                {label}
            </p>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{value}</p>
            {sub && <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0", whiteSpace: "pre-line" }}>{sub}</p>}
        </div>
    );
}

function StatCard({ label, value, color, bg }: {
    label: string; value: number; color?: string; bg?: string;
}) {
    return (
        <div style={{ background: bg ?? "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 20px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: color ?? "var(--text-primary)", margin: 0, lineHeight: 1 }}>{value}</p>
        </div>
    );
}
