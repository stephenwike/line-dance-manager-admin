"use client";

import { useEffect, useState } from "react";
import { PageShell, EmptyState, ActionButton, ExpandableCard, InfoRow } from "@/components/ui";

interface VenueClaim {
    id: string;
    userId: string;
    venueId: string;
    requestedBy: string;
    createdAt: string;
    venueName: string;
    venueAddress: string | null;
    userName: string;
    userEmail: string | null;
}

export default function VenueClaimsPage() {
    const [claims, setClaims] = useState<VenueClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        try {
            const data = await fetch("/api/admin/venue-claims").then((r) => r.json());
            setClaims(Array.isArray(data) ? data : []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function act(id: string, action: "approve" | "deny") {
        setActing(id);
        try {
            await fetch(`/api/admin/venue-claims/${id}`, {
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
        <PageShell title="Venue Claims" count={claims.length} loading={loading}>
            {claims.length === 0 && !loading
                ? <EmptyState message="No venue claims pending review." />
                : claims.map((claim) => (
                    <ExpandableCard
                        key={claim.id}
                        title={claim.venueName}
                        subtitle={claim.venueAddress ?? "No address on file"}
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
                        <InfoRow label="Claimant" value={claim.userName} />
                        {claim.userEmail && <InfoRow label="Email" value={claim.userEmail} />}
                        <InfoRow label="User ID" value={claim.userId} mono />
                        <InfoRow label="Venue ID" value={claim.venueId} mono />
                    </ExpandableCard>
                ))
            }
        </PageShell>
    );
}
