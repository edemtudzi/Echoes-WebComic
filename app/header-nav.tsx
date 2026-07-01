"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type HeaderNavProps = {
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
};

export function HeaderNav({ isAdmin, signOutAction }: HeaderNavProps) {
  const pathname = usePathname();
  const inAdmin = pathname?.startsWith("/admin") ?? false;

  return (
    <nav className="nav" aria-label="Reader navigation">
      <Link className="button-secondary" href="/library">
        Library
      </Link>
      <Link className="button-secondary" href="/progress">
        Progress
      </Link>
      {isAdmin && !inAdmin ? (
        <Link className="button-secondary admin-nav-button" href="/admin">
          Admin
        </Link>
      ) : null}
      <form action={signOutAction}>
        <button className="button" type="submit">
          Sign Out
        </button>
      </form>
    </nav>
  );
}
