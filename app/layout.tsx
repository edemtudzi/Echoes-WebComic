import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./navigation-polish.css";
import "./visual-refresh.css";
import "./header-fix.css";
import { getUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Echoes Web-Comics",
  description: "A reader-gated cinematic web-comic platform."
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
            <span className="mark" aria-hidden="true" />
            <span>
              <strong>Echoes Web-Comics</strong>
              <span>{user?.email ?? "Guest reader"}</span>
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
