"use client";

import { useEffect, useState } from "react";
import { PageShell, ActionButton } from "@/components/ui";

interface Venue {
    _id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
}

function fmtAddress(v: Venue) {
    const parts = [v.address, v.city, v.state].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
}

function AddVenueForm({ onSaved }: { onSaved: () => void }) {
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const validationErr = !name.trim()
        ? "Name is required"
        : state.trim() && state.trim().length !== 2
            ? "State must be a 2-letter code (e.g. CO)"
            : null;

    async function save() {
        if (validationErr) { setErr(validationErr); return; }
        setErr(null);
        setSaving(true);
        try {
            const res = await fetch("/api/admin/bld/venues", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    address: address.trim() || null,
                    city: city.trim() || null,
                    state: state.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setName(""); setAddress(""); setCity(""); setState("");
            onSaved();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
        }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Add venue</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Field label="Name *">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Parker Dance Academy"
                        onKeyDown={(e) => e.key === "Enter" && save()}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Address">
                    <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="19557 E Parker Square Dr"
                        style={inputStyle}
                    />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
                    <Field label="City">
                        <input
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Parker"
                            style={inputStyle}
                        />
                    </Field>
                    <Field label="State">
                        <input
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            placeholder="CO"
                            maxLength={2}
                            style={inputStyle}
                        />
                    </Field>
                </div>
            </div>

            {err && (
                <p style={{ fontSize: 12, color: "var(--danger)", marginTop: -4 }}>{err}</p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
                <ActionButton label={saving ? "Saving…" : "Save venue"} onClick={save} loading={saving} />
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {label}
            </span>
            {children}
        </label>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-raised)",
    color: "var(--text-primary)",
    outline: "none",
    boxSizing: "border-box",
};

export default function VenuesPage() {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const data = await fetch("/api/admin/bld/venues").then((r) => r.json());
            setVenues(Array.isArray(data) ? data : []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function handleSaved() {
        setShowForm(false);
        load();
    }

    return (
        <PageShell title="Venues" count={venues.length} loading={loading}>
            {/* Add button / inline form */}
            {showForm ? (
                <AddVenueForm onSaved={handleSaved} />
            ) : (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <ActionButton label="+ Add venue" onClick={() => setShowForm(true)} />
                </div>
            )}

            {!loading && venues.length === 0 && !showForm && (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "24px 0", textAlign: "center" }}>
                    No venues yet.
                </p>
            )}

            {venues.map((v) => (
                <div
                    key={v._id}
                    style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: "14px 16px",
                    }}
                >
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{v.name}</p>
                    {fmtAddress(v) && (
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>{fmtAddress(v)}</p>
                    )}
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6, fontFamily: "monospace" }}>{v._id}</p>
                </div>
            ))}
        </PageShell>
    );
}
