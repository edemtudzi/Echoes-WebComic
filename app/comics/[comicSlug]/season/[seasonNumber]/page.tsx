import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

export default async function SeasonPage({
  params
}: {
  params: Promise<{ comicSlug: string; seasonNumber: string }>;
}) {
  const user = await requireUser();
  const { comicSlug, seasonNumber } = await params;
  const comic = await one<{ id: string; slug: string; title: string }>(
    `select id, slug, title
     from public.comics
     where slug = $1 and status = 'published'`,
    [comicSlug]
  );

  if (!comic) {
    notFound();
  }

  const season = await one<{
    id: string;
    season_number: number;
    title: string;
    description: string;
  }>(
    `select id, season_number, title, description
     from public.seasons
     where comic_id = $1 and season_number = $2`,
    [comic.id, Number(seasonNumber)]
  );

  if (!season) {
    notFound();
  }

  const episodes = await query<{
    id: string;
    episode_number: number;
    title: string;
    synopsis: string;
    status: string;
  }>(
    `select id, episode_number, title, synopsis, status
     from public.episodes
     where season_id = $1
     order by episode_number asc`,
    [season.id]
  );

  const unlocks = await query<{ unlockable_id: string }>(
    `select unlockable_id
     from public.unlocks
     where user_id = $1 and unlockable_type = 'episode'`,
    [user.id]
  );

  const unlockedIds = new Set(unlocks.map((unlock) => unlock.unlockable_id));

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">{comic.title}</div>
          <h2>{season.title}</h2>
        </div>
        <Link className="button-secondary" href={`/comics/${comic.slug}`}>
          Back to Comic
        </Link>
      </section>
      <p className="lead">{season.description}</p>

      <section className="stack">
        {episodes.map((episode) => {
          const isFirstEpisode = episode.episode_number === 1 && season.season_number === 1;
          const unlocked = isFirstEpisode || unlockedIds.has(episode.id);
          const content = (
            <>
              <h3>Episode {episode.episode_number} — {episode.title}</h3>
              <p>{episode.synopsis}</p>
              <p className="hint">{unlocked ? "Tap anywhere to read" : "Locked until the previous reflection is submitted"}</p>
            </>
          );

          return unlocked ? (
            <Link className="row-card clickable-card" href={`/comics/${comic.slug}/season/${season.season_number}/episode/${episode.episode_number}`} key={episode.id}>
              <article>{content}</article>
            </Link>
          ) : (
            <article className="row-card locked-card" key={episode.id}>
              {content}
            </article>
          );
        })}
      </section>
    </main>
  );
}
