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

    // Claims may use string or ObjectId for _id
    const filter = ObjectId.isValid(id)
        ? { _id: new ObjectId(id) }
        : ({ _id: id } as object);
    const claim = await reviewDb.collection("verify_user_instructor").findOne(filter);

    if (!claim) {
        return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    }

    if (action === "approve") {
        const mainDb = await getMainDb();
        // Link the user to the instructor
        await mainDb.collection("instructors").updateOne(
            { _id: claim.instructorId } as object,
            { $set: { userId: claim.userId } }
        );
    }

    // Mark as resolved in the review DB
    await reviewDb.collection("verify_user_instructor").updateOne(
        { _id: claim._id },
        { $set: { resolved: true, resolvedAt: new Date(), resolvedBy: session.username, resolution: action } }
    );

    return NextResponse.json({ ok: true });
}
