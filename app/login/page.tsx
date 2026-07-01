"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            if (res.ok) {
                router.push("/dashboard");
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data?.error ?? "Invalid credentials.");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg)",
        }}>
            <div style={{
                width: "100%",
                maxWidth: 380,
                padding: "0 16px",
            }}>
                {/* Logo / wordmark */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: "var(--accent)",
                        marginBottom: 16,
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>LDCO Admin</h1>
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Sign in to the admin panel</p>
                </div>

                {/* Card */}
                <div style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: "28px 24px",
                }}>
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Field
                            label="Username"
                            type="text"
                            value={username}
                            onChange={setUsername}
                            autoComplete="username"
                            autoFocus
                        />
                        <Field
                            label="Password"
                            type="password"
                            value={password}
                            onChange={setPassword}
                            autoComplete="current-password"
                        />

                        {error && (
                            <p style={{ fontSize: 13, color: "var(--danger)", padding: "8px 12px", background: "var(--danger-subtle)", borderRadius: 8 }}>
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !username || !password}
                            style={{
                                width: "100%",
                                padding: "10px 0",
                                borderRadius: 10,
                                background: "var(--accent)",
                                color: "white",
                                fontWeight: 600,
                                fontSize: 14,
                                border: "none",
                                cursor: loading || !username || !password ? "not-allowed" : "pointer",
                                opacity: loading || !username || !password ? 0.6 : 1,
                                transition: "opacity 0.15s",
                            }}
                        >
                            {loading ? "Signing in…" : "Sign In"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function Field({ label, type, value, onChange, autoComplete, autoFocus }: {
    label: string;
    type: string;
    value: string;
    onChange: (v: string) => void;
    autoComplete?: string;
    autoFocus?: boolean;
}) {
    return (
        <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-raised)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                }}
            />
        </div>
    );
}
