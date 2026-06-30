import Link from "next/link";
import { notFound } from "next/navigation";
import { createEpisode, createSeason, updateComic } from "@/app/actions/admin";
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
    status: string;
    sort_order: number;
  }>(
    `select id, slug, title, subtitle, description, status, sort_order
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
    status: string;
  }>(
    `select id, season_number, title, description, status
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
        status: string;
      }>(
        `select id, season_id, episode_number, title, status
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

      <section className="section-head" style={{ marginTop: 46 }}>
        <div>
          <div className="eyebrow">Seasons</div>
          <h2>Build structure.</h2>
        </div>
      </section>

      <section className="stack">
        {seasons.map((season) => (
          <article className="row-card" key={season.id}>
            <h3>Season {season.season_number} — {season.title}</h3>
            <p className="hint">{season.status}</p>
            <p>{season.description}</p>
            <div className="stack">
              {episodes
                .filter((episode) => episode.season_id === season.id)
                .map((episode) => (
                  <div className="row-card" key={episode.id} style={{ background: "var(--surface)" }}>
                    <h3>Episode {episode.episode_number} — {episode.title}</h3>
                    <p className="hint">{episode.status}</p>
                    <Link className="button-small" href={`/admin/episodes/${episode.id}/pages`}>
                      Manage Pages
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
