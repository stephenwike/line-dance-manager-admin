import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
    // eslint-disable-next-line no-var
    var _mongoAdminClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
    if (!globalThis._mongoAdminClientPromise) {
        client = new MongoClient(uri);
        globalThis._mongoAdminClientPromise = client.connect();
    }
    clientPromise = globalThis._mongoAdminClientPromise;
} else {
    client = new MongoClient(uri);
    clientPromise = client.connect();
}

export async function getDb(dbName: string) {
    const c = await clientPromise;
    return c.db(dbName);
}

/** Main approved-data database */
export async function getMainDb() {
    return getDb("ldco");
}

/** Review/pending-data database */
export async function getReviewDb() {
    return getDb("ldco-reviews");
}

/** DJ feed database */
export async function getFeedDb() {
    return getDb(process.env.FEED_DB_NAME ?? "djfeed");
}

/** Beyond Line Dance scheduling database */
export async function getBldDb() {
    return getDb(process.env.BLD_DB_NAME ?? "bld");
}
