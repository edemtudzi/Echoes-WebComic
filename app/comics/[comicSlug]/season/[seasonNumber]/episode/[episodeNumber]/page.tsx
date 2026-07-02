import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { EpisodeListDrawer } from "@/components/EpisodeListDrawer";
import { ReaderProgressDock } from "@/components/ReaderProgressDock";
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
        <EpisodeListDrawer
          comicSlug={comic.slug}
          currentEpisodeId={episode.id}
          episodes={seasonEpisodes}
          seasonNumber={season.season_number}
          seasonTitle={season.title}
          unlockedEpisodeIds={[...unlockedIds]}
        />
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
              publicPages.map((page, index) => (
                <figure
                  id={`episode-page-${page.page_number}`}
                  key={page.id}
                  className="comic-page-frame"
                  data-reader-panel={index}
                  data-reader-page-number={page.page_number}
                >
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

          <ReaderProgressDock totalPages={publicPages.length} />
        </section>
      )}

      <style>{`
        :global(html:has(.episode-reader-view)) {
          scroll-behavior: smooth;
        }

        .episode-reader-view {
          width: min(1180px, calc(100% - 32px));
          padding-top: clamp(82px, 7vw, 108px);
        }

        .episode-head {
          overflow: visible;
          margin-bottom: 14px;
        }

        .episode-head h2 {
          font-size: clamp(30px, 5vw, 56px);
          letter-spacing: -.06em;
        }

        .episode-list-drawer {
          position: relative;
          z-index: 30;
        }

        .episode-list-toggle {
          position: relative;
          z-index: 2;
        }

        .episode-list-scrim {
          position: fixed;
          inset: 0;
          z-index: 1;
          border: 0;
          background: transparent;
          cursor: default;
          appearance: none;
        }

        .episode-list-panel {
          position: absolute;
          z-index: 2;
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
          gap: 14px;
        }

        .reader-meta-strip {
          display: grid;
          grid-template-columns: minmax(180px, .62fr) minmax(240px, 1.35fr) auto;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          border: 1.5px solid rgba(9, 9, 9, .14);
          border-radius: 24px;
          background: rgba(255, 254, 248, .78);
          box-shadow: 0 14px 34px rgba(0, 0, 0, .08), inset 0 1px 0 rgba(255, 255, 255, .82);
        }

        .reader-meta-strip h3,
        .reader-meta-strip p {
          margin: 0;
        }

        .reader-meta-strip h3 {
          font-size: clamp(18px, 2vw, 24px);
        }

        .reader-meta-strip p {
          color: var(--muted);
          font-size: 15px;
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
          width: min(100%, 980px);
          margin-inline: auto;
          padding: clamp(10px, 1.6vw, 18px);
          border-radius: 34px;
          background: #070707;
          box-shadow: 0 26px 80px rgba(0, 0, 0, .22);
        }

        .comic-page-frame {
          display: grid;
          justify-items: center;
          gap: 8px;
          width: 100%;
          margin: 0 0 clamp(14px, 2.2vw, 26px);
          content-visibility: auto;
          contain-intrinsic-size: 760px;
          scroll-margin-top: 118px;
        }

        .expanded-page-image {
          display: block;
          width: auto;
          max-width: 100%;
          max-height: min(82svh, 920px);
          height: auto;
          object-fit: contain;
          border-radius: 18px;
          background: #111;
          box-shadow: 0 10px 34px rgba(0, 0, 0, .24);
        }

        .comic-page-frame figcaption {
          width: min(100%, 760px);
          color: rgba(255, 253, 247, .76);
          text-align: center;
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
          :global(html:has(.episode-reader-view)) {
            scroll-snap-type: y proximity;
            background: #070707;
          }

          .episode-reader-view {
            width: 100%;
            padding-top: 86px;
          }

          .episode-head {
            position: sticky;
            top: 76px;
            z-index: 34;
            width: calc(100% - 18px);
            margin: 0 auto 8px;
            padding: 12px 14px !important;
            border-radius: 24px !important;
            background: rgba(255, 254, 248, .88) !important;
            backdrop-filter: blur(18px);
          }

          .episode-head h2 {
            font-size: clamp(23px, 7vw, 32px);
          }

          .episode-list-panel {
            position: fixed;
            left: 10px;
            right: 10px;
            top: 132px;
            width: auto;
            max-height: calc(100vh - 152px);
          }

          .expanded-reader {
            gap: 8px;
          }

          .reader-meta-strip {
            width: calc(100% - 18px);
            margin-inline: auto;
            border-radius: 22px;
            padding: 11px 12px;
          }

          .reader-meta-strip p {
            display: none;
          }

          .expanded-comic-page {
            width: 100%;
            margin: 0;
            padding: 0 0 96px;
            border-radius: 0;
            box-shadow: none;
          }

          .comic-page-frame {
            min-height: calc(100svh - 106px);
            margin: 0;
            padding: 10px 8px 14px;
            align-content: center;
            scroll-snap-align: start;
            scroll-margin-top: 106px;
          }

          .expanded-page-image {
            max-width: 100%;
            max-height: calc(100svh - 128px);
            border-radius: 14px;
            box-shadow: 0 18px 42px rgba(0, 0, 0, .36);
          }

          .comic-page-frame figcaption {
            padding-inline: 10px;
            font-size: 12px;
          }
        }
      `}</style>
    </main>
  );
}
