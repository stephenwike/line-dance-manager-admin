import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb, getReviewDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { action } = await req.json().catch(() => ({}));

    if (!["approve", "deny"].includes(action)) {
        return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const reviewDb = await getReviewDb();

    let objectId: ObjectId;
    try {
        objectId = new ObjectId(id);
    } catch {
        return NextResponse.json({ error: "Invalid ID." }, { status: 400 });
    }

    const claim = await reviewDb.collection("venue_users").findOne({ _id: objectId });
    if (!claim) {
        return NextResponse.json({ error: "Venue claim not found." }, { status: 404 });
    }

    if (action === "approve") {
        const mainDb = await getMainDb();
        await mainDb.collection("venue_users").insertOne({
            _id: new ObjectId(),
            userId: claim.userId,
            venueId: claim.venueId,
            createdAt: new Date(),
            requestedBy: claim.requestedBy,
            approvedBy: session.username,
            approvedAt: new Date(),
        });
    }

    // Remove from review queue
    await reviewDb.collection("venue_users").deleteOne({ _id: objectId });

    return NextResponse.json({ ok: true });
}
