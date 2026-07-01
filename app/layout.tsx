import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./navigation-polish.css";
import "./visual-refresh.css";
import "./header-fix.css";
import "./compact-ui.css";
import "./graphics-refresh.css";
import "./dashboard-compact.css";
import "./admin-progress-redesign.css";
import "./mobile-priority.css";
import { getUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { HeaderNav } from "@/app/header-nav";

export const metadata: Metadata = {
  title: "Echoes of the Source",
  description: "A cinematic web-comic platform.",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.svg"
  },
  appleWebApp: {
    capable: true,
    title: "Echoes",
    statusBarStyle: "default"
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();
  const isAdmin = user?.role === "admin";

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link className="brand" href={user ? "/library" : "/"}>
            <img className="brand-logo" src="/echoes-symbol.svg" alt="" aria-hidden="true" />
            <span className="brand-copy">
              <strong>Echoes</strong>
              <span>of the Source</span>
            </span>
          </Link>

          {user ? <HeaderNav isAdmin={isAdmin} signOutAction={signOut} /> : null}
        </header>

        {children}
      </body>
    </html>
  );
}
