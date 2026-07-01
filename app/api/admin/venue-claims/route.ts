import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb, getReviewDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reviewDb = await getReviewDb();
    const mainDb = await getMainDb();

    const claims = await reviewDb.collection("venue_users")
        .find({})
        .sort({ createdAt: 1 })
        .toArray();

    const enriched = await Promise.all(claims.map(async (claim) => {
        const [venue, user] = await Promise.all([
            mainDb.collection("venues").findOne({ _id: claim.venueId } as object),
            mainDb.collection("users").findOne({ _id: claim.userId } as object),
        ]);

        return {
            id: claim._id?.toString() ?? "",
            userId: claim.userId,
            venueId: claim.venueId,
            requestedBy: claim.requestedBy,
            createdAt: claim.createdAt,
            venueName: (venue as { venuename?: string } | null)?.venuename ?? claim.venueId,
            venueAddress: (venue as { venueaddress?: string } | null)?.venueaddress ?? null,
            userName: (user as { name?: string } | null)?.name ?? claim.userId,
            userEmail: (user as { email?: string } | null)?.email ?? null,
        };
    }));

    return NextResponse.json(enriched);
}
