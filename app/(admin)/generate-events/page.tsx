"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui";

function todayYmd() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function endOfMonthYmd() {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

interface Result {
    ok: boolean;
    upserted: number;
    matched: number;
    ops: number;
    note?: string;
}

const inputStyle: React.CSSProperties = {
    padding: "7px 10px", fontSize: 13, borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface-raised)",
    color: "var(--text-primary)", outline: "none",
};

export default function GenerateEventsPage() {
    const [from, setFrom] = useState(todayYmd());
    const [to, setTo] = useState(endOfMonthYmd());
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [err, setErr] = useState<string | null>(null);

    async function run() {
        setRunning(true);
        setErr(null);
        setResult(null);
        try {
            const res = await fetch("/api/admin/bld/generate-events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from, to }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Generation failed");
            setResult(data);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setRunning(false);
        }
    }

    return (
        <div style={{ padding: "32px 36px", maxWidth: 600 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Generate Events</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Expands active frequencies into calendar events. Safe to run multiple times — existing events are not overwritten.
                </p>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>From</span>
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>To</span>
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
                    </label>
                </div>

                <ActionButton label={running ? "Generating…" : "Generate"} onClick={run} loading={running || !from || !to} />

                {err && (
                    <p style={{ fontSize: 13, color: "var(--danger)" }}>{err}</p>
                )}

                {result && (
                    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: result.upserted > 0 ? "var(--success)" : "var(--text-primary)" }}>
                            {result.note ?? (result.ok ? "Done." : "Unexpected result.")}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                            {[
                                { label: "Created", value: result.upserted },
                                { label: "Already existed", value: result.matched },
                                { label: "Ops total", value: result.ops },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
