import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const difficulties: string[] = Array.isArray(body.difficulties) ? body.difficulties : [];
    const choreographerIds: string[] = Array.isArray(body.choreographerIds) ? body.choreographerIds : [];
    const count = Math.min(Math.max(1, Number(body.count) || 5), 50);

    const db = await getMainDb();

    const match: Record<string, unknown> = {};
    if (difficulties.length > 0) match.difficulty = { $in: difficulties };
    if (choreographerIds.length > 0) match.choreographers = { $in: choreographerIds };

    const dances = await db.collection("dances").aggregate([
        { $match: match },
        { $sample: { size: count } },
        { $project: { _id: 1, danceName: 1, difficulty: 1, choreographers: 1, stepsheet: 1 } },
    ]).toArray();

    if (dances.length === 0) return NextResponse.json([]);

    const allChoreographerIds = [...new Set(dances.flatMap(d => (d.choreographers as string[]) ?? []))];
    const choreos = allChoreographerIds.length > 0
        ? await db.collection("choreographers").find({ _id: { $in: allChoreographerIds as never[] } }).toArray()
        : [];
    const choreoMap = new Map(choreos.map(c => [c._id.toString(), c.name as string]));

    return NextResponse.json(dances.map(d => ({
        id: d._id.toString(),
        danceName: d.danceName as string,
        difficulty: (d.difficulty as string) ?? "",
        choreographerNames: ((d.choreographers as string[]) ?? []).map(id => choreoMap.get(id) ?? id),
        stepsheet: (d.stepsheet as string) || null,
    })));
}
