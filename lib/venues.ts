import { ObjectId } from "mongodb";
import { getMainDb } from "@/lib/db";

/**
 * Venues live in the shared ldco.venues (line-dance-manager's list); bld.venues was merged into it
 * (ldco-database migration 0012). The BLD scheduling pages keep their { name, address, city, state }
 * shape, mapped from ldco's venuename / venueaddress. Event types store the venue id as a string.
 */
export interface BldVenue {
    _id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
}

interface LdcoVenue {
    _id: string;
    venuename?: string;
    venueaddress?: string;
    city?: string;
    state?: string;
    geolocation?: [number, number];
    phone?: string;
    website?: string;
}

async function venues() {
    return (await getMainDb()).collection<LdcoVenue>("venues");
}

export function toBldVenue(v: LdcoVenue): BldVenue {
    return {
        _id: String(v._id),
        name: v.venuename ?? "",
        address: v.venueaddress ?? null,
        city: v.city ?? null,
        state: v.state ?? null,
    };
}

export async function listVenues(): Promise<BldVenue[]> {
    const docs = await (await venues()).find({}).sort({ venuename: 1 }).toArray();
    return docs.map(toBldVenue);
}

export async function getVenue(id: unknown): Promise<BldVenue | null> {
    if (id === null || id === undefined || id === "") return null;
    const doc = await (await venues()).findOne({ _id: String(id) });
    return doc ? toBldVenue(doc) : null;
}

export async function venueName(id: unknown): Promise<string> {
    return (await getVenue(id))?.name || "Unknown venue";
}

/** Adds a venue to the shared list. Coordinates start at [0, 0], as line-dance-manager's add-venue does. */
export async function createVenue(input: { name: string; address: string | null; city: string | null; state: string | null }) {
    const _id = new ObjectId().toHexString();
    await (await venues()).insertOne({
        _id,
        venuename: input.name,
        venueaddress: [input.address, input.city, input.state].filter(Boolean).join(", "),
        geolocation: [0, 0],
        phone: "",
        website: "",
        ...(input.city ? { city: input.city } : {}),
        ...(input.state ? { state: input.state } : {}),
    });
    return _id;
}
