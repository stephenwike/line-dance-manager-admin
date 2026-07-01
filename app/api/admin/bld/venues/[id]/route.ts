import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const db = await getBldDb();
    const doc = await db.collection("venues").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
        _id: String(doc._id),
        name: doc.name ?? "",
        address: doc.address ?? null,
        city: doc.city ?? null,
        state: doc.state ?? null,
    });
}
