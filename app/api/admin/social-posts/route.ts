import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

// Facebook posts drafted by beyond-line-dance-webhooks (ldco-lessons.social_posts).
// Returns the ones waiting on you, then the 40 most recent others.
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const col = (await getBldDb()).collection("social_posts");
        const [open, recent] = await Promise.all([
            col.find({ status: { $in: ["pending", "approved", "publishing", "failed"] } }).sort({ expireAt: 1 }).toArray(),
            col.find({ status: { $in: ["published", "skipped", "expired"] } }).sort({ updatedAt: -1 }).limit(40).toArray(),
        ]);
        return NextResponse.json({ open, recent });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
