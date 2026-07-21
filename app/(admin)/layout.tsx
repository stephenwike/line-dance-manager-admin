"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
    { href: "/dashboard", label: "Dashboard", icon: "⊞", section: null },
    { href: "/registrations/intermediate-social", label: "Int LD Social", icon: "🎟️", section: "Special Events" },
    { href: "/registrations/intermediate-social/tally", label: "Request Tally", icon: "📊", section: null },
    { href: "/dances", label: "Dances", icon: "♪", section: "Website" },
    { href: "/instructor-claims", label: "Instructor Claims", icon: "👤", section: null },
    { href: "/venue-claims", label: "Venue Claims", icon: "🏠", section: null },
    { href: "/reports", label: "Reports", icon: "⚑", section: null },
    { href: "/users", label: "Users", icon: "👥", section: "Users" },
    { href: "/feed-reports", label: "Feed Reports", icon: "📊", section: "DJ Feed" },
    { href: "/feed-transactions", label: "Feed Transactions", icon: "💳", section: null },
    { href: "/feed-free-access", label: "Free Access", icon: "🔓", section: null },
    { href: "/venues", label: "Venues", icon: "🏠", section: "Scheduling" },
    { href: "/event-types", label: "Event Types", icon: "📅", section: null },
    { href: "/frequencies", label: "Frequencies", icon: "🔁", section: null },
    { href: "/generate-events", label: "Generate Events", icon: "⚡", section: null },
    { href: "/add-event", label: "Add Special Event", icon: "✦", section: null },
    { href: "/lesson-overview", label: "Lesson Overview", icon: "📋", section: null },
    { href: "/add-taught-lesson", label: "Add Taught Lesson", icon: "✏️", section: null },
    { href: "/commit-lessons", label: "Mark as Taught", icon: "✅", section: null },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [hoveredHref, setHoveredHref] = useState<string | null>(null);
    const [logoutHovered, setLogoutHovered] = useState(false);
    const [navOpen, setNavOpen] = useState(false);

    // Close nav when route changes (mobile: after tapping a link)
    useEffect(() => {
        setNavOpen(false);
    }, [pathname]);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    const wordmark = (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
            }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--sidebar-text-active)", lineHeight: 1.2 }}>LDCO</p>
                <p style={{ fontSize: 11, color: "var(--sidebar-text)", lineHeight: 1.2 }}>Admin Panel</p>
            </div>
        </div>
    );

    const navItems = (
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
            {NAV.map(({ href, label, icon, section }) => {
                const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                const hovered = hoveredHref === href && !active;
                return (
                    <div key={href}>
                        {section && (
                            <div style={{
                                fontSize: 10, fontWeight: 700, color: "var(--sidebar-text)",
                                textTransform: "uppercase", letterSpacing: "0.08em",
                                padding: "10px 10px 4px", opacity: 0.5, marginTop: 4,
                            }}>
                                {section}
                            </div>
                        )}
                        <Link
                            href={href}
                            onMouseEnter={() => setHoveredHref(href)}
                            onMouseLeave={() => setHoveredHref(null)}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "8px 10px", borderRadius: 8,
                                textDecoration: "none", fontSize: 13,
                                fontWeight: active ? 600 : 400,
                                color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                                background: active
                                    ? "var(--sidebar-active-bg)"
                                    : hovered ? "var(--sidebar-hover-bg)" : "transparent",
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
    );

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* Mobile top bar */}
            <div className="admin-topbar">
                <button
                    onClick={() => setNavOpen(o => !o)}
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--sidebar-text-active)", padding: 6,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 6,
                    }}
                    aria-label="Toggle navigation"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                {wordmark}
            </div>

            {/* Overlay (mobile only) */}
            <div
                className={`admin-overlay${navOpen ? " open" : ""}`}
                onClick={() => setNavOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`admin-sidebar${navOpen ? " open" : ""}`}>
                {/* Wordmark */}
                <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--sidebar-border)" }}>
                    {wordmark}
                </div>

                {navItems}

                {/* Footer / logout */}
                <div style={{ padding: "12px 8px", borderTop: "1px solid var(--sidebar-border)" }}>
                    <button
                        onClick={handleLogout}
                        onMouseEnter={() => setLogoutHovered(true)}
                        onMouseLeave={() => setLogoutHovered(false)}
                        style={{
                            display: "flex", alignItems: "center", gap: 10,
                            width: "100%", padding: "8px 10px", borderRadius: 8,
                            border: "none",
                            background: logoutHovered ? "var(--sidebar-hover-bg)" : "transparent",
                            color: "var(--sidebar-text)", fontSize: 13,
                            cursor: "pointer", textAlign: "left", transition: "background 0.15s",
                        }}
                    >
                        <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>↩</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="admin-main" style={{ flex: 1 }}>
                {children}
            </main>
        </div>
    );
}
