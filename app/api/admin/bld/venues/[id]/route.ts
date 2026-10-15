import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getVenue } from "@/lib/venues";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const venue = await getVenue(id);
    if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(venue);
}
