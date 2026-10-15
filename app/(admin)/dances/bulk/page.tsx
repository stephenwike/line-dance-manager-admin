"use client";

import { useState, useRef, useEffect } from "react";

interface Choreographer {
    id: string;
    name: string;
    copperknobUrl: string | null;
}

interface CkSuggestion {
    name: string;
    url: string;
}

interface DanceListItem {
    url: string;
    name: string;
}

type ImportStatus = "created" | "exists" | "url_added" | "error";

interface ImportResult {
    url: string;
    name: string;
    status: ImportStatus;
    message?: string;
}

type PageState = "idle" | "fetching" | "ready" | "importing" | "done";

interface LogEntry {
    id: string;
    name: string;
    copperknobUrl: string | null;
    lastImportedAt: string;
    danceCount: number;
}

interface BackfillItem {
    id: string;
    danceName: string;
    stepsheet: string;
}

type BackfillStatus = "updated" | "skipped" | "error";

interface BackfillResult {
    danceName: string;
    status: BackfillStatus;
    track?: string;
    message?: string;
}

type BackfillState = "idle" | "loading" | "running" | "done";

const STATUS_ICON: Record<ImportStatus, string> = {
    created: "✓",
    exists: "–",
    url_added: "⊕",
    error: "✗",
};

const STATUS_COLOR: Record<ImportStatus, string> = {
    created: "#16a34a",
    exists: "var(--text-muted)",
    url_added: "#d97706",
    error: "#dc2626",
};

const STATUS_LABEL: Record<ImportStatus, string> = {
    created: "created",
    exists: "already exists",
    url_added: "alt URL added",
    error: "error",
};

function randomDelay() {
    return 2000 + Math.random() * 3000;
}

