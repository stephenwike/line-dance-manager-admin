"use client";

import { useCallback, useEffect, useState } from "react";
import { Kaushan_Script } from "next/font/google";
import { ActionButton, Badge } from "@/components/ui";
import { Field, inputStyle } from "@/components/form";

// The brush font the post images use, so theme samples look like the real thing.
const brush = Kaushan_Script({ weight: "400", subsets: ["latin"] });

// ── Types ────────────────────────────────────────────────────────────────────

interface Style { theme: string; photo: string; headline: string; hook: string; cta: string; hashtags: string[]; matchClass?: boolean }
interface ClassStyle {
    eventTypeId: string; title: string; venue: string | null; level: string | null;
    saved: Partial<Style> | null; suggested: Partial<Style> | null; effective: Style;
}
interface AdTypeStyle { saved: Partial<Style> | null; defaults: Style; effective: Style }
interface Palette { ink: string; deep: string; brushFrom: string; brushTo: string; swoosh: string; highlight: string; accent: string }
interface Theme { id: string; label: string; colors: string[]; palette: Palette }
interface Data {
    themes: Theme[];
    photos: { id: string; label: string }[];
    eventTypes: ClassStyle[];
    adTypes: { cancellation: AdTypeStyle; weekly_outline: AdTypeStyle };
    posterUrl: string | null;
}
interface Preview { image: string; caption: string; note: string | null }
type Kind = "lesson" | "cancellation" | "weekly_outline";

const TABS: { kind: Kind; label: string; blurb: string }[] = [
    { kind: "lesson", label: "Lesson posts", blurb: "Posted before each class with the night's lesson plan. Each class has its own style." },
    { kind: "cancellation", label: "Cancellations", blurb: "Posted when a class is cancelled (always after your OK)." },
    { kind: "weekly_outline", label: "Weekly schedule", blurb: "Posted Monday mornings with the week's classes." },
];

// ── Theme sample ─────────────────────────────────────────────────────────────

