"use client";

import { useEffect, useState } from "react";
import { PageShell, EmptyState, Badge, ExpandableCard, InfoRow } from "@/components/ui";

interface SessionReport {
    id: string;
    sessionId: string;
    ownerId: string;
    ownerName: string | null;
    sessionName: string | null;
    startedAt: string | null;
    closedAt: string | null;
    actualDurationMs: number | null;
    trackCount: number;
    stats: {
        totalDancesPlayed: number;
        totalRequests: number;
        totalApproved: number;
        totalSkipped: number;
        totalPending: number;
        approvalRate: number | null;
        totalTipCents: number;
        uniqueRequesters: number;
    } | null;
    generatedAt: string | null;
}

interface Track {
    position: number;
    danceName: string | null;
    songName: string | null;
    artist: string | null;
    difficulty: string | null;
    stepsheet: string | null;
    danceType: string | null;
    isSongSwap: boolean;
    swapSongName: string | null;
    swapArtist: string | null;
    playedAt: string | null;
    requesterCount: number;
    totalTipCents: number;
    requesters: { name: string | null; tipCents: number }[];
}

const DIFF_COLORS: Record<string, string> = {
    beginner: "#22c55e",
    improver: "#3b82f6",
    intermediate: "#f59e0b",
    advanced: "#ef4444",
};

function diffColor(d: string) {
    const key = Object.keys(DIFF_COLORS).find((k) => d.toLowerCase().includes(k));
    return key ? DIFF_COLORS[key] : "#8A5CFF";
}

function formatDuration(ms: number) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatCents(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    played:   { label: "Played",   color: "#059669" },
    approved: { label: "Approved", color: "#0891b2" },
    playing:  { label: "Playing",  color: "#4f46e5" },
    pending:  { label: "Pending",  color: "#d97706" },
    skipped:  { label: "Skipped",  color: "#6b7280" },
    denied:   { label: "Denied",   color: "#dc2626" },
};

interface Requester {
    clientId: string | null;
    requesterName: string | null;
    requests: { danceName: string | null; danceId: string | null; danceType: string | null; status: string | null; tipCents: number; createdAt: string | null }[];
}

function DanceTypeBadge({ type }: { type: string | null }) {
    if (!type) return null;
    const isPartner = type.toLowerCase().includes("partner");
    return (
        <span style={{
            display: "inline-block",
            fontSize: 10, fontWeight: 700, flexShrink: 0,
            padding: "1px 6px", borderRadius: 4,
            background: isPartner ? "rgba(245,158,11,0.15)" : "rgba(79,70,229,0.1)",
            color: isPartner ? "#b45309" : "var(--accent-text)",
        }}>
            {isPartner ? "Partner" : "Line"}
        </span>
    );
}

