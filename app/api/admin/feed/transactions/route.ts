import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFeedDb } from "@/lib/db";
import { resolveUserNames } from "@/lib/feedUsers";

// txType values:
//   "purchase"   → beat_transactions  type=purchase  (attendee buys beats with cash)
//   "beat_tip"   → beat_transactions  type=tip       (attendee spends beats to tip DJ)
//                + dj_wallet_transactions type=beat_tip (DJ receives credit for that tip)
//   "direct_tip" → dj_wallet_transactions type=direct_tip (cash tip straight to DJ)
type TxTypeFilter = "purchase" | "beat_tip" | "direct_tip";

const KNOWN_BEAT_TYPES = ["purchase", "tip"];
const KNOWN_WALLET_TYPES = ["direct_tip", "beat_tip"];

function beatQuery(txType: TxTypeFilter | null) {
    if (txType === "direct_tip") return null;
    if (txType === "purchase") return { type: "purchase" };
    if (txType === "beat_tip") return { type: "tip" };
    return { type: { $in: KNOWN_BEAT_TYPES } };
}

function walletQuery(txType: TxTypeFilter | null) {
    if (txType === "purchase") return null;
    if (txType === "direct_tip") return { type: "direct_tip" };
    if (txType === "beat_tip") return { type: "beat_tip" };
    return { type: { $in: KNOWN_WALLET_TYPES } };
}

type BeatDoc = {
    _id?: object; attendeeId?: string; type?: string;
    beats?: number; amountCents?: number; requestId?: string;
    djId?: string; stripeSessionId?: string; stripePaymentIntentId?: string; createdAt?: Date;
};
type WalletDoc = {
    _id?: object; ownerId?: string; type?: string;
    amountCents?: number; attendeeId?: string; requestId?: string;
    stripeSessionId?: string; senderName?: string; senderEmail?: string; createdAt?: Date;
};

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
    const skip = parseInt(searchParams.get("skip") ?? "0", 10);
    const raw = searchParams.get("txType") as TxTypeFilter | null;
    const txType: TxTypeFilter | null = ["purchase", "beat_tip", "direct_tip"].includes(raw ?? "")
        ? (raw as TxTypeFilter)
        : null;

    const db = await getFeedDb();
    const bq = beatQuery(txType);
    const wq = walletQuery(txType);

    const [beatDocs, walletDocs, beatPurchaseTotal, beatTipTotal, directTipTotal, beatTipWalletTotal] = await Promise.all([
        bq !== null
            ? db.collection("beat_transactions").find(bq).sort({ createdAt: -1 }).limit(limit).toArray()
            : Promise.resolve([]),
        wq !== null
            ? db.collection("dj_wallet_transactions").find(wq).sort({ createdAt: -1 }).limit(limit).toArray()
            : Promise.resolve([]),
        db.collection("beat_transactions").countDocuments({ type: "purchase" }),
        db.collection("beat_transactions").countDocuments({ type: "tip" }),
        db.collection("dj_wallet_transactions").countDocuments({ type: "direct_tip" }),
        db.collection("dj_wallet_transactions").countDocuments({ type: "beat_tip" }),
    ]);

    const beats = (beatDocs as BeatDoc[]).map((t) => ({
        id: String(t._id),
        txType: t.type === "purchase" ? "purchase" : "beat_tip",
        // purchase: attendee → platform  |  tip: attendee → DJ
        fromId: t.attendeeId ?? null,
        toId: t.type === "tip" ? (t.djId ?? null) : null,
        beats: t.beats ?? null,
        amountCents: t.amountCents ?? null,
        requestId: t.requestId ?? null,
        stripeRef: t.stripeSessionId ?? t.stripePaymentIntentId ?? null,
        createdAt: t.createdAt ?? null,
    }));

    const wallet = (walletDocs as WalletDoc[]).map((t) => ({
        id: String(t._id),
        txType: t.type === "direct_tip" ? "direct_tip" : "beat_tip",
        // beat_tip: attendee → DJ  |  direct_tip: (guest) → DJ
        fromId: t.type === "beat_tip" ? (t.attendeeId ?? null) : null,
        fromName: t.type === "direct_tip" ? (t.senderName ?? null) : null,
        fromEmail: t.type === "direct_tip" ? (t.senderEmail ?? null) : null,
        toId: t.ownerId ?? null,
        beats: null,
        amountCents: t.amountCents ?? null,
        requestId: t.requestId ?? null,
        stripeRef: t.stripeSessionId ?? null,
        createdAt: t.createdAt ?? null,
    }));

    const merged = [...beats, ...wallet]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(skip, skip + limit);

    // Bulk-resolve all user IDs (both from and to sides)
    const allIds = merged.flatMap((t) => [t.fromId, t.toId]).filter(Boolean) as string[];
    const nameMap = await resolveUserNames(allIds);

    const all = merged.map((t) => ({
        ...t,
        // fromName: prefer stored senderName (direct tips), else resolve from nameMap
        fromName: (t as { fromName?: string | null }).fromName
            ?? (t.fromId ? (nameMap[t.fromId] ?? null) : null),
        toName: t.toId ? (nameMap[t.toId] ?? null) : null,
    }));

    return NextResponse.json({
        transactions: all,
        totals: {
            purchase: beatPurchaseTotal,
            beatTip: beatTipTotal + beatTipWalletTotal,
            directTip: directTipTotal,
            combined: beatPurchaseTotal + beatTipTotal + beatTipWalletTotal + directTipTotal,
        },
    });
}
