import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./navigation-polish.css";
import "./visual-refresh.css";
import "./header-fix.css";
import { getUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Echoes of the Source",
  description: "A cinematic web-comic platform."
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

          {user ? (
            <nav className="nav" aria-label="Reader navigation">
              <Link className="button-secondary" href="/library">
                Library
              </Link>
              <Link className="button-secondary" href="/progress">
                Progress
              </Link>
              {isAdmin ? (
                <Link className="button-secondary admin-nav-button" href="/admin">
                  Admin
                </Link>
              ) : null}
              <form action={signOut}>
                <button className="button" type="submit">
                  Sign Out
                </button>
              </form>
            </nav>
          ) : null}
        </header>

        {children}
      </body>
    </html>
  );
}