function AllRequests({ requesters }: { requesters: Requester[] }) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    if (requesters.length === 0) return <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 0" }}>No request history.</p>;

    return (
        <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                All Requests — {requesters.reduce((n, r) => n + r.requests.length, 0)} total across {requesters.length} attendee{requesters.length !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {requesters.map((req, i) => {
                    const isOpen = openIdx === i;
                    const played = req.requests.filter((r) => r.status === "played").length;
                    const tipped = req.requests.reduce((n, r) => n + r.tipCents, 0);
                    return (
                        <div key={i} style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            overflow: "hidden",
                        }}>
                            <button
                                onClick={() => setOpenIdx(isOpen ? null : i)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    width: "100%", padding: "9px 12px",
                                    background: "none", border: "none", cursor: "pointer", textAlign: "left",
                                }}
                            >
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
                                    {req.requesterName ?? "Anonymous"}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                    {req.requests.length} request{req.requests.length !== 1 ? "s" : ""}
                                    {played > 0 ? ` · ${played} played` : ""}
                                    {tipped > 0 ? ` · ${formatCents(tipped)} tipped` : ""}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{isOpen ? "▲" : "▼"}</span>
                            </button>
                            {isOpen && (
                                <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                                    {req.requests.map((r, ri) => {
                                        const sc = STATUS_CONFIG[r.status ?? ""] ?? { label: r.status ?? "?", color: "var(--text-tertiary)" };
                                        return (
                                            <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr auto 80px 70px 70px", gap: 8, alignItems: "center" }}>
                                                <span style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {r.danceName ?? "Custom request"}
                                                </span>
                                                <DanceTypeBadge type={r.danceType} />
                                                <span style={{ fontSize: 11, fontWeight: 600, color: sc.color }}>
                                                    {sc.label}
                                                </span>
                                                <span style={{ fontSize: 11, color: r.tipCents > 0 ? "var(--success)" : "var(--text-tertiary)" }}>
                                                    {r.tipCents > 0 ? `+${formatCents(r.tipCents)}` : "—"}
                                                </span>
                                                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                                    {r.createdAt ? formatTime(r.createdAt) : "—"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface DanceGroup {
    danceName: string | null;
    danceId: string | null;
    danceType: string | null;
    count: number;
    played: number;
    skipped: number;
    totalTipCents: number;
    requesters: { name: string | null; status: string | null; tipCents: number }[];
}

function ByDance({ requesters }: { requesters: Requester[] }) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    const danceMap = new Map<string, DanceGroup>();
    for (const req of requesters) {
        for (const r of req.requests) {
            const key = r.danceId ?? r.danceName ?? "__custom__";
            if (!danceMap.has(key)) {
                danceMap.set(key, { danceName: r.danceName, danceId: r.danceId, danceType: r.danceType, count: 0, played: 0, skipped: 0, totalTipCents: 0, requesters: [] });
            }
            const g = danceMap.get(key)!;
            g.count++;
            if (r.status === "played") g.played++;
            if (r.status === "skipped" || r.status === "denied") g.skipped++;
            g.totalTipCents += r.tipCents;
            g.requesters.push({ name: req.requesterName, status: r.status, tipCents: r.tipCents });
        }
    }

    const dances = [...danceMap.values()].sort((a, b) => b.count - a.count);

    if (dances.length === 0) return <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 0" }}>No request history.</p>;

    return (
        <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                By Dance — {dances.length} unique dance{dances.length !== 1 ? "s" : ""} requested
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dances.map((dance, i) => {
                    const isOpen = openIdx === i;
                    return (
                        <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                            <button
                                onClick={() => setOpenIdx(isOpen ? null : i)}
                                style={{ display: "grid", gridTemplateColumns: "36px 1fr auto auto", gap: 10, alignItems: "center", width: "100%", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                            >
                                <span style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>
                                    {dance.count}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {dance.danceName ?? "Custom request"}
                                    </span>
                                    <DanceTypeBadge type={dance.danceType} />
                                </div>
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                                    {dance.played > 0 && <span style={{ color: "#059669", fontWeight: 600, marginRight: 6 }}>{dance.played} played</span>}
                                    {dance.skipped > 0 && <span style={{ color: "#6b7280", marginRight: 6 }}>{dance.skipped} skipped</span>}
                                    {dance.totalTipCents > 0 && <span style={{ color: "var(--success)" }}>{formatCents(dance.totalTipCents)} tips</span>}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{isOpen ? "▲" : "▼"}</span>
                            </button>
                            {isOpen && (
                                <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                                    {dance.requesters.map((r, ri) => {
                                        const sc = STATUS_CONFIG[r.status ?? ""] ?? { label: r.status ?? "?", color: "var(--text-tertiary)" };
                                        return (
                                            <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px", gap: 8, alignItems: "center" }}>
                                                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.name ?? "Anonymous"}</span>
                                                <span style={{ fontSize: 11, fontWeight: 600, color: sc.color }}>{sc.label}</span>
                                                <span style={{ fontSize: 11, color: r.tipCents > 0 ? "var(--success)" : "var(--text-tertiary)" }}>
                                                    {r.tipCents > 0 ? `+${formatCents(r.tipCents)}` : "—"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Lazy-loaded playlist — mounts inside an expanded card and fetches on first render
function Playlist({ reportId }: { reportId: string }) {
    const [tracks, setTracks] = useState<Track[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    useEffect(() => {
        fetch(`/api/admin/feed/reports/${reportId}`)
            .then((r) => r.json())
            .then((data) => setTracks(Array.isArray(data.tracks) ? data.tracks : []))
            .catch(() => setTracks([]))
            .finally(() => setLoading(false));
    }, [reportId]);

    if (loading) {
        return <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 0" }}>Loading playlist…</p>;
    }
    if (!tracks || tracks.length === 0) {
        return <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 0" }}>No dances recorded.</p>;
    }

    return (
        <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Playlist
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {tracks.map((track, i) => {
                    const isOpen = expandedIdx === i;
                    const songLine = track.isSongSwap
                        ? `${track.swapSongName ?? "?"}${track.swapArtist ? ` — ${track.swapArtist}` : ""} (swap)`
                        : track.songName
                            ? `${track.songName}${track.artist ? ` — ${track.artist}` : ""}`
                            : null;

                    return (
                        <div key={i} style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            overflow: "hidden",
                        }}>
                            {/* Row */}
                            <button
                                onClick={() => setExpandedIdx(isOpen ? null : i)}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "28px 1fr auto auto auto",
                                    gap: 10,
                                    alignItems: "center",
                                    width: "100%",
                                    padding: "9px 12px",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>
                                    {track.position}
                                </span>

                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {track.danceName ?? "Unknown"}
                                        </span>
                                        <DanceTypeBadge type={track.danceType} />
                                    </div>
                                    {songLine && (
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {songLine}
                                        </div>
                                    )}
                                </div>

                                {track.difficulty && (
                                    <span style={{
                                        fontSize: 10, fontWeight: 700,
                                        padding: "2px 7px", borderRadius: 20,
                                        background: `${diffColor(track.difficulty)}20`,
                                        color: diffColor(track.difficulty),
                                        whiteSpace: "nowrap",
                                    }}>
                                        {track.difficulty}
                                    </span>
                                )}

                                <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                                    {track.requesterCount > 0 ? `${track.requesterCount} req` : ""}
                                </span>

                                <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                                    {track.playedAt ? formatTime(track.playedAt) : ""}
                                </span>
                            </button>

                            {/* Expanded requesters */}
                            {isOpen && (
                                <div style={{
                                    borderTop: "1px solid var(--border)",
                                    padding: "10px 12px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                }}>
                                    {track.totalTipCents > 0 && (
                                        <p style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginBottom: 4 }}>
                                            {formatCents(track.totalTipCents)} in tips
                                        </p>
                                    )}
                                    {track.requesters.length > 0 ? (
                                        track.requesters.map((r, ri) => (
                                            <div key={ri} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                    {r.name ?? "Anonymous"}
                                                </span>
                                                {r.tipCents > 0 && (
                                                    <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600 }}>
                                                        +{formatCents(r.tipCents)}
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No requester info.</p>
                                    )}
                                    {track.stepsheet && (
                                        <a href={track.stepsheet} target="_blank" rel="noopener noreferrer"
                                            style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                                            View stepsheet ↗
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const TAB_LABELS: Record<string, string> = { playlist: "Playlist", attendee: "By Attendee", dance: "By Dance" };

function DetailTabs({ reportId }: { reportId: string }) {
    const [tab, setTab] = useState<"playlist" | "attendee" | "dance">("playlist");
    const [requesters, setRequesters] = useState<Requester[] | null>(null);
    const [reqLoading, setReqLoading] = useState(false);

    useEffect(() => {
        if ((tab === "attendee" || tab === "dance") && requesters === null && !reqLoading) {
            setReqLoading(true);
            fetch(`/api/admin/feed/reports/${reportId}/requests`)
                .then((r) => r.json())
                .then((data) => setRequesters(Array.isArray(data.requesters) ? data.requesters : []))
                .catch(() => setRequesters([]))
                .finally(() => setReqLoading(false));
        }
    }, [tab, reportId, requesters, reqLoading]);

    return (
        <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {(["playlist", "attendee", "dance"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: "4px 12px",
                            borderRadius: 20,
                            border: tab === t ? "1px solid var(--accent)" : "1px solid var(--border)",
                            background: tab === t ? "var(--accent-subtle)" : "var(--surface)",
                            color: tab === t ? "var(--accent-text)" : "var(--text-secondary)",
                            fontSize: 12,
                            fontWeight: tab === t ? 600 : 400,
                            cursor: "pointer",
                        }}
                    >
                        {TAB_LABELS[t]}
                    </button>
                ))}
            </div>
            {tab === "playlist" && <Playlist reportId={reportId} />}
            {(tab === "attendee" || tab === "dance") && (
                reqLoading || requesters === null
                    ? <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 0" }}>Loading requests…</p>
                    : tab === "attendee"
                        ? <AllRequests requesters={requesters} />
                        : <ByDance requesters={requesters} />
            )}
        </div>
    );
}

export default function FeedReportsPage() {
    const [reports, setReports] = useState<SessionReport[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const data = await fetch("/api/admin/feed/reports?limit=50").then((r) => r.json());
            setReports(Array.isArray(data.reports) ? data.reports : []);
            setTotal(data.total ?? 0);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    return (
        <PageShell title="Feed Reports" count={total} loading={loading}>
            {reports.length === 0 && !loading
                ? <EmptyState message="No session reports found." />
                : reports.map((report) => {
                    const date = report.startedAt
                        ? new Date(report.startedAt).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric", year: "numeric",
                        })
                        : "Unknown date";

                    const duration = report.actualDurationMs
                        ? formatDuration(report.actualDurationMs)
                        : report.closedAt ? null : "In progress";

                    const tipTotal = report.stats?.totalTipCents ?? 0;

                    return (
                        <ExpandableCard
                            key={report.id}
                            title={report.sessionName ?? `Session ${report.sessionId.slice(-6)}`}
                            subtitle={`${date}${duration ? ` · ${duration}` : ""}`}
                            badge={
                                report.closedAt
                                    ? <Badge label="closed" color="green" />
                                    : <Badge label="active" color="blue" />
                            }
                            meta={`${report.trackCount} dance${report.trackCount !== 1 ? "s" : ""} played · DJ: ${report.ownerName ?? report.ownerId}`}
                            actions={<></>}
                        >
                            {/* Stats grid */}
                            {report.stats && (
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                                    gap: 10,
                                    marginBottom: 10,
                                }}>
                                    {[
                                        { label: "Dances Played", value: report.stats.totalDancesPlayed },
                                        { label: "Total Requests", value: report.stats.totalRequests },
                                        { label: "Approved", value: report.stats.totalApproved },
                                        { label: "Skipped", value: report.stats.totalSkipped },
                                        { label: "Unique Requesters", value: report.stats.uniqueRequesters },
                                        {
                                            label: "Approval Rate",
                                            value: report.stats.approvalRate !== null
                                                ? `${Math.round(report.stats.approvalRate * 100)}%`
                                                : "—",
                                        },
                                    ].map(({ label, value }) => (
                                        <div key={label} style={{
                                            background: "var(--surface)",
                                            border: "1px solid var(--border)",
                                            borderRadius: 8,
                                            padding: "8px 12px",
                                        }}>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {tipTotal > 0 && (
                                <InfoRow label="Tips earned" value={formatCents(tipTotal)} />
                            )}
                            <InfoRow label="Session ID" value={report.sessionId} mono />
                            <InfoRow label="DJ ID" value={report.ownerId} mono />
                            {report.generatedAt && (
                                <InfoRow
                                    label="Report generated"
                                    value={new Date(report.generatedAt).toLocaleString()}
                                />
                            )}

                            {/* Playlist / All Requests toggle */}
                            <DetailTabs reportId={report.id} />
                        </ExpandableCard>
                    );
                })
            }

            {!loading && total > reports.length && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", paddingTop: 8 }}>
                    Showing {reports.length} of {total} reports
                </p>
            )}
        </PageShell>
    );
}
