import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getMainDb();
    const docs = await db.collection("users")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

    return NextResponse.json(docs.map((u) => ({
        _id: String(u._id),
        email: u.email ?? null,
        name: u.name ?? null,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    })));
}
