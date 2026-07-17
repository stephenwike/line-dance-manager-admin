import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMainDb } from "@/lib/db";

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = new URL(req.url).searchParams.get("event") || "intermediate-social-2026-09-12";

    const db = await getMainDb();
    const docs = await db.collection("event_registrations")
        .find({ event })
        .sort({ createdAt: -1 })
        .toArray();

    return NextResponse.json(docs.map((r) => ({
        _id: String(r._id),
        event: r.event,
        name: r.name,
        email: r.email,
        phone: r.phone ?? null,
        address: r.address ?? null,
        agreedToWaiver: r.agreedToWaiver ?? false,
        waiverSignedAt: r.waiverSignedAt ?? null,
        waiverSignature: r.waiverSignature ?? null,
        paymentStatus: r.paymentStatus,
        paymentMethod: r.paymentMethod ?? null,
        stripeSessionId: r.stripeSessionId ?? null,
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        attendeeStatus: r.attendeeStatus ?? "registered",
        requests: Array.isArray(r.requests) ? r.requests : [],
    })));
}
