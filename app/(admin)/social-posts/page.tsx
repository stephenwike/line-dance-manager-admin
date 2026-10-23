"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionButton } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

type Status = "pending" | "approved" | "publishing" | "published" | "skipped" | "expired" | "failed";
interface Post {
    _id: string; kind: "lesson" | "cancellation" | "weekly_outline" | "test"; label: string; status: Status;
    message: string; editedMessage: string | null; issues: { check: string; message: string }[];
    planHash: string; alertAt: string; expireAt: string; alertedAt: string | null;
    fbPostId: string | null; publishedAt: string | null; error: string | null; note: string | null;
    updatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<Post["kind"], string> = { lesson: "Lesson plan", cancellation: "Cancellation", weekly_outline: "Weekly outline", test: "Test (hidden on Facebook)" };
const APPROVABLE: Status[] = ["pending", "failed", "expired"];

function formatWhen(iso: string) {
    return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function StatusPill({ status }: { status: Status }) {
    const tone: Record<Status, [string, string]> = {
        pending: ["var(--warning-subtle)", "var(--warning-text)"],
        approved: ["var(--accent-subtle)", "var(--accent-text)"],
        publishing: ["var(--accent-subtle)", "var(--accent-text)"],
        published: ["var(--success-subtle)", "var(--success-text)"],
        failed: ["var(--danger-subtle)", "var(--danger-text)"],
        skipped: ["var(--surface-raised)", "var(--text-tertiary)"],
        expired: ["var(--surface-raised)", "var(--text-tertiary)"],
    };
    const [bg, fg] = tone[status];
    return <span style={{ fontSize: 11, color: fg, background: bg, padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>{status}</span>;
}

function FacebookLink({ id }: { id: string | null }) {
    if (!id) return null;
    if (id.startsWith("dry-run")) return <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>dry run (not on Facebook)</span>;
    return <a href={`https://www.facebook.com/${id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--accent-text)", textDecoration: "underline" }}>View on Facebook ↗</a>;
}

// ── Open post card ───────────────────────────────────────────────────────────

function OpenPost({ post, highlighted, onDone }: { post: Post; highlighted: boolean; onDone: (msg: string) => void }) {
    const [text, setText] = useState(post.editedMessage ?? post.message);
    const [busy, setBusy] = useState<"approve" | "skip" | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const canAct = APPROVABLE.includes(post.status) || post.status === "approved";

    async function act(action: "approve" | "skip") {
        if (action === "skip" && !confirm("Skip this post? It won't be published.")) return;
        setBusy(action);
        setErr(null);
        try {
            const res = await fetch(`/api/admin/social-posts/${post._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, message: text, planHash: post.planHash }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            onDone(action === "skip" ? "Skipped."
                : data.published ? "Published to Facebook."
                : `Approved. ${data.error ?? "It will publish on the next tick."}`);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(null);
        }
    }

    return (
        <div id={post._id} style={{ background: "var(--surface)", border: `1px solid ${highlighted ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{post.label}</p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        {KIND_LABEL[post.kind]}
                        {post.status === "pending" && <> · alert {formatWhen(post.alertAt)}{post.alertedAt ? " (sent)" : ""} · gives up {formatWhen(post.expireAt)}</>}
                    </p>
                </div>
                <StatusPill status={post.status} />
            </div>

            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {post.kind === "cancellation" && post.status === "pending" && (
                    <p style={{ fontSize: 12, color: "var(--warning-text)" }}>Cancellations always wait for your OK.</p>
                )}
                {post.issues.length > 0 && (
                    <ul style={{ margin: 0, padding: "8px 12px 8px 28px", borderRadius: 8, background: "var(--warning-subtle)", color: "var(--warning-text)", fontSize: 13 }}>
                        {post.issues.map((i, n) => <li key={n}>{i.message}</li>)}
                    </ul>
                )}
                {post.error && <p style={{ fontSize: 13, color: "var(--danger)" }}>Facebook error: {post.error}</p>}
                {post.note && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{post.note}</p>}

                <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!canAct} rows={Math.min(16, text.split("\n").length + 1)}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 13, lineHeight: 1.5, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    Fixing the plan in Plan Lesson updates this text on the next tick, and a fixed plan posts on its own. Editing the text here only changes this post.
                </p>

                {err && <p style={{ fontSize: 13, color: "var(--danger)" }}>{err}</p>}
                {canAct && (
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <ActionButton label={busy === "skip" ? "Skipping…" : "Skip"} variant="ghost" loading={busy === "skip"} onClick={() => act("skip")} />
                        {post.status !== "approved" && (
                            <ActionButton label={busy === "approve" ? "Publishing…" : "Approve & publish"} variant="success" loading={busy === "approve"} onClick={() => act("approve")} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

function SocialPostsInner() {
    const highlightId = useSearchParams().get("id");
    const [open, setOpen] = useState<Post[] | null>(null);
    const [recent, setRecent] = useState<Post[]>([]);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);

    const load = useCallback(() => {
        fetch("/api/admin/social-posts")
            .then((r) => r.json())
            .then((data) => {
                if (data.error) throw new Error(data.error);
                setLoadErr(null);
                setOpen(data.open);
                setRecent(data.recent);
            })
            .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : String(e)));
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (highlightId && open) document.getElementById(highlightId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [highlightId, open]);

    return (
        <div className="page-pad" style={{ maxWidth: 760 }}>
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Social Posts</h1>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                        Facebook posts drafted from your schedule. Complete plans post on their own 6 hours before class;
                        anything incomplete, and every cancellation, waits here for you. You get a phone alert 3 hours before
                        class, and it&apos;s dropped 1 hour before if you haven&apos;t answered.
                    </p>
                </div>
                <ActionButton label="Refresh" variant="ghost" onClick={load} />
            </div>

            {flash && <p style={{ fontSize: 13, color: "var(--success-text)", background: "var(--success-subtle)", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{flash}</p>}
            {loadErr && <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{loadErr}</p>}

            {open && open.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary)", fontSize: 14 }}>Nothing waiting on you.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {open?.map((p) => (
                    // Keyed on the text too, so a refreshed plan resets the editor
                    <OpenPost key={`${p._id}:${p.planHash}:${p.editedMessage ?? ""}`} post={p} highlighted={p._id === highlightId} onDone={(msg) => { setFlash(msg); load(); }} />
                ))}
            </div>

            {recent.length > 0 && (
                <div style={{ marginTop: 28 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Recent</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {recent.map((p) => (
                            <details key={p._id} style={{ padding: "10px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)" }}>
                                <summary style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", listStyle: "none" }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{p.label}</p>
                                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                            {KIND_LABEL[p.kind]} · {formatWhen(p.publishedAt ?? p.updatedAt)}{p.note ? ` · ${p.note}` : ""}
                                        </p>
                                    </div>
                                    <FacebookLink id={p.fbPostId} />
                                    <StatusPill status={p.status} />
                                </summary>
                                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text-secondary)", marginTop: 10, fontFamily: "inherit" }}>{p.editedMessage ?? p.message}</pre>
                            </details>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SocialPostsPage() {
    return (
        <Suspense>
            <SocialPostsInner />
        </Suspense>
    );
}
