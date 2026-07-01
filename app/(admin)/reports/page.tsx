"use client";

import { useEffect, useState } from "react";
import { PageShell, EmptyState, Badge, ActionButton, ExpandableCard, InfoRow } from "@/components/ui";

interface Report {
    id: string;
    userId: string;
    subjectType: string;
    subjectId: string;
    subjectName: string | null;
    issueType: string;
    description: string;
    suggestedFix: string | null;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    reviewedBy: string | null;
    reviewNotes: string | null;
    reporterName: string;
    reporterEmail: string | null;
}

const ISSUE_LABELS: Record<string, string> = {
    closed_defunct: "Closed / Defunct",
    incorrect_info: "Incorrect Info",
    schedule_change: "Schedule Change",
    instructor_change: "Instructor Change",
    cancellation: "Cancellation",
    other: "Other",
};

const STATUS_COLORS: Record<string, "blue" | "orange" | "green" | "red"> = {
    pending: "blue",
    under_review: "orange",
    resolved: "green",
    dismissed: "red",
};

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    async function load() {
        setLoading(true);
        try {
            const data = await fetch("/api/admin/reports").then((r) => r.json());
            setReports(Array.isArray(data) ? data : []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function updateStatus(id: string, status: string) {
        setActing(id);
        try {
            await fetch(`/api/admin/reports/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, reviewNotes: notes[id] ?? undefined }),
            });
            if (status === "resolved" || status === "dismissed") {
                setReports((prev) => prev.filter((r) => r.id !== id));
            } else {
                setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
            }
        } finally {
            setActing(null);
        }
    }

    return (
        <PageShell title="Reports" count={reports.length} loading={loading}>
            {reports.length === 0 && !loading
                ? <EmptyState message="No reports pending review." />
                : reports.map((report) => (
                    <ExpandableCard
                        key={report.id}
                        title={ISSUE_LABELS[report.issueType] ?? report.issueType}
                        subtitle={report.subjectName
                            ? `${report.subjectType}: ${report.subjectName}`
                            : `${report.subjectType} · ${report.subjectId}`
                        }
                        badge={<Badge label={report.status.replace("_", " ")} color={STATUS_COLORS[report.status] ?? "blue"} />}
                        meta={`Reported ${new Date(report.createdAt).toLocaleDateString()} by ${report.reporterName}`}
                        actions={
                            <>
                                {report.status === "pending" && (
                                    <ActionButton
                                        label="Start Review"
                                        variant="primary"
                                        loading={acting === report.id}
                                        onClick={() => updateStatus(report.id, "under_review")}
                                    />
                                )}
                                <ActionButton
                                    label="Resolve"
                                    variant="success"
                                    loading={acting === report.id}
                                    onClick={() => updateStatus(report.id, "resolved")}
                                />
                                <ActionButton
                                    label="Dismiss"
                                    variant="danger"
                                    loading={acting === report.id}
                                    onClick={() => updateStatus(report.id, "dismissed")}
                                />
                            </>
                        }
                    >
                        <InfoRow label="Description">
                            <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>{report.description}</p>
                        </InfoRow>
                        {report.suggestedFix && (
                            <InfoRow label="Suggested fix">
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{report.suggestedFix}</p>
                            </InfoRow>
                        )}
                        {report.reporterEmail && <InfoRow label="Reporter email" value={report.reporterEmail} />}
                        <InfoRow label="Subject ID" value={report.subjectId} mono />

                        {/* Review notes */}
                        <InfoRow label="Review notes">
                            <textarea
                                value={notes[report.id] ?? report.reviewNotes ?? ""}
                                onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                                placeholder="Add internal notes…"
                                rows={2}
                                style={{
                                    width: "100%",
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "1px solid var(--border)",
                                    background: "var(--surface-raised)",
                                    color: "var(--text-primary)",
                                    fontSize: 13,
                                    resize: "vertical",
                                    outline: "none",
                                    fontFamily: "inherit",
                                }}
                            />
                        </InfoRow>
                    </ExpandableCard>
                ))
            }
        </PageShell>
    );
}
