import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "LDCO Admin",
    description: "Line Dance Community Organizer — Admin Panel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
