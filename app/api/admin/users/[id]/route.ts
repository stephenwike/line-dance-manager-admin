import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = await getMainDb();
    const result = await db.collection<{ _id: string }>("users").deleteOne({ _id: id });

    if (result.deletedCount === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}
