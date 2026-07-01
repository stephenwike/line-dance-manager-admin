import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb, getReviewDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reviewDb = await getReviewDb();
    const mainDb = await getMainDb();

    const claims = await reviewDb.collection("verify_user_instructor")
        .find({ resolved: false })
        .sort({ createdAt: 1 })
        .toArray();

    // Enrich with instructor + user info
    const enriched = await Promise.all(claims.map(async (claim) => {
        const [instructor, user] = await Promise.all([
            mainDb.collection("instructors").findOne({ _id: claim.instructorId } as object)
                ?? mainDb.collection("instructors").findOne({ _id: { $in: [claim.instructorId] } } as object),
            mainDb.collection("users").findOne({ _id: claim.userId } as object),
        ]);

        return {
            id: claim._id?.toString() ?? "",
            userId: claim.userId,
            instructorId: claim.instructorId,
            createdAt: claim.createdAt,
            instructorName: (instructor as { name?: string } | null)?.name ?? claim.instructorId,
            instructorCurrentUserId: (instructor as { userId?: string } | null)?.userId ?? null,
            userName: (user as { name?: string } | null)?.name ?? claim.userId,
            userEmail: (user as { email?: string } | null)?.email ?? null,
        };
    }));

    return NextResponse.json(enriched);
}
