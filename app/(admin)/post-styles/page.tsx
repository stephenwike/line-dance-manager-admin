"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton, Badge } from "@/components/ui";
import { Field, inputStyle } from "@/components/form";

// ── Types ────────────────────────────────────────────────────────────────────

interface Style { theme: string; photo: string; headline: string; hook: string; cta: string; hashtags: string[] }
interface ClassStyle {
    eventTypeId: string; title: string; venue: string | null; level: string | null;
    saved: Partial<Style> | null; suggested: Partial<Style> | null; effective: Style;
}
interface Data {
    themes: { id: string; label: string; colors: string[] }[];
    photos: { id: string; label: string }[];
    eventTypes: ClassStyle[];
    posterUrl: string | null;
}
interface Preview { image: string; caption: string; samplePlan: boolean }

// ── Editor ───────────────────────────────────────────────────────────────────

function StyleEditor({ cls, data, onSaved }: { cls: ClassStyle; data: Data; onSaved: (msg: string) => void }) {
    const [style, setStyle] = useState<Style>(cls.effective);
    const [hashtagText, setHashtagText] = useState(cls.effective.hashtags.join(" "));
    const [preview, setPreview] = useState<Preview | null>(null);
    const [busy, setBusy] = useState<"preview" | "save" | "reset" | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const current = (): Style => ({ ...style, hashtags: hashtagText.split(/[\s,]+/).filter(Boolean) });
    const set = <K extends keyof Style>(key: K, value: Style[K]) => setStyle((s) => ({ ...s, [key]: value }));

    async function run(kind: "preview" | "save" | "reset") {
        if (kind === "reset" && !confirm("Go back to the suggested style for this class?")) return;
        setBusy(kind);
        setErr(null);
        try {
            const res = kind === "preview"
                ? await fetch("/api/admin/post-styles/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventTypeId: cls.eventTypeId, style: current() }) })
                : await fetch(`/api/admin/post-styles/${cls.eventTypeId}`, kind === "save"
                    ? { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current()) }
                    : { method: "DELETE" });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? "Failed");
            if (kind === "preview") setPreview(body);
            else onSaved(kind === "save" ? `Saved the ${cls.title} style. Open posts redraw at the next check.` : `${cls.title} is back to its suggested style.`);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(null);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <Field label="Theme">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {data.themes.map((t) => (
                        <button key={t.id} type="button" onClick={() => set("theme", t.id)}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, cursor: "pointer", background: "var(--surface-raised)", border: `2px solid ${style.theme === t.id ? "var(--accent)" : "var(--border)"}`, fontSize: 12, color: "var(--text-primary)" }}>
                            <span style={{ display: "flex" }}>
                                {t.colors.map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c, marginRight: -4, border: "1px solid rgba(0,0,0,0.2)" }} />)}
                            </span>
                            <span style={{ marginLeft: 6 }}>{t.label}</span>
                        </button>
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

            <div className="grid-2" style={{ gap: 10 }}>
                <Field label="Headline on the image">
                    <input value={style.headline} onChange={(e) => set("headline", e.target.value)} placeholder="{When}!" style={inputStyle} />
                </Field>
                <Field label="Call to action on the image">
                    <input value={style.cta} onChange={(e) => set("cta", e.target.value)} placeholder="Come dance with us!" style={inputStyle} />
                </Field>
            </div>
            <Field label="First line of the caption">
                <input value={style.hook} onChange={(e) => set("hook", e.target.value)} placeholder="💃 Line dancing {when} at {venue}!" style={inputStyle} />
            </Field>
            <Field label="Extra hashtags">
                <input value={hashtagText} onChange={(e) => setHashtagText(e.target.value)} placeholder="#CountryDance" style={inputStyle} />
            </Field>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {"{When}"} / {"{when}"} become Tonight / tonight (or Today for daytime classes), and {"{venue}"} the venue&apos;s name.
            </p>

            {err && <p style={{ fontSize: 13, color: "var(--danger)" }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ActionButton label={busy === "preview" ? "Drawing…" : "Preview"} variant="ghost" loading={busy === "preview"} onClick={() => run("preview")} />
                <ActionButton label={busy === "save" ? "Saving…" : "Save"} variant="success" loading={busy === "save"} onClick={() => run("save")} />
                {cls.saved && <ActionButton label="Reset to suggested" variant="ghost" loading={busy === "reset"} onClick={() => run("reset")} />}
            </div>

            {preview && (
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", padding: 12, borderRadius: 10, background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.image} alt="Preview" style={{ width: 280, height: "auto", borderRadius: 8 }} />
                    <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {preview.samplePlan && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>The next class has no plan yet, so this uses sample dances.</p>}
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text-primary)", margin: 0, fontFamily: "inherit" }}>{preview.caption}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PostStylesPage() {
    const [data, setData] = useState<Data | null>(null);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
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

    const themeLabel = (id: string) => data?.themes.find((t) => t.id === id)?.label ?? id;
    const photoLabel = (id: string) => data?.photos.find((p) => p.id === id)?.label ?? id;

    return (
        <div className="page-pad" style={{ maxWidth: 820 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Post Styles</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    How each class&apos;s Facebook posts look: colors, photo, the headline and call to action on the image, and the
                    caption&apos;s first line and hashtags. Each class starts from a suggested style; saving overrides it.
                </p>
            </div>

            {flash && <p style={{ fontSize: 13, color: "var(--success-text)", background: "var(--success-subtle)", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{flash}</p>}
            {loadErr && <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{loadErr}</p>}
            {!data && !loadErr && <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data?.eventTypes.map((cls) => (
                    <div key={cls.eventTypeId} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
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
                            <StyleEditor key={JSON.stringify(cls.effective)} cls={cls} data={data}
                                onSaved={(msg) => { setFlash(msg); setEditing(null); load(); }} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
