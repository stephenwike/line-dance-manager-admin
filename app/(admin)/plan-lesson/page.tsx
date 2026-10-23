"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionButton } from "@/components/ui";
import { PlanEditor } from "@/components/PlanEditor";

function PlanLessonInner() {
    const sp = useSearchParams();
    const router = useRouter();
    const [savedEventId, setSavedEventId] = useState<string | null>(null);

    const eventTypeId = (sp.get("eventTypeId") ?? "").trim();
    const date = (sp.get("date") ?? "").trim();
    const title = sp.get("title") ?? "Event";

    if (savedEventId) {
        return (
            <div className="page-pad" style={{ maxWidth: 760 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "60px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 40 }}>✓</div>
                    <div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--success-text)" }}>Plan saved!</p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{title} · {date}</p>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Returning to dashboard…</p>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <ActionButton label="Back to Dashboard" onClick={() => router.back()} />
                        <ActionButton label="Open Event" variant="ghost" onClick={() => router.push(`/events/${savedEventId}`)} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-pad" style={{ maxWidth: 760 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Plan Lesson</h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    Start/end are overrides — only change if this occurrence differs from the schedule.
                </p>
            </div>
            <PlanEditor
                eventTypeId={eventTypeId}
                date={date}
                startTime={(sp.get("startTime") ?? "").trim() || undefined}
                endTime={(sp.get("endTime") ?? "").trim() || undefined}
                durationMinutes={Number(sp.get("durationMinutes")) || undefined}
                title={title}
                showHeader
                onSaved={(id) => { setSavedEventId(id); setTimeout(() => router.back(), 1500); }}
                extraActions={<ActionButton label="Back" variant="ghost" onClick={() => router.back()} />}
            />
        </div>
    );
}

export default function PlanLessonPage() {
    return (
        <Suspense>
            <PlanLessonInner />
        </Suspense>
    );
}
