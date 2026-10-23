"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionButton } from "@/components/ui";
import { PlanEditor } from "@/components/PlanEditor";

// ── Types ────────────────────────────────────────────────────────────────────

type Status = "pending" | "approved" | "publishing" | "published" | "skipped" | "expired" | "failed";
interface Post {
    _id: string; kind: "lesson" | "cancellation" | "weekly_outline" | "test"; label: string; status: Status;
    eventTypeId: string | null; eventId: string | null; date: string;
    message: string; editedMessage: string | null; issues: { check: string; message: string }[];
    planHash: string; alertAt: string; expireAt: string; alertedAt: string | null;
    fbPostId: string | null; fbPermalink?: string | null; publishedAt: string | null; error: string | null; note: string | null;
    card?: unknown;
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

function FacebookLink({ post }: { post: Post }) {
    const id = post.fbPostId;
    if (!id) return null;
    if (id.startsWith("dry-run")) return <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>dry run (not on Facebook)</span>;
    if (post.kind === "test") return <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>hidden test post</span>;
    const href = post.fbPermalink ?? `https://www.facebook.com/${id}`;
    return <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--accent-text)", textDecoration: "underline" }}>View on Facebook ↗</a>;
}

/** The image that goes out with the post, served by the poster. */
function CardPreview({ post, posterUrl, width }: { post: Post; posterUrl: string | null; width: number }) {
    if (!posterUrl || !post.card) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${posterUrl}/api/card/${post._id}?v=${post.planHash}`} alt="Post image" width={width} height={Math.round(width * 1.25)}
            style={{ width, height: "auto", aspectRatio: "4 / 5", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-raised)" }} />
    );
}

// ── Open post card ───────────────────────────────────────────────────────────

function OpenPost({ post, posterUrl, highlighted, onDone }: { post: Post; posterUrl: string | null; highlighted: boolean; onDone: (msg: string) => void }) {
    const [text, setText] = useState(post.editedMessage ?? post.message);
    const [busy, setBusy] = useState<"approve" | "skip" | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [editingPlan, setEditingPlan] = useState(false);
    const canAct = APPROVABLE.includes(post.status) || post.status === "approved";
    const canEditPlan = canAct && post.kind !== "weekly_outline" && !!post.eventTypeId && !!post.date;

    // The plan was saved: have the poster redraft this post now, then reload the list.
    async function planSaved() {
        const res = await fetch(`/api/admin/social-posts/${post._id}/refresh`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        onDone(res.ok ? "Plan saved. The post below is updated from it." : `Plan saved. ${data.error ?? "The post updates on the next tick."}`);
    }

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

                {canEditPlan && (
                    <div>
                        <ActionButton label={editingPlan ? "Close plan" : "Edit plan"} variant="ghost" onClick={() => setEditingPlan((v) => !v)} />
                    </div>
                )}
                {editingPlan && (
                    <div style={{ padding: 12, borderRadius: 10, border: "1px dashed var(--border-strong)", background: "var(--bg)" }}>
                        <PlanEditor eventId={post.eventId} eventTypeId={post.eventTypeId ?? undefined} date={post.date} onSaved={planSaved} />
                    </div>
                )}

                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <CardPreview post={post} posterUrl={posterUrl} width={260} />
                    <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!canAct} rows={Math.min(16, text.split("\n").length + 1)}
                    style={{ flex: "1 1 280px", minHeight: 325, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
                </div>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    This is what will be posted: the image with this text as its caption. Fix the plan with Edit plan and the text updates from it; once nothing is missing, it posts on its own at the next check. Editing the text here only changes this post.
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
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
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
                setPosterUrl(data.posterUrl ?? null);
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
                    <OpenPost key={`${p._id}:${p.planHash}:${p.editedMessage ?? ""}`} post={p} posterUrl={posterUrl} highlighted={p._id === highlightId} onDone={(msg) => { setFlash(msg); load(); }} />
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
                                    <FacebookLink post={p} />
                                    <StatusPill status={p.status} />
                                </summary>
                                <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                                    <CardPreview post={p} posterUrl={posterUrl} width={160} />
                                    <pre style={{ flex: "1 1 240px", whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text-secondary)", margin: 0, fontFamily: "inherit" }}>{p.editedMessage ?? p.message}</pre>
                                </div>
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
