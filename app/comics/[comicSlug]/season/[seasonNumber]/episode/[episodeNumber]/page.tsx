import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { ReflectionForm } from "@/components/ReflectionForm";

export default async function EpisodePage({
  params,
  searchParams
}: {
  params: Promise<{ comicSlug: string; seasonNumber: string; episodeNumber: string }>;
  searchParams: Promise<{ error?: string; unlocked?: string }>;
}) {
  const user = await requireUser();
  const { comicSlug, seasonNumber, episodeNumber } = await params;
  const notices = await searchParams;
  const comic = await one<{ id: string; slug: string; title: string }>(
    `select id, slug, title
     from public.comics
     where slug = $1 and status = 'published'`,
    [comicSlug]
  );

  if (!comic) {
    notFound();
  }

  const season = await one<{ id: string; season_number: number; title: string }>(
    `select id, season_number, title
     from public.seasons
     where comic_id = $1 and season_number = $2`,
    [comic.id, Number(seasonNumber)]
  );

  if (!season) {
    notFound();
  }

  const episode = await one<{
    id: string;
    episode_number: number;
    title: string;
    synopsis: string;
  }>(
    `select id, episode_number, title, synopsis
     from public.episodes
     where season_id = $1 and episode_number = $2`,
    [season.id, Number(episodeNumber)]
  );

  if (!episode) {
    notFound();
  }

  const isFirstEpisode = episode.episode_number === 1 && season.season_number === 1;
  const unlock = await one<{ id: string }>(
    `select id
     from public.unlocks
     where user_id = $1
       and unlockable_type = 'episode'
       and unlockable_id = $2`,
    [user.id, episode.id]
  );

  const canRead = isFirstEpisode || Boolean(unlock);
  const returnPath = `/comics/${comic.slug}/season/${season.season_number}/episode/${episode.episode_number}`;

  if (canRead) {
    await query(
      `insert into public.reader_progress (
         user_id,
         comic_id,
         season_id,
         episode_id,
         last_page_number
       )
       values ($1, $2, $3, $4, 1)
       on conflict (user_id, episode_id)
       do update set
         last_page_number = greatest(public.reader_progress.last_page_number, 1),
         updated_at = now()`,
      [user.id, comic.id, season.id, episode.id]
    );
  }

  const pages = canRead
    ? await query<{
        id: string;
        page_number: number;
        image_path: string;
        alt_text: string;
        caption: string | null;
      }>(
        `select id, page_number, image_path, alt_text, caption
         from public.pages
         where episode_id = $1 and status = 'published'
         order by page_number asc`,
        [episode.id]
      )
    : [];

  const publicPages = pages.map((page) => ({
    ...page,
    imageUrl: page.image_path
  }));

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">{comic.title} / {season.title}</div>
          <h2>Episode {episode.episode_number} — {episode.title}</h2>
        </div>
        <Link className="button-secondary" href={`/comics/${comic.slug}/season/${season.season_number}`}>
          Episode List
        </Link>
      </section>

      {notices.error ? <p className="warning">{notices.error}</p> : null}
      {notices.unlocked ? <p className="warning">Reflection received. The next episode is now unlocked.</p> : null}

      {!canRead ? (
        <section className="placeholder-page">
          <div>
            <div className="eyebrow">Locked Episode</div>
            <h3>This episode is not available yet.</h3>
            <p>Finish the previous episode and submit a reflection to unlock this one.</p>
          </div>
        </section>
      ) : (
        <section className="reader">
          <aside className="reader-side form-card">
            <div className="eyebrow">Now Reading</div>
            <h3>{episode.title}</h3>
            <p>{episode.synopsis}</p>
            <p className="hint">{publicPages.length || "No"} published page(s)</p>
          </aside>

          <div className="comic-page">
            {publicPages.length ? (
              publicPages.map((page) => (
                <figure key={page.id} style={{ margin: 0 }}>
                  <img className="page-image" src={page.imageUrl ?? ""} alt={page.alt_text || `Page ${page.page_number}`} />
                  {page.caption ? <figcaption className="hint">{page.caption}</figcaption> : null}
                </figure>
              ))
            ) : (
              <div className="placeholder-page">
                <div>
                  <div className="eyebrow">Pages Needed</div>
                  <h3>No comic pages have been uploaded yet.</h3>
                  <p>This is expected until Episode 1 artwork is generated and uploaded through the admin system.</p>
                </div>
              </div>
            )}

            <ReflectionForm episodeId={episode.id} returnPath={returnPath} />
          </div>
        </section>
      )}
    </main>
  );
}
