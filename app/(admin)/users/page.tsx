"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface User {
    _id: string;
    email: string | null;
    name: string | null;
    createdAt: string | null;
}

function RemoveButton({ userId, onRemoved }: { userId: string; onRemoved: () => void }) {
    const [confirming, setConfirming] = useState(false);
    const [removing, setRemoving] = useState(false);

    async function handleConfirm() {
        setRemoving(true);
        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
            if (res.ok) onRemoved();
        } finally {
            setRemoving(false);
            setConfirming(false);
        }
    }

    if (confirming) {
        return (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <button onClick={handleConfirm} disabled={removing} style={{
                    padding: "4px 10px", borderRadius: 6,
                    border: "1px solid var(--danger)", background: "var(--danger)",
                    color: "#fff", fontSize: 12, fontWeight: 600,
                    cursor: removing ? "not-allowed" : "pointer",
                }}>
                    {removing ? "Removing…" : "Confirm"}
                </button>
                <button onClick={() => setConfirming(false)} disabled={removing} style={{
                    padding: "4px 10px", borderRadius: 6,
                    border: "1px solid var(--border)", background: "transparent",
                    color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                }}>
                    Cancel
                </button>
            </span>
        );
    }

    return (
        <button onClick={() => setConfirming(true)} style={{
            padding: "4px 10px", borderRadius: 6,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
        }}>
            Remove
        </button>
    );
}

function fmt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const isMobile = useIsMobile();

    useEffect(() => {
        fetch("/api/admin/users")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setUsers(data);
                else setError(data.error || "Failed to load users");
            })
            .catch(() => setError("Failed to load users"))
            .finally(() => setLoading(false));
    }, []);

    const filtered = users.filter((u) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (u.email ?? "").toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q);
    });

    function onRemoved(id: string) {
        setUsers((prev) => prev.filter((x) => x._id !== id));
    }

    return (
        <div className="page-pad" style={{ maxWidth: 900 }}>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Users</h1>
                <p style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 14 }}>
                    Accounts registered with LDCO
                </p>
            </div>

            {loading && <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading…</p>}
            {error && <p style={{ color: "var(--danger-text)", fontSize: 14 }}>{error}</p>}

            {!loading && !error && (
                <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                        <input
                            type="search"
                            placeholder="Search by name or email…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                flex: 1, maxWidth: 340, padding: "8px 12px",
                                border: "1px solid var(--border)", borderRadius: 8,
                                background: "var(--surface)", color: "var(--text-primary)",
                                fontSize: 13, outline: "none",
                            }}
                        />
                        <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                            {filtered.length} {filtered.length === 1 ? "user" : "users"}
                        </span>
                    </div>

                    {isMobile ? (
                        /* ── Mobile: card list ── */
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {filtered.length === 0 && (
                                <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                                    No users found
                                </p>
                            )}
                            {filtered.map((u) => (
                                <div key={u._id} style={{
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 10,
                                    padding: "14px 16px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                                            {u.name || <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>No name</span>}
                                        </p>
                                        <RemoveButton userId={u._id} onRemoved={() => onRemoved(u._id)} />
                                    </div>
                                    {u.email && (
                                        <a href={`mailto:${u.email}`} style={{ fontSize: 13, color: "var(--accent-text)", textDecoration: "none" }}>
                                            {u.email}
                                        </a>
                                    )}
                                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                                        Joined {fmt(u.createdAt)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* ── Desktop: table ── */
                        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                        {["Name", "Email", "Joined", ""].map((h, i) => (
                                            <th key={i} style={{
                                                padding: "10px 16px", textAlign: "left",
                                                fontWeight: 600, color: "var(--text-secondary)",
                                                background: "var(--surface-raised)", fontSize: 12,
                                                letterSpacing: "0.03em",
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: "24px 16px", color: "var(--text-tertiary)", textAlign: "center" }}>
                                                No users found
                                            </td>
                                        </tr>
                                    )}
                                    {filtered.map((u, i) => (
                                        <tr key={u._id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                                            <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontWeight: 500 }}>
                                                {u.name || <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                                            </td>
                                            <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                                                {u.email || <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                                            </td>
                                            <td style={{ padding: "12px 16px", color: "var(--text-tertiary)" }}>
                                                {fmt(u.createdAt)}
                                            </td>
                                            <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                                <RemoveButton userId={u._id} onRemoved={() => onRemoved(u._id)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