/** A small card in a theme's colors over the chosen photo: roughly how the post image will look. */
function ThemeSample({ theme, photoUrl, selected, onClick }: { theme: Theme; photoUrl: string | null; selected: boolean; onClick: () => void }) {
    const p = theme.palette;
    return (
        <button type="button" onClick={onClick} title={theme.label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 0, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{
                position: "relative", width: 128, height: 160, borderRadius: 10, overflow: "hidden",
                background: `linear-gradient(180deg, ${p.ink} 0%, ${p.ink} 60%, ${p.deep} 100%)`,
                outline: `3px solid ${selected ? "var(--accent)" : "transparent"}`, outlineOffset: 2,
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
            }}>
                {photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 88, objectFit: "cover" }} />
                )}
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 88, background: `linear-gradient(180deg, ${p.ink}55 0%, ${p.ink}33 40%, ${p.ink} 100%)` }} />
                <div style={{ position: "absolute", left: 8, right: 8, top: 56, display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", letterSpacing: 0.3 }}>
                        MON <span style={{ color: p.highlight }}>OCT 26</span> · 5:00 PM
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 900, fontStyle: "italic", color: "#fff", lineHeight: 1.05, textTransform: "uppercase" }}>Charlie&apos;s</span>
                    <span className={brush.className} style={{
                        fontSize: 22, lineHeight: 1.1, transform: "rotate(-5deg)", transformOrigin: "left", width: "fit-content",
                        backgroundImage: `linear-gradient(90deg, ${p.brushFrom}, ${p.brushTo})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                    }}>Tonight!</span>
                    <svg width="64" height="8" viewBox="0 0 64 8" style={{ marginTop: -4 }}>
                        <path d="M2 6 C 20 1, 44 1, 62 3" stroke={p.swoosh} strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    </svg>
                    <div style={{ marginTop: 4, padding: "3px 5px", borderRadius: 4, border: `1px solid ${p.accent}`, background: `${p.ink}cc`, display: "flex", gap: 4, fontSize: 7, fontWeight: 700 }}>
                        <span style={{ color: p.highlight }}>6:00 PM</span>
                        <span style={{ color: "#fff" }}>Copperhead Road</span>
                    </div>
                </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: selected ? 700 : 500, color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>{theme.label}</span>
        </button>
    );
}

// ── Editor ───────────────────────────────────────────────────────────────────

/** Theme, photo and wording for one style, with a live preview drawn by the poster. */
function StyleEditor({ kind, saveKey, initial, hasSaved, data, previewClass, onSaved }: {
    kind: Kind; saveKey: string; initial: Style; hasSaved: boolean; data: Data;
    /** The class whose next date the preview uses (lesson posts and cancellations). */
    previewClass: string | null;
    onSaved: (msg: string) => void;
}) {
    const [style, setStyle] = useState<Style>(initial);
    const [hashtagText, setHashtagText] = useState(initial.hashtags.join(" "));
    const [preview, setPreview] = useState<Preview | null>(null);
    const [busy, setBusy] = useState<"preview" | "save" | "reset" | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const current = (): Style => ({ ...style, hashtags: hashtagText.split(/[\s,]+/).filter(Boolean) });
    const set = <K extends keyof Style>(key: K, value: Style[K]) => setStyle((s) => ({ ...s, [key]: value }));
    // A cancellation can borrow the cancelled class's look instead of its own theme and photo.
    const ownLook = kind !== "cancellation" || style.matchClass === false;

    async function run(action: "preview" | "save" | "reset") {
        if (action === "reset" && !confirm("Go back to the original style?")) return;
        setBusy(action);
        setErr(null);
        try {
            const res = action === "preview"
                ? await fetch("/api/admin/post-styles/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, eventTypeId: previewClass, style: current() }) })
                : await fetch(`/api/admin/post-styles/${encodeURIComponent(saveKey)}`, action === "save"
                    ? { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current()) }
                    : { method: "DELETE" });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? "Failed");
            if (action === "preview") setPreview(body);
            else onSaved(action === "save" ? "Saved. Posts that are still open redraw at the next check." : "Back to the original style.");
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(null);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {kind === "cancellation" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={style.matchClass !== false} onChange={(e) => set("matchClass", e.target.checked)} />
                    Use the cancelled class&apos;s colors and photo
                </label>
            )}

            {ownLook && (
                <>
                    <Field label="Theme">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                            {data.themes.map((t) => (
                                <ThemeSample key={t.id} theme={t} selected={style.theme === t.id} onClick={() => set("theme", t.id)}
                                    photoUrl={data.posterUrl ? `${data.posterUrl}/api/photos/${style.photo}` : null} />
                            ))}
                        </div>
                    </Field>
                    <Field label="Photo">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {data.photos.map((p) => (
                                <button key={p.id} type="button" onClick={() => set("photo", p.id)} title={p.label}
                                    style={{ padding: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "none", border: `3px solid ${style.photo === p.id ? "var(--accent)" : "transparent"}` }}>
                                    {data.posterUrl
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={`${data.posterUrl}/api/photos/${p.id}`} alt={p.label} width={120} height={80} style={{ display: "block", width: 120, height: 80, objectFit: "cover" }} />
                                        : <span style={{ display: "block", padding: 8, fontSize: 12 }}>{p.label}</span>}
                                </button>
                            ))}
                        </div>
                    </Field>
                </>
            )}

            <div className="grid-2" style={{ gap: 10 }}>
                {kind !== "cancellation" && (
                    <Field label="Headline on the image">
                        <input value={style.headline} onChange={(e) => set("headline", e.target.value)} style={inputStyle} />
                    </Field>
                )}
                <Field label="Call to action on the image">
                    <input value={style.cta} onChange={(e) => set("cta", e.target.value)} style={inputStyle} />
                </Field>
            </div>
            <Field label="First line of the caption">
                <input value={style.hook} onChange={(e) => set("hook", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Extra hashtags">
                <input value={hashtagText} onChange={(e) => setHashtagText(e.target.value)} placeholder="#LineDance" style={inputStyle} />
            </Field>
            {kind !== "weekly_outline" && (
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {"{When}"} / {"{when}"} become Tonight / tonight (Today for daytime classes), {"{venue}"} the venue and {"{class}"} the class name.
                </p>
            )}

            {err && <p style={{ fontSize: 13, color: "var(--danger)" }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ActionButton label={busy === "preview" ? "Drawing…" : "Preview"} variant="ghost" loading={busy === "preview"} onClick={() => run("preview")} />
                <ActionButton label={busy === "save" ? "Saving…" : "Save"} variant="success" loading={busy === "save"} onClick={() => run("save")} />
                {hasSaved && <ActionButton label="Reset to original" variant="ghost" loading={busy === "reset"} onClick={() => run("reset")} />}
            </div>

            {preview && (
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", padding: 12, borderRadius: 10, background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.image} alt="Preview" style={{ width: 280, height: "auto", borderRadius: 8 }} />
                    <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {preview.note && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{preview.note}</p>}
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text-primary)", margin: 0, fontFamily: "inherit" }}>{preview.caption}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" };

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdsPage() {
    const [data, setData] = useState<Data | null>(null);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [tab, setTab] = useState<Kind>("lesson");
    const [editing, setEditing] = useState<string | null>(null);
    const [previewClass, setPreviewClass] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);

    const load = useCallback(() => {
        fetch("/api/admin/post-styles")
            .then((r) => r.json())
            .then((d) => {
                if (d.error) throw new Error(d.error);
                setLoadErr(null);
                setData(d);
            })
            .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : String(e)));
    }, []);
    useEffect(() => { load(); }, [load]);

    const saved = (msg: string) => { setFlash(msg); setEditing(null); load(); };
    const themeLabel = (id: string) => data?.themes.find((t) => t.id === id)?.label ?? id;
    const photoLabel = (id: string) => data?.photos.find((p) => p.id === id)?.label ?? id;
    const active = TABS.find((t) => t.kind === tab)!;

    return (
        <div className="page-pad" style={{ maxWidth: 820 }}>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Ads</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Preview each kind of Facebook post and change how it looks: colors, photo, the words on the image and the
                    caption&apos;s first line and hashtags.
                </p>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 12, borderBottom: "1px solid var(--border)" }}>
                {TABS.map((t) => (
                    <button key={t.kind} type="button" onClick={() => { setTab(t.kind); setEditing(null); }}
                        style={{ padding: "8px 14px", fontSize: 13, fontWeight: tab === t.kind ? 700 : 500, cursor: "pointer", background: "none", border: "none", borderBottom: `2px solid ${tab === t.kind ? "var(--accent)" : "transparent"}`, color: tab === t.kind ? "var(--text-primary)" : "var(--text-secondary)", marginBottom: -1 }}>
                        {t.label}
                    </button>
                ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>{active.blurb}</p>

            {flash && <p style={{ fontSize: 13, color: "var(--success-text)", background: "var(--success-subtle)", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{flash}</p>}
            {loadErr && <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{loadErr}</p>}
            {!data && !loadErr && <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>}

            {data && tab === "lesson" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {data.eventTypes.map((cls) => (
                        <div key={cls.eventTypeId} style={card}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                {data.posterUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={`${data.posterUrl}/api/photos/${cls.effective.photo}`} alt="" width={72} height={48} style={{ width: 72, height: 48, objectFit: "cover", borderRadius: 6 }} />
                                )}
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{cls.title}</p>
                                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                                        {[cls.venue, cls.level].filter(Boolean).join(" · ")} · {themeLabel(cls.effective.theme)} · {photoLabel(cls.effective.photo)} · &ldquo;{cls.effective.headline}&rdquo;
                                    </p>
                                </div>
                                <Badge label={cls.saved ? "Custom" : cls.suggested ? "Suggested" : "Default"} color={cls.saved ? "green" : "blue"} />
                                <ActionButton label={editing === cls.eventTypeId ? "Close" : "Edit"} variant="ghost" onClick={() => setEditing(editing === cls.eventTypeId ? null : cls.eventTypeId)} />
                            </div>
                            {editing === cls.eventTypeId && (
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                    <StyleEditor key={JSON.stringify(cls.effective)} kind="lesson" saveKey={cls.eventTypeId} initial={cls.effective}
                                        hasSaved={!!cls.saved} data={data} previewClass={cls.eventTypeId} onSaved={saved} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {data && tab !== "lesson" && (() => {
                const t = data.adTypes[tab];
                return (
                    <div style={card}>
                        {tab === "cancellation" && (
                            <div style={{ marginBottom: 14 }}>
                                <Field label="Preview with">
                                    <select value={previewClass ?? ""} onChange={(e) => setPreviewClass(e.target.value || null)} style={inputStyle}>
                                        <option value="">The next class on the schedule</option>
                                        {data.eventTypes.map((c) => <option key={c.eventTypeId} value={c.eventTypeId}>{c.title}</option>)}
                                    </select>
                                </Field>
                            </div>
                        )}
                        <StyleEditor key={`${tab}:${JSON.stringify(t.effective)}`} kind={tab} saveKey={`type:${tab}`} initial={t.effective}
                            hasSaved={!!t.saved} data={data} previewClass={previewClass} onSaved={saved} />
                    </div>
                );
            })()}
        </div>
    );
}
