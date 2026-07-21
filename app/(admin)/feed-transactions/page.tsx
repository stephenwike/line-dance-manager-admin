"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui";
import { useIsMobile } from "@/hooks/use-is-mobile";

type TxType = "purchase" | "beat_tip" | "direct_tip";

interface Transaction {
    id: string;
    txType: TxType | string;
    fromId: string | null;
    fromName: string | null;
    fromEmail: string | null;
    toId: string | null;
    toName: string | null;
    beats: number | null;
    amountCents: number | null;
    requestId: string | null;
    stripeRef: string | null;
    createdAt: string | null;
}

interface Totals {
    purchase: number;
    beatTip: number;
    directTip: number;
    combined: number;
}

const FILTER_OPTIONS: { value: "" | TxType; label: string; description: string }[] = [
    { value: "", label: "All", description: "Every transaction" },
    { value: "purchase", label: "Beat Purchases", description: "Attendees buying beats with cash" },
    { value: "beat_tip", label: "Beat Tips", description: "Beats spent to tip the DJ" },
    { value: "direct_tip", label: "Direct Tips", description: "Cash tips sent straight to the DJ" },
];

const TX_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    purchase:   { label: "Beat Purchase", color: "#4f46e5", bg: "rgba(79,70,229,0.08)" },
    beat_tip:   { label: "Beat Tip",      color: "#0891b2", bg: "rgba(8,145,178,0.08)" },
    direct_tip: { label: "Direct Tip",    color: "#059669", bg: "rgba(5,150,105,0.08)" },
};

// Labels shown when a party is platform/unknown
const TO_FALLBACK: Record<string, string> = {
    purchase: "Beat Balance",
};
const FROM_FALLBACK: Record<string, string> = {
    direct_tip: "Guest",
};

function formatCents(cents: number | null) {
    if (cents === null) return null;
    const abs = Math.abs(cents) / 100;
    return cents < 0 ? `-$${abs.toFixed(2)}` : `$${abs.toFixed(2)}`;
}

function TypeChip({ txType }: { txType: string }) {
    const cfg = TX_CONFIG[txType] ?? { label: txType, color: "var(--text-secondary)", bg: "var(--surface-raised)" };
    return (
        <span style={{
            fontSize: 11, fontWeight: 700,
            padding: "3px 8px", borderRadius: 20,
            background: cfg.bg, color: cfg.color,
            whiteSpace: "nowrap",
        }}>
            {cfg.label}
        </span>
    );
}

