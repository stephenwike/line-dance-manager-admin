import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = {};

    if ("attendeeStatus" in body) {
        update.attendeeStatus = body.attendeeStatus;
    }
    if (body.markPaid) {
        update.paymentStatus = "paid";
        update.paymentMethod = "venmo";
        update.paidAt = new Date();
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const db = await getMainDb();
    const result = await db.collection("event_registrations").updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
    );

    if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
