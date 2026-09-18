"use client";

import { useState } from "react";

export default function MigrateEventsPage() {
    const [status, setStatus] = useState<string | null>(null);
    const [running, setRunning] = useState(false);

    async function runMigration() {
        setRunning(true);
        setStatus(null);
        try {
            const res = await fetch("/api/admin/migrate/events", { method: "POST" });
            const data = await res.json();
            setStatus(res.ok ? `✓ ${data.message}` : `✗ ${data.error ?? "Unknown error"}`);
        } catch {
            setStatus("✗ Network error");
        } finally {
            setRunning(false);
        }
    }

    return (
        <div className="page-pad">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                Event Data Migration
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 24 }}>
                Copies <code>ldco.event_registrations</code> → <code>ldco-events.event_registrations</code> and seeds the events collection. Safe to run multiple times.
            </p>
            <button
                onClick={runMigration}
                disabled={running}
                style={{
                    fontSize: 14, fontWeight: 600, padding: "10px 24px", borderRadius: 8,
                    border: "none", background: "var(--accent)", color: "#fff",
                    cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.6 : 1,
                }}
            >
                {running ? "Running…" : "Run Migration"}
            </button>
            {status && (
                <p style={{
                    marginTop: 20, fontSize: 14, padding: "12px 16px", borderRadius: 8,
                    background: status.startsWith("✓") ? "var(--success-subtle)" : "var(--danger-subtle)",
                    color: status.startsWith("✓") ? "var(--success-text)" : "var(--danger-text)",
                    border: `1px solid ${status.startsWith("✓") ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                }}>
                    {status}
                </p>
            )}
        </div>
    );
}
