import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json([]);

    const db = await getMainDb();
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const docs = await db.collection("dances")
        .find({ danceName: { $regex: regex } })
        .project({ _id: 1, danceName: 1, stepsheet: 1, difficulty: 1 })
        .limit(12)
        .toArray();

    return NextResponse.json(docs.map((d) => ({
        _id: String(d._id),
        danceName: d.danceName ?? "",
        stepsheet: d.stepsheet ?? null,
        difficulty: d.difficulty ?? null,
    })));
}