export default function BulkDancesPage() {
    const [pageState, setPageState] = useState<PageState>("idle");

    // Choreographer selection
    const [choreoQuery, setChoreoQuery] = useState("");
    const [choreoResults, setChoreoResults] = useState<Choreographer[]>([]);
    const [selectedChoreo, setSelectedChoreo] = useState<Choreographer | null>(null);

    // CopperKnob URL
    const [ckUrl, setCkUrl] = useState("");
    const [ckSearching, setCkSearching] = useState(false);
    const [ckSuggestions, setCkSuggestions] = useState<CkSuggestion[]>([]);
    const [ckSearchError, setCkSearchError] = useState("");
    const [showManualUrl, setShowManualUrl] = useState(false);

    const [fetchError, setFetchError] = useState("");
    const [fetchDebug, setFetchDebug] = useState<{ rawLinksFound: number; translationsSkipped: number; pagesVisited: number } | null>(null);
    const [preCheckTotal, setPreCheckTotal] = useState<number | null>(null);
    const [preCheckExisting, setPreCheckExisting] = useState<number | null>(null);

    const [importLog, setImportLog] = useState<LogEntry[]>([]);

    // Backfill state
    const [backfillList, setBackfillList] = useState<BackfillItem[]>([]);
    const [backfillState, setBackfillState] = useState<BackfillState>("idle");
    const [backfillIndex, setBackfillIndex] = useState(0);
    const [backfillResults, setBackfillResults] = useState<BackfillResult[]>([]);
    const backfillCancelRef = useRef(false);

    useEffect(() => {
        fetch("/api/admin/choreographers/import-log")
            .then(r => r.ok ? r.json() : [])
            .then(setImportLog)
            .catch(() => {});

        fetch("/api/admin/dances/backfill-tracks")
            .then(r => r.ok ? r.json() : { dances: [] })
            .then(data => setBackfillList(data.dances ?? []))
            .catch(() => {});
    }, []);

    // Dance list + import
    const [danceList, setDanceList] = useState<DanceListItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [results, setResults] = useState<ImportResult[]>([]);
    const cancelRef = useRef(false);

    // ── Choreographer typeahead ───────────────────────────────────────────────

    async function searchChoreographers(q: string) {
        setChoreoQuery(q);
        setSelectedChoreo(null);
        setCkUrl("");
        setCkSuggestions([]);
        setShowManualUrl(false);
        if (!q.trim()) { setChoreoResults([]); return; }
        try {
            const res = await fetch(`/api/admin/choreographers?q=${encodeURIComponent(q)}`);
            setChoreoResults(await res.json());
        } catch {
            setChoreoResults([]);
        }
    }

    async function selectChoreographer(c: Choreographer) {
        setSelectedChoreo(c);
        setChoreoQuery(c.name);
        setChoreoResults([]);
        setCkSuggestions([]);
        setCkSearchError("");
        setShowManualUrl(false);

        if (c.copperknobUrl) {
            // Already known — auto-fill
            setCkUrl(c.copperknobUrl);
        } else {
            // Search CopperKnob for suggestions
            setCkUrl("");
            setCkSearching(true);
            try {
                const res = await fetch(`/api/admin/search-choreographer-ck?q=${encodeURIComponent(c.name)}`);
                const data: CkSuggestion[] = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setCkSuggestions(data);
                } else {
                    setCkSearchError("No results found on CopperKnob.");
                    setShowManualUrl(true);
                }
            } catch {
                setCkSearchError("Could not reach CopperKnob.");
                setShowManualUrl(true);
            } finally {
                setCkSearching(false);
            }
        }
    }

    function pickCkSuggestion(s: CkSuggestion) {
        setCkUrl(s.url);
        setCkSuggestions([]);
        setShowManualUrl(false);
    }

    // ── Fetch dance list ──────────────────────────────────────────────────────

    async function fetchList() {
        setFetchError("");
        setPageState("fetching");
        try {
            const res = await fetch("/api/admin/scrape-choreographer-list", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: ckUrl }),
            });
            const data = await res.json();
            if (!res.ok) { setFetchError(data.error ?? "Failed to fetch"); setFetchDebug(data.debug ?? null); setPageState("idle"); return; }
            const allDances: DanceListItem[] = data.dances;
            setFetchDebug(data.debug ?? null);

            // Pre-check which URLs already exist in the database
            setPreCheckTotal(allDances.length);
            try {
                const checkRes = await fetch("/api/admin/dances/bulk-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ urls: allDances.map((d: DanceListItem) => d.url) }),
                });
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    const existingSet = new Set<string>(checkData.existing ?? []);
                    setPreCheckExisting(existingSet.size);
                    setDanceList(allDances.filter(d => !existingSet.has(d.url)));
                } else {
                    setDanceList(allDances);
                }
            } catch {
                setDanceList(allDances);
            }

            setPageState("ready");

            // Persist the URL back to the choreographer record if it's new
            if (selectedChoreo && selectedChoreo.copperknobUrl !== ckUrl) {
                fetch(`/api/admin/choreographers/${selectedChoreo.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ copperknobUrl: ckUrl }),
                }).catch(() => {});
                setSelectedChoreo({ ...selectedChoreo, copperknobUrl: ckUrl });
            }
        } catch {
            setFetchError("Network error — could not reach CopperKnob.");
            setPageState("idle");
        }
    }

    // ── Import ────────────────────────────────────────────────────────────────

    async function startImport() {
        cancelRef.current = false;
        setResults([]);
        setCurrentIndex(0);
        setPageState("importing");

        for (let i = 0; i < danceList.length; i++) {
            if (cancelRef.current) break;
            setCurrentIndex(i);

            const dance = danceList[i];
            let result: ImportResult;

            try {
                const res = await fetch("/api/admin/dances/bulk-import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stepsheetUrl: dance.url,
                        choreographerOverride: selectedChoreo?.name ?? null,
                    }),
                });
                const data = await res.json();
                result = {
                    url: dance.url,
                    name: data.danceName ?? dance.name,
                    status: data.status as ImportStatus,
                    message: data.message,
                };
            } catch {
                result = { url: dance.url, name: dance.name, status: "error", message: "Network error" };
            }

            setResults(prev => [...prev, result]);

            if (i < danceList.length - 1 && !cancelRef.current) {
                await new Promise(r => setTimeout(r, randomDelay()));
            }
        }

        setPageState("done");

        // Stamp lastImportedAt on the choreographer record and refresh the log
        if (selectedChoreo) {
            const now = new Date().toISOString();
            fetch(`/api/admin/choreographers/${selectedChoreo.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lastImportedAt: now }),
            }).then(() =>
                fetch("/api/admin/choreographers/import-log")
                    .then(r => r.ok ? r.json() : [])
                    .then(setImportLog)
                    .catch(() => {})
            ).catch(() => {});
        }
    }

    function cancel() { cancelRef.current = true; }

    function reset() {
        setPageState("idle");
        setDanceList([]);
        setResults([]);
        setCurrentIndex(0);
        setFetchError("");
        setFetchDebug(null);
        setPreCheckTotal(null);
        setPreCheckExisting(null);
        cancelRef.current = false;
    }

    // ── Backfill ──────────────────────────────────────────────────────────────

    async function startBackfill() {
        backfillCancelRef.current = false;
        setBackfillResults([]);
        setBackfillIndex(0);
        setBackfillState("running");

        for (let i = 0; i < backfillList.length; i++) {
            if (backfillCancelRef.current) break;
            setBackfillIndex(i);

            const item = backfillList[i];
            if (!item.stepsheet) {
                setBackfillResults(prev => [...prev, { danceName: item.danceName, status: "skipped", message: "No stepsheet URL" }]);
                continue;
            }

            let result: BackfillResult;
            try {
                const res = await fetch("/api/admin/dances/backfill-tracks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ danceId: item.id, stepsheetUrl: item.stepsheet }),
                });
                const data = await res.json();
                result = { danceName: item.danceName, status: data.status as BackfillStatus, track: data.track, message: data.message };
            } catch {
                result = { danceName: item.danceName, status: "error", message: "Network error" };
            }

            setBackfillResults(prev => [...prev, result]);

            if (i < backfillList.length - 1 && !backfillCancelRef.current) {
                await new Promise(r => setTimeout(r, randomDelay()));
            }
        }

        setBackfillState("done");
        // Refresh the count
        fetch("/api/admin/dances/backfill-tracks")
            .then(r => r.ok ? r.json() : { dances: [] })
            .then(data => setBackfillList(data.dances ?? []))
            .catch(() => {});
    }

    function cancelBackfill() { backfillCancelRef.current = true; }

    function resetBackfill() {
        setBackfillState("idle");
        setBackfillResults([]);
        setBackfillIndex(0);
        backfillCancelRef.current = false;
    }

    // ── Derived ───────────────────────────────────────────────────────────────

    const counts = results.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, {} as Record<ImportStatus, number>);

    const progressPct = danceList.length > 0
        ? Math.round(((pageState === "done" ? results.length : currentIndex) / danceList.length) * 100)
        : 0;

    const readyToFetch = !!ckUrl.trim() && !ckSearching && ckSuggestions.length === 0;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: 32, maxWidth: 760 }}>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
                    Bulk Dance Import
                </h1>
                <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
                    Import all dances for a choreographer from their CopperKnob page.
                </p>
            </div>

            {/* ── Setup form ── */}
            {(pageState === "idle" || pageState === "fetching") && (
                <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Choreographer typeahead */}
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 8 }}>
                            Choreographer
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type="text"
                                value={choreoQuery}
                                onChange={e => searchChoreographers(e.target.value)}
                                placeholder="Search choreographers…"
                                disabled={pageState === "fetching"}
                                style={{
                                    width: "100%", padding: "9px 12px", borderRadius: 8, boxSizing: "border-box",
                                    border: selectedChoreo ? "1px solid var(--accent)" : "1px solid var(--border)",
                                    background: "var(--surface)", color: "var(--text)", fontSize: 14, outline: "none",
                                }}
                            />
                            {choreoResults.length > 0 && (
                                <div style={{
                                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10,
                                    background: "var(--surface)", border: "1px solid var(--border)",
                                    borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                }}>
                                    {choreoResults.map(c => (
                                        <button key={c.id} onClick={() => selectChoreographer(c)} style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            width: "100%", textAlign: "left",
                                            padding: "9px 14px", background: "none", border: "none",
                                            borderTop: "1px solid var(--border)",
                                            fontSize: 14, color: "var(--text)", cursor: "pointer",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-raised)")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                                            <span>{c.name}</span>
                                            {c.copperknobUrl && (
                                                <span style={{ fontSize: 11, color: "var(--accent)" }}>linked</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CopperKnob URL section */}
                    {selectedChoreo && (
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                CopperKnob Profile
                                {selectedChoreo.copperknobUrl && ckUrl === selectedChoreo.copperknobUrl && (
                                    <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--accent)", fontSize: 11 }}>auto-filled</span>
                                )}
                                {ckSearching && (
                                    <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--text-muted)", fontSize: 11 }}>searching CopperKnob…</span>
                                )}
                            </label>

                            {/* Suggestions from CopperKnob search */}
                            {ckSuggestions.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px" }}>
                                        Which one is <strong style={{ color: "var(--text)" }}>{selectedChoreo.name}</strong>?
                                    </p>
                                    <div style={{ borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                                        {ckSuggestions.map((s, i) => (
                                            <button key={s.url} onClick={() => pickCkSuggestion(s)} style={{
                                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                                width: "100%", textAlign: "left",
                                                padding: "10px 14px", background: "none", border: "none",
                                                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                                                fontSize: 14, color: "var(--text)", cursor: "pointer", gap: 12,
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-raised)")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                                                <span style={{ fontWeight: 500 }}>{s.name}</span>
                                                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>Select →</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => { setCkSuggestions([]); setShowManualUrl(true); }}
                                        style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                                        Not listed — enter URL manually
                                    </button>
                                </div>
                            )}

                            {/* Auto-filled or manual URL field */}
                            {(ckUrl || showManualUrl || ckSearchError) && ckSuggestions.length === 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {ckSearchError && (
                                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{ckSearchError}</p>
                                    )}
                                    <input
                                        type="url"
                                        value={ckUrl}
                                        onChange={e => setCkUrl(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && readyToFetch && pageState !== "fetching" && fetchList()}
                                        placeholder="https://www.copperknob.co.uk/choreographer/…"
                                        disabled={pageState === "fetching"}
                                        style={{
                                            width: "100%", padding: "9px 12px", borderRadius: 8, boxSizing: "border-box",
                                            border: "1px solid var(--border)", background: "var(--surface)",
                                            color: "var(--text)", fontSize: 14, outline: "none",
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {fetchError && (
                        <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{fetchError}</p>
                    )}
                    {fetchDebug && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontFamily: "monospace" }}>
                            debug: {fetchDebug.rawLinksFound} raw links · {fetchDebug.translationsSkipped} translations skipped · {fetchDebug.pagesVisited} page(s) visited
                        </p>
                    )}

                    <button
                        onClick={fetchList}
                        disabled={!readyToFetch || pageState === "fetching"}
                        style={{
                            alignSelf: "flex-start", padding: "9px 20px", borderRadius: 8,
                            border: "none", background: "var(--accent)", color: "#fff",
                            fontSize: 14, fontWeight: 600,
                            cursor: (!readyToFetch || pageState === "fetching") ? "not-allowed" : "pointer",
                            opacity: (!readyToFetch || pageState === "fetching") ? 0.5 : 1,
                        }}>
                        {pageState === "fetching" ? "Fetching…" : "Fetch Dance List"}
                    </button>
                </div>
            )}

            {/* ── Import log ── */}
            {pageState === "idle" && importLog.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
                        Previously Imported
                    </p>
                    <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                        {importLog.map((entry, i) => (
                            <div key={entry.id} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "10px 16px", gap: 12,
                                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                            }}>
                                <div style={{ minWidth: 0 }}>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{entry.name}</span>
                                    {entry.copperknobUrl && (
                                        <a href={entry.copperknobUrl} target="_blank" rel="noopener noreferrer"
                                            style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)", textDecoration: "none" }}>↗</a>
                                    )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                        {entry.danceCount} dance{entry.danceCount !== 1 ? "s" : ""}
                                    </span>
                                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                        {new Date(entry.lastImportedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Backfill missing tracks ── */}
            {pageState === "idle" && (backfillList.length > 0 || backfillState !== "idle") && (
                <div style={{ marginTop: 24 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
                        Fix Missing Tracks
                    </p>
                    <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 20 }}>

                        {backfillState === "idle" && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                                <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>
                                    <strong>{backfillList.length}</strong> dance{backfillList.length !== 1 ? "s" : ""} missing track info
                                </p>
                                <button onClick={startBackfill} style={{
                                    padding: "7px 16px", borderRadius: 8, border: "none",
                                    background: "var(--accent)", color: "#fff",
                                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                                }}>
                                    Start Backfill
                                </button>
                            </div>
                        )}

                        {(backfillState === "running" || backfillState === "done") && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                        {backfillState === "done"
                                            ? `Done — ${backfillResults.filter(r => r.status === "updated").length} updated`
                                            : `${backfillIndex + 1} / ${backfillList.length}`}
                                    </span>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {backfillState === "running" && (
                                            <button onClick={cancelBackfill} style={{
                                                padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)",
                                                background: "none", color: "var(--text)", fontSize: 12, cursor: "pointer",
                                            }}>Cancel</button>
                                        )}
                                        {backfillState === "done" && (
                                            <button onClick={resetBackfill} style={{
                                                padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)",
                                                background: "none", color: "var(--text)", fontSize: 12, cursor: "pointer",
                                            }}>Dismiss</button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ background: "var(--border)", borderRadius: 4, height: 4, overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%", borderRadius: 4, background: "var(--accent)",
                                        width: `${backfillList.length > 0 ? Math.round((backfillResults.length / backfillList.length) * 100) : 0}%`,
                                        transition: "width 0.3s",
                                    }} />
                                </div>

                                {backfillResults.length > 0 && (
                                    <div style={{ maxHeight: 220, overflowY: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
                                        {backfillResults.map((r, i) => (
                                            <div key={i} style={{
                                                padding: "8px 14px", fontSize: 12,
                                                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                                                display: "flex", alignItems: "center", gap: 10,
                                            }}>
                                                <span style={{
                                                    color: r.status === "updated" ? "#16a34a" : r.status === "error" ? "#dc2626" : "var(--text-muted)",
                                                    fontWeight: 700, width: 12, flexShrink: 0,
                                                }}>
                                                    {r.status === "updated" ? "✓" : r.status === "error" ? "✗" : "–"}
                                                </span>
                                                <span style={{ flex: 1, color: "var(--text)" }}>{r.danceName}</span>
                                                {r.track && (
                                                    <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{r.track}</span>
                                                )}
                                                {r.message && !r.track && (
                                                    <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{r.message}</span>
                                                )}
                                            </div>
                                        ))}
                                        {backfillState === "running" && (
                                            <div style={{
                                                padding: "8px 14px", borderTop: "1px solid var(--border)",
                                                fontSize: 12, color: "var(--text-muted)",
                                                display: "flex", alignItems: "center", gap: 8,
                                            }}>
                                                <span>⟳</span>
                                                {backfillList[backfillIndex]?.danceName ?? "Loading…"}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Ready to import ── */}
            {pageState === "ready" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{
                        background: "var(--surface)", borderRadius: 12,
                        border: "1px solid var(--border)", padding: "16px 20px",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                    }}>
                        <div>
                            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>
                                {danceList.length} to import
                                {selectedChoreo ? ` for ${selectedChoreo.name}` : ""}
                            </p>
                            {preCheckTotal !== null && preCheckExisting !== null && preCheckExisting > 0 && (
                                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 2px" }}>
                                    {preCheckExisting} of {preCheckTotal} already in database — skipped
                                </p>
                            )}
                            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 2px" }}>
                                Each request is spaced 2–5 seconds apart.
                            </p>
                            {fetchDebug && (
                                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, fontFamily: "monospace" }}>
                                    {fetchDebug.rawLinksFound} raw · {fetchDebug.translationsSkipped} translations skipped · {fetchDebug.pagesVisited} page(s)
                                </p>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            <button onClick={reset} style={{
                                padding: "8px 16px", borderRadius: 8,
                                border: "1px solid var(--border)", background: "none",
                                color: "var(--text)", fontSize: 13, cursor: "pointer",
                            }}>Back</button>
                            <button onClick={startImport} style={{
                                padding: "8px 20px", borderRadius: 8, border: "none",
                                background: "var(--accent)", color: "#fff", fontSize: 13,
                                fontWeight: 600, cursor: "pointer",
                            }}>Start Import</button>
                        </div>
                    </div>

                    <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                        {danceList.map((d, i) => (
                            <div key={d.url} style={{
                                padding: "10px 16px", fontSize: 13,
                                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                            }}>
                                <span style={{ color: "var(--text)" }}>{d.name || "Untitled"}</span>
                                <a href={d.url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none" }}>↗</a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Import progress ── */}
            {(pageState === "importing" || pageState === "done") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: "20px 24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                                {pageState === "done" ? "Import complete" : `Processing ${currentIndex + 1} of ${danceList.length}…`}
                            </p>
                            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{progressPct}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{
                                height: "100%", borderRadius: 3, background: "var(--accent)",
                                width: `${progressPct}%`, transition: "width 0.3s ease",
                            }} />
                        </div>

                        {results.length > 0 && (
                            <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
                                {(["created", "exists", "url_added", "error"] as ImportStatus[]).filter(s => counts[s]).map(s => (
                                    <span key={s} style={{ fontSize: 13, color: STATUS_COLOR[s] }}>
                                        <strong>{counts[s]}</strong> {STATUS_LABEL[s]}
                                    </span>
                                ))}
                            </div>
                        )}

                        {pageState === "importing" && (
                            <button onClick={cancel} style={{
                                marginTop: 14, padding: "6px 14px", borderRadius: 8,
                                border: "1px solid var(--border)", background: "none",
                                color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
                            }}>Cancel</button>
                        )}
                        {pageState === "done" && (
                            <button onClick={reset} style={{
                                marginTop: 14, padding: "6px 14px", borderRadius: 8,
                                border: "1px solid var(--border)", background: "none",
                                color: "var(--text)", fontSize: 12, cursor: "pointer",
                            }}>Start another import</button>
                        )}
                    </div>

                    {results.length > 0 && (
                        <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                            {results.map((r, i) => (
                                <div key={r.url} style={{
                                    padding: "10px 16px", fontSize: 13,
                                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                                    display: "flex", alignItems: "center", gap: 10,
                                }}>
                                    <span style={{ color: STATUS_COLOR[r.status], fontWeight: 700, width: 14, flexShrink: 0 }}>
                                        {STATUS_ICON[r.status]}
                                    </span>
                                    <span style={{ flex: 1, color: "var(--text)" }}>{r.name || "Untitled"}</span>
                                    <span style={{ fontSize: 11, color: STATUS_COLOR[r.status], flexShrink: 0 }}>
                                        {STATUS_LABEL[r.status]}
                                    </span>
                                    {r.message && (
                                        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }} title={r.message}>ⓘ</span>
                                    )}
                                </div>
                            ))}
                            {pageState === "importing" && (
                                <div style={{
                                    padding: "10px 16px", borderTop: "1px solid var(--border)",
                                    fontSize: 13, color: "var(--text-muted)",
                                    display: "flex", alignItems: "center", gap: 8,
                                }}>
                                    <span>⟳</span>
                                    {danceList[currentIndex]?.name ?? "Loading…"}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
