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

  const seasonEpisodes = await query<{
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
  const isFirstEpisode = episode.episode_number === 1 && season.season_number === 1;
  const unlock = unlockedIds.has(episode.id);
  const canRead = isFirstEpisode || unlock;
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
    <main className="view episode-reader-view">
      <section className="section-head episode-head">
        <div>
          <div className="eyebrow">{comic.title} / {season.title}</div>
          <h2>Episode {episode.episode_number} — {episode.title}</h2>
        </div>
        <details className="episode-list-drawer">
          <summary className="button-secondary">Episode List</summary>
          <aside className="episode-list-panel" aria-label="Episode list">
            <div className="episode-list-header">
              <div>
                <div className="eyebrow">Season {season.season_number}</div>
                <h3>{season.title}</h3>
              </div>
              <span>{seasonEpisodes.length} episode(s)</span>
            </div>
            <div className="episode-list-items">
              {seasonEpisodes.map((item) => {
                const itemIsFirst = item.episode_number === 1 && season.season_number === 1;
                const itemUnlocked = itemIsFirst || unlockedIds.has(item.id);
                const itemCurrent = item.id === episode.id;
                const itemPath = `/comics/${comic.slug}/season/${season.season_number}/episode/${item.episode_number}`;

                return itemUnlocked ? (
                  <Link className={`episode-list-item${itemCurrent ? " current" : ""}`} href={itemPath} key={item.id}>
                    <strong>Episode {item.episode_number} — {item.title}</strong>
                    <small>{itemCurrent ? "Now reading" : "Open episode"}</small>
                  </Link>
                ) : (
                  <div className="episode-list-item locked" key={item.id}>
                    <strong>Episode {item.episode_number} — {item.title}</strong>
                    <small>Locked</small>
                  </div>
                );
              })}
            </div>
          </aside>
        </details>
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
        <section className="reader expanded-reader">
          <div className="reader-meta-strip">
            <div>
              <div className="eyebrow">Now Reading</div>
              <h3>{episode.title}</h3>
            </div>
            <p>{episode.synopsis}</p>
            <span>{publicPages.length || "No"} published page(s)</span>
          </div>

          <div className="comic-page expanded-comic-page">
            {publicPages.length ? (
              publicPages.map((page) => (
                <figure key={page.id} className="comic-page-frame">
                  <img className="page-image expanded-page-image" src={page.imageUrl ?? ""} alt={page.alt_text || `Page ${page.page_number}`} />
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

      <style>{`
        .episode-reader-view {
          width: min(1480px, calc(100% - 32px));
        }

        .episode-head {
          overflow: visible;
        }

        .episode-list-drawer {
          position: relative;
          z-index: 30;
        }

        .episode-list-drawer summary {
          list-style: none;
        }

        .episode-list-drawer summary::-webkit-details-marker {
          display: none;
        }

        .episode-list-panel {
          position: absolute;
          top: calc(100% + 14px);
          right: 0;
          width: min(390px, calc(100vw - 32px));
          max-height: min(68vh, 620px);
          overflow: auto;
          padding: 16px;
          border: 1.5px solid rgba(9, 9, 9, .16);
          border-radius: 28px;
          background: rgba(255, 254, 248, .96);
          box-shadow: 0 24px 70px rgba(0, 0, 0, .18), inset 0 1px 0 rgba(255, 255, 255, .86);
          backdrop-filter: blur(22px);
        }

        .episode-list-header {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .episode-list-header h3 {
          margin: 0;
        }

        .episode-list-header span {
          white-space: nowrap;
          color: var(--ink);
          border: 1px solid rgba(9, 9, 9, .58);
          border-radius: 999px;
          background: var(--yellow-soft);
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 900;
        }

        .episode-list-items {
          display: grid;
          gap: 10px;
        }

        .episode-list-item {
          display: grid;
          gap: 6px;
          padding: 14px;
          border: 1px solid rgba(9, 9, 9, .12);
          border-radius: 20px;
          background: rgba(247, 245, 235, .82);
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .episode-list-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, .10);
        }

        .episode-list-item.current {
          background: var(--yellow-soft);
          border-color: rgba(9, 9, 9, .36);
        }

        .episode-list-item.locked {
          opacity: .62;
        }

        .episode-list-item strong {
          line-height: 1.15;
        }

        .episode-list-item small {
          color: var(--muted);
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .expanded-reader {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }

        .reader-meta-strip {
          display: grid;
          grid-template-columns: minmax(220px, .7fr) minmax(260px, 1.4fr) auto;
          align-items: center;
          gap: 18px;
          padding: 16px 20px;
          border: 1.5px solid rgba(9, 9, 9, .14);
          border-radius: 28px;
          background: rgba(255, 254, 248, .78);
          box-shadow: 0 14px 34px rgba(0, 0, 0, .08), inset 0 1px 0 rgba(255, 255, 255, .82);
        }

        .reader-meta-strip h3,
        .reader-meta-strip p {
          margin: 0;
        }

        .reader-meta-strip p {
          color: var(--muted);
        }

        .reader-meta-strip span {
          justify-self: end;
          white-space: nowrap;
          color: var(--ink);
          border: 1px solid rgba(9, 9, 9, .58);
          border-radius: 999px;
          background: var(--yellow-soft);
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
        }

        .expanded-comic-page {
          width: 100%;
          padding: clamp(14px, 2vw, 24px);
        }

        .comic-page-frame {
          margin: 0;
          width: 100%;
        }

        .expanded-page-image {
          display: block;
          width: 100%;
          height: auto;
          min-height: 0;
          object-fit: contain;
        }

        @media (max-width: 860px) {
          .reader-meta-strip {
            grid-template-columns: 1fr;
            align-items: start;
          }

          .reader-meta-strip span {
            justify-self: start;
          }
        }

        @media (max-width: 640px) {
          .episode-reader-view {
            width: min(100% - 18px, 1480px);
          }

          .episode-list-panel {
            position: fixed;
            left: 10px;
            right: 10px;
            top: 132px;
            width: auto;
            max-height: calc(100vh - 152px);
          }

          .reader-meta-strip {
            border-radius: 24px;
            padding: 14px;
          }

          .expanded-comic-page {
            padding: 10px;
          }
        }
      `}</style>
    </main>
  );
}
