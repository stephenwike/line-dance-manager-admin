"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
    { href: "/dashboard", label: "Dashboard", icon: "⊞", section: null },
    { href: "/dances", label: "Dances", icon: "♪", section: null },
    { href: "/instructor-claims", label: "Instructor Claims", icon: "👤", section: null },
    { href: "/venue-claims", label: "Venue Claims", icon: "🏠", section: null },
    { href: "/reports", label: "Reports", icon: "⚑", section: null },
    { href: "/feed-reports", label: "Feed Reports", icon: "📊", section: "DJ Feed" },
    { href: "/feed-transactions", label: "Feed Transactions", icon: "💳", section: null },
    { href: "/venues", label: "Venues", icon: "🏠", section: "Scheduling" },
    { href: "/event-types", label: "Event Types", icon: "📅", section: null },
    { href: "/frequencies", label: "Frequencies", icon: "🔁", section: null },
    { href: "/generate-events", label: "Generate Events", icon: "⚡", section: null },
    { href: "/lesson-overview", label: "Lesson Overview", icon: "📋", section: null },
    { href: "/commit-lessons", label: "Commit Lessons", icon: "✅", section: null },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [hoveredHref, setHoveredHref] = useState<string | null>(null);
    const [logoutHovered, setLogoutHovered] = useState(false);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* Sidebar — z-index 200 ensures it always sits above page content (dropdowns, popovers, etc.) */}
            <aside style={{
                width: "var(--sidebar-width)",
                flexShrink: 0,
                background: "var(--sidebar-bg)",
                display: "flex",
                flexDirection: "column",
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 200,
            }}>
                {/* Wordmark */}
                <div style={{
                    padding: "20px 16px 16px",
                    borderBottom: "1px solid var(--sidebar-border)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "var(--accent)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--sidebar-text-active)", lineHeight: 1.2 }}>LDCO</p>
                            <p style={{ fontSize: 11, color: "var(--sidebar-text)", lineHeight: 1.2 }}>Admin Panel</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
                    {NAV.map(({ href, label, icon, section }) => {
                        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                        const hovered = hoveredHref === href && !active;
                        return (
                            <div key={href}>
                                {section && (
                                    <div style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: "var(--sidebar-text)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.08em",
                                        padding: "10px 10px 4px",
                                        opacity: 0.5,
                                        marginTop: 4,
                                    }}>
                                        {section}
                                    </div>
                                )}
                                <Link
                                    href={href}
                                    onMouseEnter={() => setHoveredHref(href)}
                                    onMouseLeave={() => setHoveredHref(null)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        textDecoration: "none",
                                        fontSize: 13,
                                        fontWeight: active ? 600 : 400,
                                        color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                                        background: active
                                            ? "var(--sidebar-active-bg)"
                                            : hovered
                                                ? "var(--sidebar-hover-bg)"
                                                : "transparent",
                                        transition: "background 0.15s, color 0.15s",
                                    }}
                                >
                                    <span style={{ fontSize: 15, width: 18, textAlign: "center", flexShrink: 0 }}>{icon}</span>
                                    {label}
                                </Link>
                            </div>
                        );
                    })}
                </nav>

                {/* Footer / logout */}
                <div style={{ padding: "12px 8px", borderTop: "1px solid var(--sidebar-border)" }}>
                    <button
                        onClick={handleLogout}
                        onMouseEnter={() => setLogoutHovered(true)}
                        onMouseLeave={() => setLogoutHovered(false)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: logoutHovered ? "var(--sidebar-hover-bg)" : "transparent",
                            color: "var(--sidebar-text)",
                            fontSize: 13,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "background 0.15s",
                        }}
                    >
                        <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>↩</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main style={{
                flex: 1,
                marginLeft: "var(--sidebar-width)",
                minHeight: "100vh",
                background: "var(--bg)",
            }}>
                {children}
            </main>
        </div>
    );
}
