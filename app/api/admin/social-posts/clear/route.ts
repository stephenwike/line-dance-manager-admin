import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";
import { FINISHED_STATUSES } from "@/lib/socialPosts";

// Clears every finished post off Social Posts (hidden, not deleted; see FINISHED_STATUSES).
export async function POST() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const r = await (await getBldDb()).collection("social_posts").updateMany(
        { status: { $in: FINISHED_STATUSES }, archivedAt: { $exists: false } },
        { $set: { archivedAt: new Date() } },
    );
    return NextResponse.json({ cleared: r.modifiedCount });
}
