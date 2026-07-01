"use client";

import { useEffect, useState } from "react";
import { PageShell, EmptyState, Badge, ActionButton, ExpandableCard, InfoRow } from "@/components/ui";

interface InstructorClaim {
    id: string;
    userId: string;
    instructorId: string;
    createdAt: string;
    instructorName: string;
    instructorCurrentUserId: string | null;
    userName: string;
    userEmail: string | null;
}

export default function InstructorClaimsPage() {
    const [claims, setClaims] = useState<InstructorClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        try {
            const data = await fetch("/api/admin/instructor-claims").then((r) => r.json());
            setClaims(Array.isArray(data) ? data : []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function act(id: string, action: "approve" | "deny") {
        setActing(id);
        try {
            await fetch(`/api/admin/instructor-claims/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            setClaims((prev) => prev.filter((c) => c.id !== id));
        } finally {
            setActing(null);
        }
    }

    return (
        <PageShell title="Instructor Claims" count={claims.length} loading={loading}>
            {claims.length === 0 && !loading
                ? <EmptyState message="No instructor claims pending review." />
                : claims.map((claim) => (
                    <ExpandableCard
                        key={claim.id}
                        title={claim.instructorName}
                        subtitle={`Claimed by ${claim.userName}`}
                        badge={claim.instructorCurrentUserId
                            ? <Badge label="Already claimed" color="orange" />
                            : <Badge label="Unclaimed" color="green" />
                        }
                        meta={`Submitted ${new Date(claim.createdAt).toLocaleDateString()}`}
                        actions={
                            <>
                                <ActionButton
                                    label="Approve"
                                    variant="success"
                                    loading={acting === claim.id}
                                    onClick={() => act(claim.id, "approve")}
                                />
                                <ActionButton
                                    label="Deny"
                                    variant="danger"
                                    loading={acting === claim.id}
                                    onClick={() => act(claim.id, "deny")}
                                />
                            </>
                        }
                    >
                        <InfoRow label="User" value={claim.userName} />
                        {claim.userEmail && <InfoRow label="Email" value={claim.userEmail} />}
                        <InfoRow label="User ID" value={claim.userId} mono />
                        <InfoRow label="Instructor ID" value={claim.instructorId} mono />
                        {claim.instructorCurrentUserId && (
                            <InfoRow label="Current owner ID" value={claim.instructorCurrentUserId} mono />
                        )}
                    </ExpandableCard>
                ))
            }
        </PageShell>
    );
}
