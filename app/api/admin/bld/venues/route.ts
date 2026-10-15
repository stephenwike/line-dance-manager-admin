import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createVenue, listVenues } from "@/lib/venues";

function clean(v: unknown) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
}

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(await listVenues());
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));

        const name = clean(body.name);
        const address = clean(body.address) || null;
        const city = clean(body.city) || null;
        const state = clean(body.state).toUpperCase() || null;

        if (!name) return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
        if (state && state.length !== 2) return NextResponse.json({ error: "State must be a 2-letter code (e.g. CO)" }, { status: 400 });

        const venueId = await createVenue({ name, address, city, state });

        return NextResponse.json({ ok: true, venueId });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
