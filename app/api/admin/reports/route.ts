import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb, getReviewDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reviewDb = await getReviewDb();
    const mainDb = await getMainDb();

    const reports = await reviewDb.collection("reports")
        .find({ status: { $in: ["pending", "under_review"] } })
        .sort({ createdAt: 1 })
        .toArray();

    // Enrich with subject names and reporter info
    const enriched = await Promise.all(reports.map(async (r) => {
        const reporter = await mainDb.collection("users").findOne({ _id: r.userId } as object);

        let subjectName: string | null = null;
        if (r.subjectId) {
            if (r.subjectType === "venue") {
                const v = await mainDb.collection("venues").findOne({ _id: r.subjectId } as object) as { venuename?: string } | null;
                subjectName = v?.venuename ?? null;
            } else if (r.subjectType === "instructor") {
                const i = await mainDb.collection("instructors").findOne({ _id: r.subjectId } as object) as { name?: string } | null;
                subjectName = i?.name ?? null;
            } else if (r.subjectType === "lesson") {
                const l = await mainDb.collection("lessons").findOne({ _id: r.subjectId } as object) as { title?: string } | null;
                subjectName = l?.title ?? null;
            }
        }

        return {
            id: r._id?.toString() ?? "",
            userId: r.userId,
            subjectType: r.subjectType,
            subjectId: r.subjectId,
            subjectName,
            issueType: r.issueType,
            description: r.description,
            suggestedFix: r.suggestedFix ?? null,
            status: r.status,
            createdAt: r.createdAt,
            reviewedAt: r.reviewedAt ?? null,
            reviewedBy: r.reviewedBy ?? null,
            reviewNotes: r.reviewNotes ?? null,
            reporterName: (reporter as { name?: string } | null)?.name ?? r.userId,
            reporterEmail: (reporter as { email?: string } | null)?.email ?? null,
        };
    }));

    return NextResponse.json(enriched);
}
