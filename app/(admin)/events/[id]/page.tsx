"use client";

import { useParams, useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui";
import { PlanEditor } from "@/components/PlanEditor";

export default function EventDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const router = useRouter();

    return (
        <div className="page-pad" style={{ maxWidth: 760 }}>
            <div style={{ marginBottom: 10 }}>
                <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", padding: 0, textDecoration: "underline" }}>← Back</button>
            </div>
            {id && (
                <PlanEditor
                    eventId={id}
                    showHeader
                    extraActions={<ActionButton label="Back" variant="ghost" onClick={() => router.back()} />}
                />
            )}
        </div>
    );
}
