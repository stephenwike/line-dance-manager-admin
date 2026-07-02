import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getFeedDb } from "@/lib/db";

function normalizeEmail(e: unknown) {
    return String(e ?? "").trim().toLowerCase();
}

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getFeedDb();
    const docs = await db.collection("free_access")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

    return NextResponse.json(docs.map((d) => ({
        _id: String(d._id),
        email: d.email ?? "",
        note: d.note ?? null,
        expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    })));
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const email = normalizeEmail(body.email);
        if (!email || !email.includes("@")) {
            return NextResponse.json({ error: "Valid email required" }, { status: 400 });
        }

        const note = body.note ? String(body.note).trim() || null : null;
        let expiresAt: Date | null = null;
        if (body.expiresAt) {
            const d = new Date(body.expiresAt);
            if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid expiresAt date" }, { status: 400 });
            expiresAt = d;
        }

        const db = await getFeedDb();
        const existing = await db.collection("free_access").findOne({ email });
        if (existing) return NextResponse.json({ error: "Email already has free access" }, { status: 409 });

        const result = await db.collection("free_access").insertOne({
            email,
            note,
            expiresAt,
            createdAt: new Date(),
        });

        return NextResponse.json({ ok: true, _id: String(result.insertedId) }, { status: 201 });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const id = String(body.id ?? "").trim();
        if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

        const db = await getFeedDb();
        const result = await db.collection("free_access").deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
