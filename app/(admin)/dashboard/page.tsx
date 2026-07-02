"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface Lesson { time: string | null; dance: string | null; level: string | null; committed: boolean }
interface CommitEvent {
    _id: string; eventTypeId: string; date: string; startTime: string; endTime: string;
    lessons: Lesson[];
    eventType: { title: string; level: string } | null;
}
interface Occurrence {
    key: string; eventTypeId: string; date: string; startTime: string;
    durationMinutes: number; endTime: string | null;
    eventType: { _id: string; title: string; level: string } | null;
}
interface Stats {
    dances: number; instructorClaims: number; venueClaims: number;
    reports: number; feedSessions: number; feedTransactions: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function fmtDate(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function todayLong() {
    return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub, href, linkLabel }: { title: string; sub: string; href?: string; linkLabel?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{sub}</p>
            </div>
            {href && (
                <Link href={href} style={{ fontSize: 12, color: "var(--accent-text)", textDecoration: "underline", flexShrink: 0 }}>
                    {linkLabel}
                </Link>
            )}
        </div>
    );
}

function GreenCheck({ label }: { label: string }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 18px", borderRadius: 10,
            background: "var(--success-subtle)", border: "1px solid rgba(16,185,129,0.2)",
            fontSize: 13, fontWeight: 500, color: "var(--success-text)",
        }}>
            <span style={{ fontSize: 15 }}>✓</span>
            {label}
        </div>
    );
}

