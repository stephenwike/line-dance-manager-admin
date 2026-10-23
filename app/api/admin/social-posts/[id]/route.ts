import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBldDb } from "@/lib/db";
import { callPoster } from "@/lib/poster";
import { FINISHED_STATUSES } from "@/lib/socialPosts";

type Ctx = { params: Promise<{ id: string }> };

const APPROVABLE = ["pending", "failed", "expired"];
const SKIPPABLE = ["pending", "approved", "failed", "expired"];


// Ask beyond-line-dance-webhooks to publish now instead of on its next tick (up to 30 minutes).
// If this fails, the tick still publishes the approved post.
async function publishNow(id: string): Promise<{ published: boolean; status?: string; error?: string | null }> {
    const r = await callPoster(`/api/posts/${encodeURIComponent(id)}/publish`);
    if (r.error && r.published === undefined) return { published: false, error: `${r.error}; it will publish on the next tick` };
    return r as { published: boolean; status?: string; error?: string | null };
}

/**
 * body: { action: "approve", message, planHash } — approve (optionally with edited text) and publish
 *       { action: "skip" }                       — never post it
 */
export async function PATCH(req: Request, { params }: Ctx) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const col = (await getBldDb()).collection<{ _id: string; [k: string]: unknown }>("social_posts");
    const post = await col.findOne({ _id: id });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const now = new Date();

    if (body.action === "clear") {
        const r = await col.updateOne({ _id: id, status: { $in: FINISHED_STATUSES } }, { $set: { archivedAt: now } });
        if (!r.matchedCount) return NextResponse.json({ error: `Only finished posts can be cleared (this one is ${post.status})` }, { status: 409 });
        return NextResponse.json({ ok: true });
    }

    if (body.action === "skip") {
        const r = await col.updateOne({ _id: id, status: { $in: SKIPPABLE } }, {
            $set: { status: "skipped", note: "Skipped by you", decidedBy: session.username, decidedAt: now, updatedAt: now },
        });
        if (!r.modifiedCount) return NextResponse.json({ error: `Can't skip a ${post.status} post` }, { status: 409 });
        return NextResponse.json({ ok: true });
    }

    if (body.action === "approve") {
        const message = String(body.message ?? "").trim();
        if (!message) return NextResponse.json({ error: "The post text is empty" }, { status: 400 });
        // Tie the approval to the plan you were looking at: if it changed since, approve fails.
        const r = await col.updateOne({ _id: id, status: { $in: APPROVABLE }, planHash: body.planHash }, {
            $set: {
                status: "approved", approvedPlanHash: body.planHash,
                editedMessage: message === post.message ? null : message,
                error: null, decidedBy: session.username, decidedAt: now, updatedAt: now,
            },
        });
        if (!r.modifiedCount) {
            return NextResponse.json({ error: "This post changed (or was already handled) since you loaded it. Reload and check it again." }, { status: 409 });
        }
        return NextResponse.json({ ok: true, ...(await publishNow(id)) });
    }

    return NextResponse.json({ error: "action must be approve, skip or clear" }, { status: 400 });
}
