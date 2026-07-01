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
  }>(
    `select id, slug, title, subtitle, description
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
    status: string;
  }>(
    `select id, season_number, title, description, status
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

      <section className="stack">
        {seasons.map((season) => {
          const locked = season.status === "locked";
          const content = (
            <>
              <h3>Season {season.season_number} — {season.title}</h3>
              <p>{season.description}</p>
              <p className="hint">{locked ? "Locked" : "Tap anywhere to open"}</p>
            </>
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
