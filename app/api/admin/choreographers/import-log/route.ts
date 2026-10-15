import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getMainDb();

    const choreographers = await db.collection("choreographers")
        .find({ lastImportedAt: { $exists: true, $ne: null } } as never)
        .sort({ lastImportedAt: -1 })
        .toArray();

    if (choreographers.length === 0) return NextResponse.json([]);

    const ids = choreographers.map(c => c._id.toString());

    // Count dances per choreographer
    const counts = await db.collection("dances").aggregate([
        { $match: { choreographers: { $in: ids } } },
        { $unwind: "$choreographers" },
        { $match: { choreographers: { $in: ids } } },
        { $group: { _id: "$choreographers", count: { $sum: 1 } } },
    ]).toArray();

    const countMap = new Map(counts.map(c => [c._id as string, c.count as number]));

    return NextResponse.json(choreographers.map(c => ({
        id: c._id.toString(),
        name: c.name as string,
        copperknobUrl: (c.copperknobUrl as string) ?? null,
        lastImportedAt: c.lastImportedAt as string,
        danceCount: countMap.get(c._id.toString()) ?? 0,
    })));
}
