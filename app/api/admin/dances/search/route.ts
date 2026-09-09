import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return NextResponse.json([]);

    const db = await getMainDb();

    const dances = await db.collection("dances")
        .find({ danceName: { $regex: q, $options: "i" } })
        .project({ danceName: 1 })
        .sort({ danceName: 1 })
        .limit(20)
        .toArray();

    return NextResponse.json(dances.map(d => ({
        id: String(d._id),
        danceName: d.danceName as string,
    })));
}
