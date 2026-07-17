"use client";

import { useState, type ReactNode } from "react";

// ── PageShell ────────────────────────────────────────────────────────────────

export function PageShell({ title, count, loading, children, actions }: {
    title: string;
    count: number;
    loading: boolean;
    children: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div style={{ padding: "32px 36px", maxWidth: 800 }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h1>
                    {!loading && count > 0 && (
                        <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            background: "var(--accent-subtle)",
                            color: "var(--accent-text)",
                            padding: "2px 8px",
                            borderRadius: 20,
                        }}>
                            {count}
                        </span>
                    )}
                    {actions && <div style={{ marginLeft: "auto" }}>{actions}</div>}
                </div>
                {loading && (
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Loading…</p>
                )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {children}
            </div>
        </div>
    );
}

// ── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ message }: { message: string }) {
    return (
        <div style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
        }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{message}</p>
        </div>
    );
}

// ── Badge ────────────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
    blue: { bg: "rgba(79,70,229,0.1)", color: "#4f46e5" },
    green: { bg: "rgba(16,185,129,0.1)", color: "#065f46" },
    orange: { bg: "rgba(245,158,11,0.1)", color: "#92400e" },
    red: { bg: "rgba(239,68,68,0.1)", color: "#991b1b" },
};

export function Badge({ label, color = "blue" }: { label: string; color?: "blue" | "green" | "orange" | "red" }) {
    const s = BADGE_STYLES[color] ?? BADGE_STYLES.blue;
    return (
        <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 20,
            background: s.bg,
            color: s.color,
            textTransform: "capitalize",
            whiteSpace: "nowrap",
        }}>
            {label}
        </span>
    );
}

// ── ActionButton ─────────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; hover: string; color: string }> = {
    success: { bg: "var(--success)", hover: "#059669", color: "white" },
    danger: { bg: "var(--danger)", hover: "var(--danger-hover)", color: "white" },
    primary: { bg: "var(--accent)", hover: "var(--accent-hover)", color: "white" },
    ghost: { bg: "var(--surface-raised)", hover: "var(--border)", color: "var(--text-secondary)" },
};

export function ActionButton({ label, variant = "primary", loading = false, onClick }: {
    label: string;
    variant?: "success" | "danger" | "primary" | "ghost";
    loading?: boolean;
    onClick: () => void;
}) {
    const s = ACTION_STYLES[variant] ?? ACTION_STYLES.primary;
    const [hovered, setHovered] = useState(false);

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: hovered ? s.hover : s.bg,
                color: s.color,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                transition: "background 0.15s, opacity 0.15s",
            }}
        >
            {loading ? "…" : label}
        </button>
    );
}

// ── ExpandableCard ───────────────────────────────────────────────────────────

export function ExpandableCard({ title, subtitle, badge, meta, actions, children }: {
    title: string;
    subtitle?: string;
    badge?: ReactNode;
    meta?: string;
    actions: ReactNode;
    children?: ReactNode;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
        }}>
            {/* Header row */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
            }}>
                {/* Expand toggle */}
                <button
                    type="button"
                    onClick={() => setExpanded((p) => !p)}
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--surface-raised)",
                        color: "var(--text-tertiary)",
                        fontSize: 11,
                        cursor: "pointer",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    title={expanded ? "Collapse" : "Expand"}
                >
                    {expanded ? "▲" : "▼"}
                </button>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
                        {badge}
                    </div>
                    {subtitle && (
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {subtitle}
                        </p>
                    )}
                    {meta && (
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{meta}</p>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {actions}
                </div>
            </div>

            {/* Expanded detail */}
            {expanded && children && (
                <div style={{
                    borderTop: "1px solid var(--border)",
                    padding: "12px 16px 14px",
                    background: "var(--surface-raised)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}>
                    {children}
                </div>
            )}
        </div>
    );
}

// ── InfoRow ──────────────────────────────────────────────────────────────────

export function InfoRow({ label, value, mono = false, children }: {
    label: string;
    value?: string;
    mono?: boolean;
    children?: ReactNode;
}) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                width: 110,
                flexShrink: 0,
                paddingTop: 2,
            }}>
                {label}
            </span>
            {children ?? (
                <span style={{
                    fontSize: mono ? 12 : 13,
                    color: "var(--text-primary)",
                    fontFamily: mono ? "monospace" : "inherit",
                    wordBreak: "break-all",
                } as React.CSSProperties}>
                    {value ?? "—"}
                </span>
            )}
        </div>
    );
}
