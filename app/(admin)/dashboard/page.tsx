"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
    dances: number;
    instructorClaims: number;
    venueClaims: number;
    reports: number;
    feedSessions: number;
    feedTransactions: number;
}

const CARDS = [
    { key: "dances" as const, label: "Pending Dances", href: "/dances", color: "var(--accent)", icon: "♪" },
    { key: "instructorClaims" as const, label: "Instructor Claims", href: "/instructor-claims", color: "#0891b2", icon: "👤" },
    { key: "venueClaims" as const, label: "Venue Claims", href: "/venue-claims", color: "#7c3aed", icon: "🏠" },
    { key: "reports" as const, label: "Reports", href: "/reports", color: "#dc2626", icon: "⚑" },
    { key: "feedSessions" as const, label: "Feed Sessions", href: "/feed-reports", color: "#059669", icon: "📊" },
    { key: "feedTransactions" as const, label: "Feed Transactions", href: "/feed-transactions", color: "#d97706", icon: "💳" },
];

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        fetch("/api/admin/stats")
            .then((r) => r.json())
            .then(setStats)
            .catch(() => {});
    }, []);

    return (
        <div style={{ padding: "32px 36px" }}>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Dashboard</h1>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
                    Review queue summary
                </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                {CARDS.map(({ key, label, href, color, icon }) => (
                    <Link
                        key={key}
                        href={href}
                        style={{
                            display: "block",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 14,
                            padding: "20px 20px",
                            textDecoration: "none",
                            transition: "box-shadow 0.15s, transform 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                            el.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.boxShadow = "none";
                            el.style.transform = "none";
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 20 }}>{icon}</span>
                            <div style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: stats && stats[key] > 0 ? color : "var(--border-strong)",
                            }} />
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, color: stats && stats[key] > 0 ? color : "var(--text-tertiary)", lineHeight: 1 }}>
                            {stats ? stats[key] : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{label}</div>
                    </Link>
                ))}
            </div>

            {stats && Object.values(stats).every((v) => v === 0) && (
                <div style={{
                    marginTop: 40,
                    textAlign: "center",
                    padding: 40,
                    background: "var(--surface)",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                }}>
                    <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
                    <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>All clear!</p>
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>No items pending review.</p>
                </div>
            )}
        </div>
    );
}
