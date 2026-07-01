import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getReviewDb } from "@/lib/db";
import { ObjectId } from "mongodb";

type ReportStatus = "pending" | "under_review" | "resolved" | "dismissed";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { status, reviewNotes } = await req.json().catch(() => ({}));

    const validStatuses: ReportStatus[] = ["pending", "under_review", "resolved", "dismissed"];
    if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const db = await getReviewDb();

    let objectId: ObjectId;
    try {
        objectId = new ObjectId(id);
    } catch {
        return NextResponse.json({ error: "Invalid ID." }, { status: 400 });
    }

    const update: Record<string, unknown> = {
        status,
        reviewedBy: session.username,
        reviewedAt: new Date(),
    };
    if (reviewNotes !== undefined) {
        update.reviewNotes = reviewNotes;
    }

    const result = await db.collection("reports").updateOne(
        { _id: objectId },
        { $set: update }
    );

    if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}
