import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getFeedDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = await getFeedDb();

    // Look up the sessionId from the report document
    let report;
    try {
        report = await db.collection("session_reports").findOne(
            { _id: new ObjectId(id) },
            { projection: { sessionId: 1 } }
        );
    } catch {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const history = await db.collection("requester_history")
        .find({ sessionId: report.sessionId })
        .sort({ sessionDate: 1 })
        .toArray();

    const requesters = history.map((h) => ({
        clientId: h.clientId ?? null,
        requesterName: h.requesterName ?? null,
        requests: (Array.isArray(h.requests) ? h.requests : []).map((r: {
            danceName?: string; danceId?: string; status?: string;
            tipCents?: number; createdAt?: Date;
        }) => ({
            danceName: r.danceName ?? null,
            danceId: r.danceId ?? null,
            status: r.status ?? null,
            tipCents: r.tipCents ?? 0,
            createdAt: r.createdAt ?? null,
        })).sort((a: { createdAt: Date | null }, b: { createdAt: Date | null }) =>
            new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
        ),
    }));

    return NextResponse.json({ requesters });
}
