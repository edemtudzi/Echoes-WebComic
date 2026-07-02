import Link from "next/link";
import { getUser } from "@/lib/auth";
import { one } from "@/lib/db";

export default async function HomePage() {
  const user = await getUser();
  const featuredComic = await one<{
    slug: string;
    title: string;
    now_streaming_image_path: string | null;
  }>(
    `select slug, title, now_streaming_image_path
     from public.comics
     where status = 'published' and now_streaming_image_path is not null
     order by sort_order asc, created_at asc
     limit 1`
  );

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
        {featuredComic?.now_streaming_image_path ? (
          <Link className="streaming-poster" href={user ? `/comics/${featuredComic.slug}` : "/sign-up"}>
            <span>Now Streaming</span>
            <img src={featuredComic.now_streaming_image_path} alt={`${featuredComic.title} now streaming`} />
          </Link>
        ) : (
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
        )}
      </section>
    </main>
  );
}
