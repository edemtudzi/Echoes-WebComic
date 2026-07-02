import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

export default async function ComicPage({
  params
}: {
  params: Promise<{ comicSlug: string }>;
}) {
  await requireUser();
  const { comicSlug } = await params;
  const comic = await one<{
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string;
    series_poster_image_path: string | null;
  }>(
    `select id, slug, title, subtitle, description, series_poster_image_path
     from public.comics
     where slug = $1 and status = 'published'`,
    [comicSlug]
  );

  if (!comic) {
    notFound();
  }

  const seasons = await query<{
    id: string;
    season_number: number;
    title: string;
    description: string;
    cover_image_path: string | null;
    status: string;
  }>(
    `select id, season_number, title, description, cover_image_path, status
     from public.seasons
     where comic_id = $1
     order by season_number asc`,
    [comic.id]
  );

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">Comic</div>
          <h2>{comic.title}</h2>
        </div>
        <Link className="button-secondary" href="/library">
          Back to Library
        </Link>
      </section>
      <p className="lead">{comic.description}</p>
      {comic.series_poster_image_path ? (
        <img className="landscape-hero-image series-landscape-poster" src={comic.series_poster_image_path} alt={`${comic.title} poster`} />
      ) : null}

      <section className="stack">
        {seasons.map((season) => {
          const locked = season.status === "locked";
          const content = (
            <div className="media-row">
              {season.cover_image_path ? <img className="media-thumb landscape-thumb" src={season.cover_image_path} alt={`${season.title} cover`} /> : null}
              <div>
                <h3>Season {season.season_number} — {season.title}</h3>
                <p>{season.description}</p>
                <p className="hint">{locked ? "Locked" : "Tap anywhere to open"}</p>
              </div>
            </div>
          );

          return locked ? (
            <article className="row-card locked-card" key={season.id}>
              {content}
            </article>
          ) : (
            <Link className="row-card clickable-card" href={`/comics/${comic.slug}/season/${season.season_number}`} key={season.id}>
              <article>{content}</article>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
