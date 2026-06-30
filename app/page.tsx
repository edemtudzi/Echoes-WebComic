import Link from "next/link";
import { getUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getUser();

  return (
    <main className="view">
      <section className="hero">
        <div>
          <div className="eyebrow">Original cinematic web-comics</div>
          <h1>Read the story before it becomes animation.</h1>
          <p className="lead">
            Create a reader account, enter the library, choose a comic, and unlock the next episode by leaving a real reflection after reading.
          </p>
          <div className="actions">
            <Link className="button" href={user ? "/library" : "/sign-up"}>
              Start Reading
            </Link>
            <Link className="button-secondary" href="/sign-in">
              Sign In
            </Link>
          </div>
        </div>
        <div className="form-card">
          <div className="eyebrow">Pilot Platform</div>
          <h3>Echoes of the Source</h3>
          <p className="lead" style={{ fontSize: 17 }}>
            The first production target is one strong pilot: Season 1, Episode 1, saved progress, and a reflection gate that unlocks Episode 2.
          </p>
          <p className="warning">
            This platform is being built for real reader feedback, not fake engagement.
          </p>
        </div>
      </section>
    </main>
  );
}
