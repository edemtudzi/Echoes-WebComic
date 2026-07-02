import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteEpisodeCover,
  deleteEpisodePage,
  replaceEpisodePageImage,
  updatePageStatus,
  uploadEpisodeCover,
  uploadEpisodePage
} from "@/app/actions/admin";
import { BulkEpisodePageUploader } from "@/components/BulkEpisodePageUploader";
import { requireAdmin } from "@/lib/auth";
import { one, query } from "@/lib/db";

export default async function EpisodePagesAdminPage({
  params,
  searchParams
}: {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { episodeId } = await params;
  const notices = await searchParams;
  const episode = await one<{
    id: string;
    episode_number: number;
    title: string;
    synopsis: string;
    cover_image_path: string | null;
    status: string;
    season_id: string;
    season_number: number;
    season_title: string;
    comic_id: string;
    comic_slug: string;
    comic_title: string;
  }>(
    `select
       e.id,
       e.episode_number,
       e.title,
       e.synopsis,
       e.cover_image_path,
       e.status,
       s.id as season_id,
       s.season_number,
       s.title as season_title,
       c.id as comic_id,
       c.slug as comic_slug,
       c.title as comic_title
     from public.episodes e
     join public.seasons s on s.id = e.season_id
     join public.comics c on c.id = s.comic_id
     where e.id = $1`,
    [episodeId]
  );

  if (!episode) {
    notFound();
  }

  const pages = await query<{
    id: string;
    page_number: number;
    image_path: string;
    alt_text: string;
    caption: string | null;
    status: string;
    created_at: string;
  }>(
    `select id, page_number, image_path, alt_text, caption, status, created_at
     from public.pages
     where episode_id = $1
     order by page_number asc`,
    [episode.id]
  );

  const pageRows = pages.map((page) => ({
    ...page,
    imageUrl: page.image_path
  }));

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">Admin / Episode Assets & Pages</div>
          <h2>{episode.title}</h2>
        </div>
        <Link className="button-secondary" href={`/admin/comics/${episode.comic_id}`}>
          Back to Comic
        </Link>
      </section>

      {notices.error ? <p className="warning">{notices.error}</p> : null}
      {notices.saved ? <p className="warning">Saved.</p> : null}

      <section className="reader">
        <aside className="reader-side form-card">
          <div className="eyebrow">{episode.comic_title}</div>
          <h3>Episode {episode.episode_number}</h3>
          {episode.cover_image_path ? <img className="asset-preview" src={episode.cover_image_path} alt={`${episode.title} thumbnail`} /> : null}
          <p>{episode.synopsis}</p>
          <div className="asset-output-list compact">
            <div>
              <strong>Episode cover / thumbnail</strong>
              <span>{episode.cover_image_path ?? "Not uploaded"}</span>
            </div>
            <div>
              <strong>Story pages</strong>
              <span>{pageRows.length} uploaded</span>
            </div>
          </div>
          <p className="hint">
            Season {episode.season_number} / {episode.status} / {pageRows.length} page(s)
          </p>
        </aside>

        <div className="stack">
          <form className="form-card asset-upload-card" action={uploadEpisodeCover}>
            <input type="hidden" name="episodeId" value={episode.id} />
            <input type="hidden" name="comicSlug" value={episode.comic_slug} />
            <input type="hidden" name="seasonNumber" value={episode.season_number} />
            <input type="hidden" name="episodeNumber" value={episode.episode_number} />
            <h3>Upload episode cover / thumbnail</h3>
            <p className="hint">
              This becomes the episode card image. It is separate from the reader pages and will not become Panel 01.
            </p>
            <p className="hint page-path">{episode.cover_image_path ?? "No episode cover uploaded yet."}</p>
            <div className="field">
              <label htmlFor="episode-cover">Episode cover image</label>
              <input id="episode-cover" name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Upload Episode Cover
              </button>
            </div>
          </form>
          {episode.cover_image_path ? (
            <form className="form-card delete-asset-form" action={deleteEpisodeCover}>
              <input type="hidden" name="episodeId" value={episode.id} />
              <h3>Delete episode cover / thumbnail</h3>
              <p className="hint">This clears the episode card image. Reader story pages stay untouched.</p>
              <button className="button-small danger-button" type="submit">
                Delete Episode Cover
              </button>
            </form>
          ) : null}

          <BulkEpisodePageUploader
            comicSlug={episode.comic_slug}
            defaultStartPageNumber={pageRows.length + 1}
            episodeId={episode.id}
            episodeNumber={episode.episode_number}
            seasonNumber={episode.season_number}
          />

          <form className="form-card" action={uploadEpisodePage}>
            <input type="hidden" name="episodeId" value={episode.id} />
            <input type="hidden" name="comicSlug" value={episode.comic_slug} />
            <input type="hidden" name="seasonNumber" value={episode.season_number} />
            <input type="hidden" name="episodeNumber" value={episode.episode_number} />
            <h3>Upload one story page / panel</h3>
            <p className="hint">Use this for single fixes. For a full episode, use the bulk uploader above.</p>
            <div className="field">
              <label htmlFor="page_number">Page number</label>
              <input id="page_number" name="page_number" type="number" min={1} required defaultValue={pageRows.length + 1} />
            </div>
            <div className="field">
              <label htmlFor="image">Panel image</label>
              <input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
            </div>
            <div className="field">
              <label htmlFor="alt_text">Alt text</label>
              <input id="alt_text" name="alt_text" required placeholder="Kael walks through the broken world..." />
            </div>
            <div className="field">
              <label htmlFor="caption">Caption</label>
              <textarea id="caption" name="caption" />
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Upload Story Page
              </button>
            </div>
          </form>

          {pageRows.length ? (
            pageRows.map((page) => (
              <article className="row-card page-admin-card" key={page.id}>
                <div className="page-admin-head">
                  <div>
                    <div className="eyebrow">Uploaded story page</div>
                    <h3>Page {page.page_number}</h3>
                  </div>
                  <span className="tag">{page.status}</span>
                </div>
                <p className="hint page-path">{page.image_path}</p>
                <img className="page-image" src={page.imageUrl ?? ""} alt={page.alt_text || `Page ${page.page_number}`} style={{ minHeight: 260, maxHeight: 520 }} />
                {page.caption ? <p>{page.caption}</p> : null}

                <div className="page-admin-actions">
                  <form action={updatePageStatus} className="actions page-status-form">
                    <input type="hidden" name="episodeId" value={episode.id} />
                    <input type="hidden" name="pageId" value={page.id} />
                    <select name="status" defaultValue={page.status} aria-label={`Status for page ${page.page_number}`}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="hidden">Hidden</option>
                    </select>
                    <button className="button-small" type="submit">
                      Update Status
                    </button>
                  </form>

                  <form action={replaceEpisodePageImage} className="replace-page-form">
                    <input type="hidden" name="episodeId" value={episode.id} />
                    <input type="hidden" name="pageId" value={page.id} />
                    <input type="hidden" name="comicSlug" value={episode.comic_slug} />
                    <input type="hidden" name="seasonNumber" value={episode.season_number} />
                    <input type="hidden" name="episodeNumber" value={episode.episode_number} />
                    <input type="hidden" name="pageNumber" value={page.page_number} />
                    <div className="field">
                      <label htmlFor={`replacement-${page.id}`}>Replace panel image</label>
                      <input id={`replacement-${page.id}`} name="replacementImage" type="file" accept="image/png,image/jpeg,image/webp" required />
                    </div>
                    <div className="field">
                      <label htmlFor={`alt-${page.id}`}>Alt text</label>
                      <input id={`alt-${page.id}`} name="alt_text" defaultValue={page.alt_text} />
                    </div>
                    <div className="field field-wide">
                      <label htmlFor={`caption-${page.id}`}>Caption</label>
                      <textarea id={`caption-${page.id}`} name="caption" defaultValue={page.caption ?? ""} />
                    </div>
                    <button className="button-small" type="submit">
                      Replace Story Page
                    </button>
                  </form>

                  <form action={deleteEpisodePage} className="delete-page-form">
                    <input type="hidden" name="episodeId" value={episode.id} />
                    <input type="hidden" name="pageId" value={page.id} />
                    <p className="hint">Delete this uploaded story page without uploading a replacement.</p>
                    <button className="button-small danger-button" type="submit">
                      Delete Story Page
                    </button>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <div className="placeholder-page">
              <div>
                <div className="eyebrow">No Pages Yet</div>
                <h3>Upload the first comic page.</h3>
                <p>Once pages are published, readers will see them in the episode reader.</p>
              </div>
            </div>
          )}
        </div>
      </section>
      <style>{`
        .page-admin-card{display:grid;gap:12px}.page-admin-head{display:flex;align-items:start;justify-content:space-between;gap:12px}.page-admin-head h3{margin-bottom:0}.page-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.page-admin-actions{display:grid;gap:10px}.page-status-form{margin-top:0}.replace-page-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:end;padding:12px;border:1px solid rgba(9,9,9,.12);border-radius:18px;background:rgba(255,254,248,.68)}.replace-page-form .field{margin-top:0}.replace-page-form textarea{min-height:64px}.replace-page-form button{justify-self:start}.delete-page-form{display:grid;gap:8px;justify-items:start;padding:12px;border:1px solid rgba(121,28,28,.22);border-radius:18px;background:rgba(255,246,242,.74)}.delete-page-form p{margin:0}.field-wide{grid-column:1/-1}@media(max-width:760px){.replace-page-form{grid-template-columns:1fr}.page-admin-head{align-items:start}.page-path{white-space:normal;word-break:break-word}}
      `}</style>
    </main>
  );
}