function UserCell({ id, name, email, fallback, stripeRef }: {
    id: string | null;
    name: string | null;
    email?: string | null;
    fallback?: string;
    stripeRef?: string | null;
}) {
    const displayName = name ?? fallback ?? null;
    const hasAny = id || name || email || fallback;
    if (!hasAny) return <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>—</span>;
    return (
        <div style={{ minWidth: 0 }}>
            {displayName && (
                <div style={{
                    fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                    {displayName}
                </div>
            )}
            {email && (
                <div style={{
                    fontSize: 11, color: "var(--text-secondary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                    {email}
                </div>
            )}
            {id && (
                <div style={{
                    fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                    {id}
                </div>
            )}
            {/* Historical direct tips: no name/email stored — surface Stripe session ID for manual lookup */}
            {!name && !email && !id && stripeRef && (
                <div style={{
                    fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
                    title="Stripe session ID — look up in Stripe Dashboard for customer details"
                >
                    stripe: {stripeRef}
                </div>
            )}
        </div>
    );
}

export default function FeedTransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"" | TxType>("");
    const [filterHovered, setFilterHovered] = useState<string | null>(null);
    const isMobile = useIsMobile();

    async function load(type: "" | TxType) {
        setLoading(true);
        try {
            const qs = type ? `?txType=${type}&limit=100` : "?limit=100";
            const data = await fetch(`/api/admin/feed/transactions${qs}`).then((r) => r.json());
            setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
            setTotals(data.totals ?? null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(filter); }, [filter]);

    const displayCount = totals
        ? filter === "purchase" ? totals.purchase
        : filter === "beat_tip" ? totals.beatTip
        : filter === "direct_tip" ? totals.directTip
        : totals.combined
        : 0;

    return (
        <div className="page-pad" style={{ maxWidth: 1000 }}>

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Feed Transactions</h1>
                    {!loading && displayCount > 0 && (
                        <span style={{
                            fontSize: 12, fontWeight: 700,
                            background: "var(--accent-subtle)", color: "var(--accent-text)",
                            padding: "2px 8px", borderRadius: 20,
                        }}>
                            {displayCount}
                        </span>
                    )}
                </div>
                {loading && <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Loading…</p>}
            </div>

            {/* Summary cards — clickable to filter */}
            {totals && !loading && (
                <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                    {[
                        { label: "Beat Purchases", value: totals.purchase, color: "#4f46e5", sub: "Cash in from attendees", filter: "purchase" as TxType },
                        { label: "Beat Tips", value: totals.beatTip, color: "#0891b2", sub: "Beats spent + DJ credits", filter: "beat_tip" as TxType },
                        { label: "Direct Tips", value: totals.directTip, color: "#059669", sub: "Cash tips to DJs", filter: "direct_tip" as TxType },
                    ].map(({ label, value, color, sub, filter: f }) => (
                        <div key={label}
                            onClick={() => setFilter(filter === f ? "" : f)}
                            style={{
                                background: "var(--surface)",
                                border: `1px solid ${filter === f ? color : "var(--border)"}`,
                                borderRadius: 12,
                                padding: "12px 18px",
                                minWidth: 160,
                                cursor: "pointer",
                                transition: "border-color 0.15s",
                            }}
                        >
                            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 2 }}>{label}</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {FILTER_OPTIONS.map(({ value, label, description }) => {
                    const active = filter === value;
                    const hovered = filterHovered === value && !active;
                    return (
                        <button
                            key={value}
                            onClick={() => setFilter(value)}
                            onMouseEnter={() => setFilterHovered(value)}
                            onMouseLeave={() => setFilterHovered(null)}
                            title={description}
                            style={{
                                padding: "5px 14px",
                                borderRadius: 20,
                                border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                                background: active ? "var(--accent-subtle)" : hovered ? "var(--surface-raised)" : "var(--surface)",
                                color: active ? "var(--accent-text)" : "var(--text-secondary)",
                                fontSize: 12,
                                fontWeight: active ? 600 : 400,
                                cursor: "pointer",
                                transition: "background 0.12s, border-color 0.12s",
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {filter === "beat_tip" && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>
                    Each beat tip generates two records — one for the attendee (beats spent) and one for the DJ (cash credit received).
                </p>
            )}

            {!loading && transactions.length === 0 && (
                <EmptyState message="No transactions found." />
            )}

            {!loading && transactions.length > 0 && (isMobile ? (
                /* ── Mobile: card list ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {transactions.map((tx) => {
                        const amountStr = formatCents(tx.amountCents);
                        const isNegBeats = tx.beats !== null && tx.beats < 0;
                        const fromName = tx.fromName ?? (!tx.fromEmail ? FROM_FALLBACK[tx.txType] : null) ?? tx.fromEmail;
                        const toName = tx.toName ?? TO_FALLBACK[tx.txType];
                        return (
                            <div key={tx.id} style={{
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                padding: "14px 16px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}>
                                {/* Row 1: type chip + date */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                    <TypeChip txType={tx.txType} />
                                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                                        {tx.createdAt
                                            ? new Date(tx.createdAt).toLocaleString("en-US", {
                                                month: "short", day: "numeric",
                                                hour: "numeric", minute: "2-digit",
                                            })
                                            : "—"}
                                    </span>
                                </div>

                                {/* Row 2: From → To */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                    <span style={{ fontWeight: 500, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {fromName || "—"}
                                    </span>
                                    <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>→</span>
                                    <span style={{ fontWeight: 500, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {toName || "—"}
                                    </span>
                                </div>

                                {/* Row 3: beats + amount */}
                                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                                    {tx.beats !== null && (
                                        <span style={{
                                            fontWeight: 600,
                                            color: isNegBeats ? "var(--danger)" : "var(--text-primary)",
                                        }}>
                                            {tx.beats > 0 ? "+" : ""}{tx.beats} ♪
                                        </span>
                                    )}
                                    {amountStr && (
                                        <span style={{
                                            fontWeight: 600,
                                            color: amountStr.startsWith("-") ? "var(--danger)" : "var(--success)",
                                        }}>
                                            {amountStr}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ── Desktop: grid table ── */
                <div style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    overflow: "hidden",
                }}>
                    {/* Table header */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "130px 1fr 24px 1fr 80px 80px 150px",
                        gap: 10,
                        padding: "10px 16px",
                        borderBottom: "1px solid var(--border)",
                        background: "var(--surface-raised)",
                        alignItems: "center",
                    }}>
                        {["Type", "From", "", "To", "Beats", "Amount", "Date"].map((h, i) => (
                            <span key={i} style={{
                                fontSize: 11, fontWeight: 600,
                                color: "var(--text-tertiary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                textAlign: h === "" ? "center" : undefined,
                            }}>
                                {h}
                            </span>
                        ))}
                    </div>

                    {transactions.map((tx, i) => {
                        const amountStr = formatCents(tx.amountCents);
                        const isNegBeats = tx.beats !== null && tx.beats < 0;

                        return (
                            <div
                                key={tx.id}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "130px 1fr 24px 1fr 80px 80px 150px",
                                    gap: 10,
                                    padding: "11px 16px",
                                    alignItems: "center",
                                    borderBottom: i < transactions.length - 1 ? "1px solid var(--border)" : "none",
                                }}
                            >
                                <TypeChip txType={tx.txType} />

                                <UserCell
                                    id={tx.fromId}
                                    name={tx.fromName}
                                    email={tx.fromEmail}
                                    fallback={!tx.fromName && !tx.fromEmail ? FROM_FALLBACK[tx.txType] : undefined}
                                    stripeRef={tx.txType === "direct_tip" ? tx.stripeRef : null}
                                />

                                <span style={{
                                    fontSize: 14, color: "var(--text-tertiary)",
                                    textAlign: "center", userSelect: "none",
                                }}>
                                    →
                                </span>

                                <UserCell
                                    id={tx.toId}
                                    name={tx.toName}
                                    fallback={TO_FALLBACK[tx.txType]}
                                />

                                <span style={{
                                    fontSize: 13,
                                    color: isNegBeats ? "var(--danger)" : "var(--text-primary)",
                                    fontWeight: tx.beats !== null ? 600 : 400,
                                }}>
                                    {tx.beats !== null
                                        ? `${tx.beats > 0 ? "+" : ""}${tx.beats} ♪`
                                        : "—"}
                                </span>

                                <span style={{
                                    fontSize: 13,
                                    fontWeight: amountStr ? 600 : 400,
                                    color: amountStr
                                        ? amountStr.startsWith("-") ? "var(--danger)" : "var(--success)"
                                        : "var(--text-tertiary)",
                                }}>
                                    {amountStr ?? "—"}
                                </span>

                                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                                    {tx.createdAt
                                        ? new Date(tx.createdAt).toLocaleString("en-US", {
                                            month: "short", day: "numeric",
                                            hour: "numeric", minute: "2-digit",
                                        })
                                        : "—"}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ))}

            {!loading && displayCount > transactions.length && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", paddingTop: 12 }}>
                    Showing {transactions.length} of {displayCount} transactions
                </p>
            )}
        </div>
    );
}
