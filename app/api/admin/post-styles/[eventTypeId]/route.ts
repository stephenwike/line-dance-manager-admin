import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";

type Ctx = { params: Promise<{ eventTypeId: string }> };

/** bld.post_styles: one document per event type (_id = eventTypeId); the poster reads it when drafting. */
type StyleDoc = { _id: string; theme?: string; photo?: string; headline?: string; hook?: string; cta?: string; hashtags?: string[]; updatedAt: Date };

function text(v: unknown, max: number): string | undefined {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s.slice(0, max) : undefined;
}

// Save a class's style. Unknown themes or photos fall back to the default when drafting.
export async function PUT(req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { eventTypeId } = await params;
    const body = await req.json().catch(() => ({}));
    const hashtags = Array.isArray(body.hashtags)
        ? body.hashtags.map((h: unknown) => String(h).trim()).filter(Boolean).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 10)
        : [];
    const doc: Omit<StyleDoc, "_id"> = {
        theme: text(body.theme, 40), photo: text(body.photo, 60),
        headline: text(body.headline, 40), hook: text(body.hook, 200), cta: text(body.cta, 60),
        hashtags, updatedAt: new Date(),
    };
    await (await getBldDb()).collection<StyleDoc>("post_styles").replaceOne({ _id: eventTypeId }, doc, { upsert: true });
    return NextResponse.json({ ok: true });
}

// Back to the suggested style.
export async function DELETE(_req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { eventTypeId } = await params;
    await (await getBldDb()).collection<StyleDoc>("post_styles").deleteOne({ _id: eventTypeId });
    return NextResponse.json({ ok: true });
}
