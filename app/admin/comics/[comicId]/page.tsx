import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createEpisode,
  createSeason,
  deleteComicAsset,
  deleteSeasonCover,
  updateComic,
  uploadComicAsset,
  uploadSeasonCover
} from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { one, query } from "@/lib/db";

export default async function EditComicPage({
  params,
  searchParams
}: {
  params: Promise<{ comicId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { comicId } = await params;
  const notices = await searchParams;
  const comic = await one<{
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string;
    cover_image_path: string | null;
    now_streaming_image_path: string | null;
    series_poster_image_path: string | null;
    status: string;
    sort_order: number;
  }>(
    `select
       id,
       slug,
       title,
       subtitle,
       description,
       cover_image_path,
       now_streaming_image_path,
       series_poster_image_path,
       status,
       sort_order
     from public.comics
     where id = $1`,
    [comicId]
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

  const episodes = seasons.length
    ? await query<{
        id: string;
        season_id: string;
        episode_number: number;
        title: string;
        cover_image_path: string | null;
        status: string;
      }>(
        `select id, season_id, episode_number, title, cover_image_path, status
         from public.episodes
         where season_id = any($1::uuid[])
         order by episode_number asc`,
        [seasons.map((season) => season.id)]
      )
    : [];

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">Admin / Edit Comic</div>
          <h2>{comic.title}</h2>
        </div>
        <Link className="button-secondary" href="/admin/comics">
          Back to Comics
        </Link>
      </section>

      {notices.error ? <p className="warning">{notices.error}</p> : null}
      {notices.saved ? <p className="warning">Saved.</p> : null}

      <form className="form-card" action={updateComic}>
        <input type="hidden" name="comicId" value={comic.id} />
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" required defaultValue={comic.title} />
        </div>
        <div className="field">
          <label htmlFor="slug">Slug</label>
          <input id="slug" name="slug" required defaultValue={comic.slug} />
        </div>
        <div className="field">
          <label htmlFor="subtitle">Subtitle</label>
          <input id="subtitle" name="subtitle" defaultValue={comic.subtitle ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" required defaultValue={comic.description} />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={comic.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort_order">Sort order</label>
          <input id="sort_order" name="sort_order" type="number" defaultValue={comic.sort_order} />
        </div>
        <div className="actions">
          <button className="button" type="submit">
            Save Comic
          </button>
        </div>
      </form>

      <section className="section-head" style={{ marginTop: 34 }}>
        <div>
          <div className="eyebrow">Series Assets</div>
          <h2>Upload public images.</h2>
        </div>
        <p>Use landscape 16:9 for series poster and season cover. Use portrait only for cards, thumbnails, and now-streaming poster art.</p>
      </section>

      <section className="form-card asset-output-card">
        <div className="eyebrow">Current Series: Echoes of the Source</div>
        <h3>Current asset outputs</h3>
        <div className="asset-output-list">
          <div>
            <strong>Series cover / library card</strong>
            <span>{comic.cover_image_path ?? "Not uploaded"}</span>
          </div>
          <div>
            <strong>Now streaming poster</strong>
            <span>{comic.now_streaming_image_path ?? "Not uploaded"}</span>
          </div>
          <div>
            <strong>Series poster / promo art</strong>
            <span>{comic.series_poster_image_path ?? "Not uploaded"}</span>
          </div>
          <div>
            <strong>Season cover</strong>
            <span>{seasons.find((season) => season.cover_image_path)?.cover_image_path ?? "Not uploaded"}</span>
          </div>
          <div>
            <strong>Episode cover / thumbnail</strong>
            <span>{episodes.find((episode) => episode.cover_image_path)?.cover_image_path ?? "Not uploaded"}</span>
          </div>
        </div>
      </section>

      <section className="asset-grid">
        <article className="form-card asset-card">
          <h3>Series cover / library card</h3>
          {comic.cover_image_path ? <img className="asset-preview" src={comic.cover_image_path} alt={`${comic.title} cover`} /> : null}
          <p className="hint image-path">{comic.cover_image_path ?? "No cover uploaded yet."}</p>
          <form action={uploadComicAsset}>
            <input type="hidden" name="comicId" value={comic.id} />
            <input type="hidden" name="comicSlug" value={comic.slug} />
            <input type="hidden" name="assetType" value="cover" />
            <div className="field">
              <label htmlFor="comic-cover">Cover image</label>
              <input id="comic-cover" name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
              <span className="asset-format-note">Recommended: portrait 4:5 or 2:3. Keep title readable at small card size.</span>
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Upload Cover
              </button>
            </div>
          </form>
          {comic.cover_image_path ? (
            <form className="delete-asset-form" action={deleteComicAsset}>
              <input type="hidden" name="comicId" value={comic.id} />
              <input type="hidden" name="assetType" value="cover" />
              <button className="button-small danger-button" type="submit">
                Delete Cover
              </button>
            </form>
          ) : null}
        </article>

        <article className="form-card asset-card">
          <h3>Now streaming poster</h3>
          {comic.now_streaming_image_path ? <img className="asset-preview" src={comic.now_streaming_image_path} alt={`${comic.title} now streaming poster`} /> : null}
          <p className="hint image-path">{comic.now_streaming_image_path ?? "No now streaming poster uploaded yet."}</p>
          <form action={uploadComicAsset}>
            <input type="hidden" name="comicId" value={comic.id} />
            <input type="hidden" name="comicSlug" value={comic.slug} />
            <input type="hidden" name="assetType" value="now_streaming" />
            <div className="field">
              <label htmlFor="now-streaming-poster">Poster image</label>
              <input id="now-streaming-poster" name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
              <span className="asset-format-note">Recommended: portrait 9:16. This is the vertical promotional poster.</span>
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Upload Poster
              </button>
            </div>
          </form>
          {comic.now_streaming_image_path ? (
            <form className="delete-asset-form" action={deleteComicAsset}>
              <input type="hidden" name="comicId" value={comic.id} />
              <input type="hidden" name="assetType" value="now_streaming" />
              <button className="button-small danger-button" type="submit">
                Delete Poster
              </button>
            </form>
          ) : null}
        </article>

        <article className="form-card asset-card">
          <h3>Series poster / promo art</h3>
          {comic.series_poster_image_path ? <img className="asset-preview landscape-preview" src={comic.series_poster_image_path} alt={`${comic.title} series poster`} /> : null}
          <p className="hint image-path">{comic.series_poster_image_path ?? "No series poster uploaded yet."}</p>
          <form action={uploadComicAsset}>
            <input type="hidden" name="comicId" value={comic.id} />
            <input type="hidden" name="comicSlug" value={comic.slug} />
            <input type="hidden" name="assetType" value="series_poster" />
            <div className="field">
              <label htmlFor="series-poster">Landscape promo image</label>
              <input id="series-poster" name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
              <span className="asset-format-note">Required for clean desktop: landscape 16:9, ideally 1920×1080 or 2400×1350. Keep important faces and text inside the center safe area.</span>
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Upload Series Poster
              </button>
            </div>
          </form>
          {comic.series_poster_image_path ? (
            <form className="delete-asset-form" action={deleteComicAsset}>
              <input type="hidden" name="comicId" value={comic.id} />
              <input type="hidden" name="assetType" value="series_poster" />
              <button className="button-small danger-button" type="submit">
                Delete Series Poster
              </button>
            </form>
          ) : null}
        </article>
      </section>

      <section className="section-head" style={{ marginTop: 46 }}>
        <div>
          <div className="eyebrow">Seasons</div>
          <h2>Build structure.</h2>
        </div>
      </section>

      <section className="stack">
        {seasons.map((season) => (
          <article className="row-card" key={season.id}>
            <div className="media-row">
              {season.cover_image_path ? <img className="media-thumb landscape-thumb" src={season.cover_image_path} alt={`${season.title} cover`} /> : null}
              <div>
                <h3>Season {season.season_number} — {season.title}</h3>
                <p className="hint">{season.status}</p>
                <p>{season.description}</p>
              </div>
            </div>

            <form className="page-edit-grid" action={uploadSeasonCover}>
              <input type="hidden" name="comicId" value={comic.id} />
              <input type="hidden" name="seasonId" value={season.id} />
              <input type="hidden" name="comicSlug" value={comic.slug} />
              <input type="hidden" name="seasonNumber" value={season.season_number} />
              <div className="field page-edit-wide">
                <label htmlFor={`season-cover-${season.id}`}>Season cover</label>
                <input id={`season-cover-${season.id}`} name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
                <span className="asset-format-note">Required for clean desktop: landscape 16:9, ideally 1920×1080 or 2400×1350.</span>
                <span className="hint image-path">{season.cover_image_path ?? "No season cover uploaded yet."}</span>
              </div>
              <div className="actions page-edit-wide">
                <button className="button-small" type="submit">
                  Upload Season Cover
                </button>
              </div>
            </form>
            {season.cover_image_path ? (
              <form className="delete-asset-form" action={deleteSeasonCover}>
                <input type="hidden" name="comicId" value={comic.id} />
                <input type="hidden" name="seasonId" value={season.id} />
                <button className="button-small danger-button" type="submit">
                  Delete Season Cover
                </button>
              </form>
            ) : null}

            <div className="stack">
              {episodes
                .filter((episode) => episode.season_id === season.id)
                .map((episode) => (
                  <div className="row-card" key={episode.id} style={{ background: "var(--surface)" }}>
                    <div className="media-row">
                      {episode.cover_image_path ? <img className="media-thumb small" src={episode.cover_image_path} alt={`${episode.title} thumbnail`} /> : null}
                      <div>
                        <h3>Episode {episode.episode_number} — {episode.title}</h3>
                        <p className="hint">
                          {episode.status} / {episode.cover_image_path ? "thumbnail uploaded" : "no thumbnail yet"}
                        </p>
                      </div>
                    </div>
                    <Link className="button-small" href={`/admin/episodes/${episode.id}/pages`}>
                      Manage Episode Assets & Pages
                    </Link>
                  </div>
                ))}
            </div>

            <form className="form-card" action={createEpisode} style={{ marginTop: 16 }}>
              <input type="hidden" name="comicId" value={comic.id} />
              <input type="hidden" name="seasonId" value={season.id} />
              <h3>Add episode</h3>
              <div className="field">
                <label htmlFor={`episode-number-${season.id}`}>Episode number</label>
                <input id={`episode-number-${season.id}`} name="episode_number" type="number" min={1} required />
              </div>
              <div className="field">
                <label htmlFor={`episode-title-${season.id}`}>Title</label>
                <input id={`episode-title-${season.id}`} name="title" required />
              </div>
              <div className="field">
                <label htmlFor={`episode-synopsis-${season.id}`}>Synopsis</label>
                <textarea id={`episode-synopsis-${season.id}`} name="synopsis" />
              </div>
              <div className="field">
                <label htmlFor={`episode-status-${season.id}`}>Status</label>
                <select id={`episode-status-${season.id}`} name="status" defaultValue="draft">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="locked">Locked</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <label className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input name="requires_reflection" type="checkbox" defaultChecked style={{ width: "auto" }} />
                Requires reflection
              </label>
              <div className="actions">
                <button className="button" type="submit">
                  Create Episode
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>

      <form className="form-card" action={createSeason} style={{ marginTop: 24 }}>
        <input type="hidden" name="comicId" value={comic.id} />
        <h3>Add season</h3>
        <div className="field">
          <label htmlFor="season_number">Season number</label>
          <input id="season_number" name="season_number" type="number" min={1} required />
        </div>
        <div className="field">
          <label htmlFor="season_title">Title</label>
          <input id="season_title" name="title" required />
        </div>
        <div className="field">
          <label htmlFor="season_description">Description</label>
          <textarea id="season_description" name="description" />
        </div>
        <div className="field">
          <label htmlFor="season_status">Status</label>
          <select id="season_status" name="status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="locked">Locked</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="actions">
          <button className="button" type="submit">
            Create Season
          </button>
        </div>
      </form>
    </main>
  );
}
