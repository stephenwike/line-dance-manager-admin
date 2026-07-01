import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const COOKIE_NAME = "admin-session";

function getSecret() {
    return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function createSessionToken(username: string): Promise<string> {
    return new SignJWT({ username })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("12h")
        .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<{ username: string } | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret());
        return payload as { username: string };
    } catch {
        return null;
    }
}

export async function getSession(): Promise<{ username: string } | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
    return (
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
    );
}
