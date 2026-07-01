import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getReviewDb, getFeedDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [reviewDb, feedDb] = await Promise.all([getReviewDb(), getFeedDb()]);

    const [dances, instructorClaims, venueClaims, reports, feedSessions, feedBeats, feedWallet] = await Promise.all([
        reviewDb.collection("pending_dances").countDocuments(),
        reviewDb.collection("verify_user_instructor").countDocuments({ resolved: false }),
        reviewDb.collection("venue_users").countDocuments(),
        reviewDb.collection("reports").countDocuments({ status: { $in: ["pending", "under_review"] } }),
        feedDb.collection("session_reports").countDocuments(),
        feedDb.collection("beat_transactions").countDocuments(),
        feedDb.collection("dj_wallet_transactions").countDocuments(),
    ]);

    return NextResponse.json({
        dances,
        instructorClaims,
        venueClaims,
        reports,
        feedSessions,
        feedTransactions: feedBeats + feedWallet,
    });
}
