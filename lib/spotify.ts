export async function getSpotifyAccessToken(): Promise<string> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.");
    }

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
        cache: "no-store",
    });

    if (!res.ok) throw new Error(`Spotify token request failed: ${res.statusText}`);
    const data = await res.json();
    return data.access_token as string;
}
