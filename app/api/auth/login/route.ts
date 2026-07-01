import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCredentials, createSessionToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const { username, password } = await req.json().catch(() => ({}));

    if (!username || !password) {
        return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    if (!verifyAdminCredentials(username, password)) {
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = await createSessionToken(username);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 12, // 12 hours
        path: "/",
    });
    return res;
}
