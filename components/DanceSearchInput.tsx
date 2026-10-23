"use client";

import { useEffect, useRef, useState } from "react";
import { inputStyle } from "@/components/form";

export interface DanceHit { _id: string; danceName: string; stepsheet: string | null; difficulty: string | null }

/** Type-ahead search over LDCO dances. Disabled once a dance is picked (clear it to search again). */
export function DanceSearchInput({ value, disabled, onChange, onPick }: {
    value: string; disabled?: boolean;
    onChange: (v: string) => void;
    onPick: (d: DanceHit) => void;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hits, setHits] = useState<DanceHit[]>([]);
    const latestRef = useRef("");
    // Searching needs 2+ characters and an unpicked dance; otherwise the dropdown stays hidden.
    const active = !disabled && value.trim().length >= 2;

    useEffect(() => {
        const q = value.trim();
        latestRef.current = q;
        if (disabled || q.length < 2) return;
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await fetch(`/api/admin/bld/dances?q=${encodeURIComponent(q)}`).then((r) => r.json());
                if (latestRef.current !== q) return;
                setHits(Array.isArray(data) ? data : []);
                setOpen(true);
            } finally {
                if (latestRef.current === q) setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [value, disabled]);

    return (
        <div style={{ position: "relative" }}>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={disabled ? "" : "Search dance…"}
                onFocus={() => { if (active && hits.length > 0) setOpen(true); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                style={{ ...inputStyle, opacity: disabled ? 0.6 : 1 }}
            />
            {active && (open || loading) && (
                <div style={{ position: "absolute", zIndex: 50, top: "100%", marginTop: 2, width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto" }}>
                    {loading ? (
                        <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>Searching…</p>
                    ) : hits.length === 0 ? (
                        <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>No results</p>
                    ) : hits.map((h) => (
                        <button key={h._id} type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { onPick(h); setOpen(false); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{h.danceName}</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                {h.difficulty ?? "No level"}{h.stepsheet ? " · has stepsheet" : " · no stepsheet"}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
