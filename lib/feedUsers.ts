import { ObjectId } from "mongodb";
import { getMainDb } from "@/lib/db";

/**
 * Resolves display names for a set of dj-feed user IDs (ownerId / attendeeId).
 * These IDs come from the LDCO OAuth `sub` claim and may correspond to either
 * a `users._id` (ObjectId or string) or an `instructors.userId` field.
 * We try all three strategies and merge results.
 */
export async function resolveUserNames(ids: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return {};

    const mainDb = await getMainDb();
    const nameMap: Record<string, string> = {};

    // Strategy 1 — users._id as ObjectId (most common: MongoDB auto-assigned IDs)
    const asObjectIds = unique.flatMap((id) => {
        try { return [new ObjectId(id)]; } catch { return []; }
    });

    // Strategy 2 — users._id as plain string (some auth setups store sub directly)
    // Strategy 3 — instructors.userId field (DJs are often instructors in LDCO)
    const [byObjectId, byString, byInstructorUserId] = await Promise.all([
        asObjectIds.length > 0
            ? mainDb.collection("users")
                .find({ _id: { $in: asObjectIds } } as object)
                .project({ _id: 1, name: 1 })
                .toArray()
            : Promise.resolve([]),
        mainDb.collection("users")
            .find({ _id: { $in: unique } } as object)
            .project({ _id: 1, name: 1 })
            .toArray(),
        mainDb.collection("instructors")
            .find({ userId: { $in: unique } } as object)
            .project({ userId: 1, name: 1 })
            .toArray(),
    ]);

    for (const u of byObjectId) {
        const name = (u as { name?: string }).name;
        if (name) nameMap[String(u._id)] = name;
    }
    for (const u of byString) {
        const name = (u as { name?: string }).name;
        if (name) nameMap[String(u._id)] = name;
    }
    // Instructors fill in any gaps not resolved by users lookup
    for (const inst of byInstructorUserId) {
        const uid = (inst as { userId?: string }).userId;
        const name = (inst as { name?: string }).name;
        if (uid && name && !nameMap[uid]) nameMap[uid] = name;
    }

    return nameMap;
}
