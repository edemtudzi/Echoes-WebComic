import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function LibraryPage() {
  await requireUser();
  const comics = await query<{
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string;
  }>(
    `select id, slug, title, subtitle, description
     from public.comics
     where status = 'published'
     order by sort_order asc, created_at asc`
  );

  const featuredComic = comics.find((comic) => comic.slug === "echoes-of-the-source") ?? comics[0];

  return (
    <main className="view library-view">
      <section className="library-hero">
        <div className="library-copy">
          <div className="library-kicker">Featured Original</div>
          <h1>Echoes of the Source</h1>
          <p className="lead">
            A cinematic web-comic about Light, separation, corruption, sacrifice, and the invitation to return.
          </p>
          <div className="library-actions">
            {featuredComic ? (
              <Link className="button" href={`/comics/${featuredComic.slug}`}>
                Start Reading
              </Link>
            ) : null}
            <p className="library-note">Read the episode, leave a real reflection, then unlock what comes next.</p>
          </div>
        </div>

        <div className="feature-poster-card" aria-hidden="true">
          <div className="poster-image echoes-poster">
            <div className="poster-caption">
              <span>Season 1</span>
              <h2>The Glow We Lost</h2>
            </div>
          </div>
        </div>
      </section>

      <section className="library-section-title">
        <div>
          <div className="eyebrow">Comic Library</div>
          <h2>Choose your story.</h2>
        </div>
        <p>The pilot should feel premium before we expand the library. No more placeholder-looking cards.</p>
      </section>

      <section className="library-grid">
        {comics.map((comic) => {
          const isEchoes = comic.slug === "echoes-of-the-source";

          return (
            <article className="comic-tile" key={comic.id}>
              <div className={`poster-frame ${isEchoes ? "echoes-poster" : "comic-poster-fallback"}`} aria-hidden="true">
                <div className="poster-label">
                  <strong>{comic.title}</strong>
                  <span>{comic.subtitle ?? "Original Web-Comic"}</span>
                </div>
              </div>
              <div className="comic-info">
                <h3>{comic.title}</h3>
                <p className="hint">{comic.subtitle}</p>
                <p>{comic.description}</p>
                <div className="tag-row">
                  <span className="tag">Cinematic</span>
                  <span className="tag">Allegory</span>
                </div>
                <Link className="button" href={`/comics/${comic.slug}`}>
                  Open Comic
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