function CommitCard({ ev, committing, onCommit }: { ev: CommitEvent; committing: boolean; onCommit: () => void }) {
    const uncommitted = ev.lessons.filter((l) => !l.committed);
    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {ev.eventType?.title ?? ev.eventTypeId}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                        {fmtDate(ev.date)} · {ev.startTime}
                        {ev.endTime ? ` – ${ev.endTime}` : ""}
                        {ev.eventType?.level && <span style={{ color: "var(--text-tertiary)" }}> · {ev.eventType.level}</span>}
                    </p>
                </div>
                <ActionButton
                    label={committing ? "Committing…" : uncommitted.length > 1 ? `Commit all ${uncommitted.length}` : "Commit"}
                    loading={committing}
                    variant="success"
                    onClick={onCommit}
                />
            </div>
            {ev.lessons.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                    {ev.lessons.map((l, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                            <span style={{ fontSize: 11, color: l.committed ? "var(--success)" : "var(--warning)", flexShrink: 0 }}>
                                {l.committed ? "✓" : "○"}
                            </span>
                            <span style={{ color: l.committed ? "var(--text-tertiary)" : "var(--text-primary)" }}>
                                {l.dance ?? "Unnamed dance"}
                            </span>
                            {l.level && (
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>· {l.level}</span>
                            )}
                            {l.time && (
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>{l.time}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <div style={{ marginTop: 10 }}>
                <Link href={`/events/${ev._id}`} style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "underline" }}>
                    Open event ↗
                </Link>
            </div>
        </div>
    );
}

function PlanCard({ occ }: { occ: Occurrence }) {
    const href = `/plan-lesson?eventTypeId=${occ.eventTypeId}&date=${occ.date}&startTime=${encodeURIComponent(occ.startTime)}&durationMinutes=${occ.durationMinutes}&title=${encodeURIComponent(occ.eventType?.title ?? "")}`;
    return (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {occ.eventType?.title ?? occ.eventTypeId}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                        {fmtDate(occ.date)} · {occ.startTime}
                        {occ.endTime ? ` – ${occ.endTime}` : ""}
                        {occ.eventType?.level && <span style={{ color: "var(--text-tertiary)" }}> · {occ.eventType.level}</span>}
                    </p>
                </div>
                <Link
                    href={href}
                    style={{
                        fontSize: 13, fontWeight: 600, color: "var(--accent-text)",
                        textDecoration: "none", background: "var(--accent-subtle)",
                        padding: "6px 14px", borderRadius: 8, flexShrink: 0,
                        whiteSpace: "nowrap",
                    }}
                >
                    Plan →
                </Link>
            </div>
        </div>
    );
}

const STAT_ITEMS = [
    { key: "instructorClaims" as const, label: "Instructor Claims", href: "/instructor-claims", color: "#0891b2" },
    { key: "venueClaims" as const, label: "Venue Claims", href: "/venue-claims", color: "#7c3aed" },
    { key: "reports" as const, label: "Reports", href: "/reports", color: "#dc2626" },
    { key: "feedSessions" as const, label: "Feed Sessions", href: "/feed-reports", color: "#059669" },
    { key: "feedTransactions" as const, label: "Feed Transactions", href: "/feed-transactions", color: "#d97706" },
];

function StatPills({ stats }: { stats: Stats | null }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STAT_ITEMS.map(({ key, label, href, color }) => {
                const val = stats?.[key] ?? 0;
                return (
                    <Link
                        key={key}
                        href={href}
                        style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 14px", borderRadius: 20,
                            background: "var(--surface)", border: "1px solid var(--border)",
                            textDecoration: "none", transition: "box-shadow 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                    >
                        <span style={{ fontSize: 15, fontWeight: 700, color: stats && val > 0 ? color : "var(--text-tertiary)", minWidth: 18, textAlign: "center" }}>
                            {stats ? val : "·"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                    </Link>
                );
            })}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [commitEvents, setCommitEvents] = useState<CommitEvent[]>([]);
    const [unplanned, setUnplanned] = useState<Occurrence[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [committing, setCommitting] = useState<string | null>(null);

    useEffect(() => {
        const now = new Date();
        const today = ymd(now);
        const sevenDaysAgo = ymd(addDays(now, -7));
        const fourteenDaysOut = ymd(addDays(now, 14));

        Promise.all([
            fetch(`/api/admin/bld/commit-lessons?from=${sevenDaysAgo}&to=${today}`).then((r) => r.json()).catch(() => []),
            fetch(`/api/admin/bld/occurrences?from=${today}&to=${fourteenDaysOut}&onlyUnplanned=true`).then((r) => r.json()).catch(() => []),
            fetch("/api/admin/stats").then((r) => r.json()).catch(() => null),
        ]).then(([commits, occs, st]) => {
            setCommitEvents(Array.isArray(commits) ? commits : []);
            setUnplanned(Array.isArray(occs) ? occs : []);
            setStats(st ?? null);
        }).finally(() => setLoading(false));
    }, []);

    async function commitEvent(eventId: string) {
        setCommitting(eventId);
        try {
            const res = await fetch("/api/admin/bld/commit-lessons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId }),
            });
            if (res.ok) {
                setCommitEvents((prev) => prev.filter((e) => e._id !== eventId));
            }
        } finally {
            setCommitting(null);
        }
    }

    return (
        <div style={{ padding: "32px 36px", maxWidth: 760 }}>
            {/* Greeting */}
            <div style={{ marginBottom: 36 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{greeting()}</h1>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>{todayLong()}</p>
            </div>

            {loading ? (
                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Loading…</div>
            ) : (
                <>
                    {/* Needs Committing */}
                    <div style={{ marginBottom: 36 }}>
                        <SectionHeader
                            title="Needs Committing"
                            sub="Past 7 days · confirm what you taught"
                            href="/commit-lessons"
                            linkLabel="See all →"
                        />
                        {commitEvents.length === 0 ? (
                            <GreenCheck label="All lessons committed — nice work!" />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {commitEvents.map((ev) => (
                                    <CommitCard
                                        key={ev._id}
                                        ev={ev}
                                        committing={committing === ev._id}
                                        onCommit={() => commitEvent(ev._id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Needs Planning */}
                    <div style={{ marginBottom: 36 }}>
                        <SectionHeader
                            title="Needs Planning"
                            sub="Next 14 days · no lesson plan yet"
                            href="/lesson-overview"
                            linkLabel="See all →"
                        />
                        {unplanned.length === 0 ? (
                            <GreenCheck label="All upcoming events planned" />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {unplanned.map((occ) => (
                                    <PlanCard key={occ.key} occ={occ} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Review Queue */}
                    <div>
                        <SectionHeader title="Review Queue" sub="Pending items across the platform" />
                        <StatPills stats={stats} />
                    </div>
                </>
            )}
        </div>
    );
}
