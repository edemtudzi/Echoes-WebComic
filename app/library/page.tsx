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
    cover_image_path: string | null;
    now_streaming_image_path: string | null;
  }>(
    `select id, slug, title, subtitle, description, cover_image_path, now_streaming_image_path
     from public.comics
     where status = 'published'
     order by sort_order asc, created_at asc`
  );

  const featuredComic = comics[0];
  const featuredImage = featuredComic?.now_streaming_image_path || featuredComic?.cover_image_path;

  return (
    <main className="view library-view">
      <section className="library-hero">
        <div className="library-copy">
          <div className="library-kicker">Original Series Library</div>
          <h1>Choose your next story.</h1>
          <p className="lead">
            Read cinematic web-comic series, submit reflections, and unlock the next part of each journey as the library grows.
          </p>
        </div>

        <div className="feature-poster-card library-feature-poster" aria-hidden="true">
          <div className={`poster-image library-poster ${featuredImage ? "uploaded-poster" : ""}`}>
            {featuredImage ? <img src={featuredImage} alt="" /> : null}
          </div>
        </div>
      </section>

      <section className="library-section-title">
        <div>
          <div className="eyebrow">Comic Library</div>
          <h2>Available stories.</h2>
        </div>
        <p>Select any story card to open its seasons and episodes.</p>
      </section>

      <section className="library-grid">
        {comics.map((comic) => {
          const isEchoes = comic.slug === "echoes-of-the-source";

          return (
            <Link className="comic-tile clickable-card" href={`/comics/${comic.slug}`} key={comic.id}>
              <article>
                <div className={`poster-frame ${comic.cover_image_path ? "uploaded-poster" : isEchoes ? "echoes-poster" : "comic-poster-fallback"}`} aria-hidden="true">
                  {comic.cover_image_path ? <img src={comic.cover_image_path} alt="" /> : null}
                  <div className="poster-label">
                    <strong>{comic.title}</strong>
                    <span>{comic.subtitle ?? "Original Web-Comic"}</span>
                  </div>
                </div>
                <div className="comic-info">
                  <h3>{comic.title}</h3>
                  <p className="hint">{comic.subtitle ?? "Original Web-Comic"}</p>
                  <p>{comic.description}</p>
                  <div className="tag-row">
                    <span className="tag">Series</span>
                    <span className="tag">Reflection Unlocks</span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
