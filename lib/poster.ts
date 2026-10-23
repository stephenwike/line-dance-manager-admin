// Calls to beyond-line-dance-webhooks (the Facebook poster), authenticated with the shared secret.

/** Call the poster (POST by default). Returns its JSON, or { error } when it isn't configured or can't be reached. */
export async function callPoster(path: string, method: "GET" | "POST" = "POST", body?: unknown): Promise<Record<string, unknown> & { error?: string | null }> {
    const base = process.env.WEBHOOKS_URL?.replace(/\/$/, "");
    const secret = process.env.WEBHOOKS_INTERNAL_SECRET;
    if (!base || !secret) return { error: "WEBHOOKS_URL is not set" };
    try {
        const res = await fetch(`${base}${path}`, {
            method, cache: "no-store",
            headers: { Authorization: `Bearer ${secret}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        return await res.json();
    } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}
