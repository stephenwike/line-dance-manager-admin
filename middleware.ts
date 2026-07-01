import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "admin-session";

function getSecret() {
    return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow login page and auth API routes through
    if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
        return NextResponse.next();
    }

    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
        await jwtVerify(token, getSecret());
        return NextResponse.next();
    } catch {
        const res = NextResponse.redirect(new URL("/login", req.url));
        res.cookies.delete(COOKIE_NAME);
        return res;
    }
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
