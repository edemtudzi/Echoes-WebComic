import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
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
            <nav className="nav">
              <Link className="button-secondary" href="/library">
                Library
              </Link>
              <Link className="button-secondary" href="/progress">
                Progress
              </Link>
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
