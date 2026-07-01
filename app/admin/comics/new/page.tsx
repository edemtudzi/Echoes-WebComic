import Link from "next/link";
import { createComic } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";

export default async function NewComicPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  return (
    <main className="view">
      <section className="section-head compact-head">
        <div>
          <div className="eyebrow">Admin / New Comic</div>
          <h2>Create comic.</h2>
          <p>Set up the series and optionally upload its first season, episode, and page in one pass.</p>
        </div>
        <Link className="button-secondary" href="/admin/comics">
          Back to Comics
        </Link>
      </section>

      <form className="form-card compact-form" action={createComic} encType="multipart/form-data">
        {error ? <p className="warning">{error}</p> : null}

        <section className="form-section">
          <div className="form-section-head">
            <div>
              <div className="eyebrow">Series</div>
              <h3>Comic details</h3>
            </div>
            <span className="tag">Required</span>
          </div>
          <div className="compact-fields two-column-fields">
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" required placeholder="Echoes of the Source" />
            </div>
            <div className="field">
              <label htmlFor="slug">Slug</label>
              <input id="slug" name="slug" placeholder="echoes-of-the-source" />
              <span className="hint">Leave blank to generate from title.</span>
            </div>
            <div className="field">
              <label htmlFor="subtitle">Subtitle</label>
              <input id="subtitle" name="subtitle" placeholder="A cinematic salvation allegory" />
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="sort_order">Sort order</label>
              <input id="sort_order" name="sort_order" type="number" defaultValue={0} />
            </div>
            <div className="field field-wide">
              <label htmlFor="description">Description</label>
              <textarea id="description" name="description" required />
            </div>
          </div>
        </section>

        <section className="form-section starter-upload-section">
          <div className="form-section-head">
            <div>
              <div className="eyebrow">Starter Content</div>
              <h3>Upload first page while creating the series</h3>
            </div>
            <span className="tag">Optional</span>
          </div>
          <p className="hint">
            Add an image here to create the first season, first episode, and first comic page immediately.
          </p>

          <div className="compact-fields three-column-fields">
            <div className="field">
              <label htmlFor="first_season_number">Season number</label>
              <input id="first_season_number" name="first_season_number" type="number" min={1} defaultValue={1} />
            </div>
            <div className="field">
              <label htmlFor="first_season_title">Season title</label>
              <input id="first_season_title" name="first_season_title" placeholder="Season 1" />
            </div>
            <div className="field">
              <label htmlFor="first_season_status">Season status</label>
              <select id="first_season_status" name="first_season_status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="field field-wide">
              <label htmlFor="first_season_description">Season description</label>
              <textarea id="first_season_description" name="first_season_description" placeholder="Optional season setup." />
            </div>
          </div>

          <div className="compact-fields three-column-fields">
            <div className="field">
              <label htmlFor="first_episode_number">Episode number</label>
              <input id="first_episode_number" name="first_episode_number" type="number" min={1} defaultValue={1} />
            </div>
            <div className="field">
              <label htmlFor="first_episode_title">Episode title</label>
              <input id="first_episode_title" name="first_episode_title" placeholder="Episode 1" />
            </div>
            <div className="field">
              <label htmlFor="first_episode_status">Episode status</label>
              <select id="first_episode_status" name="first_episode_status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="field field-check">
              <label htmlFor="first_requires_reflection">
                <input id="first_requires_reflection" name="first_requires_reflection" type="checkbox" defaultChecked />
                Require reflection to unlock next episode
              </label>
            </div>
            <div className="field field-wide">
              <label htmlFor="first_episode_synopsis">Episode synopsis</label>
              <textarea id="first_episode_synopsis" name="first_episode_synopsis" placeholder="Optional episode summary." />
            </div>
          </div>

          <div className="compact-fields three-column-fields">
            <div className="field">
              <label htmlFor="first_page_number">Page number</label>
              <input id="first_page_number" name="first_page_number" type="number" min={1} defaultValue={1} />
            </div>
            <div className="field">
              <label htmlFor="first_page_status">Page status</label>
              <select id="first_page_status" name="first_page_status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div className="field field-wide">
              <label htmlFor="first_page_image">Comic page image</label>
              <input id="first_page_image" name="first_page_image" type="file" accept="image/*" />
              <span className="hint">Cloudinary upload. Leave blank to create the series only.</span>
            </div>
            <div className="field">
              <label htmlFor="first_page_alt_text">Alt text</label>
              <input id="first_page_alt_text" name="first_page_alt_text" placeholder="Describe the page for accessibility" />
            </div>
            <div className="field field-wide">
              <label htmlFor="first_page_caption">Caption</label>
              <textarea id="first_page_caption" name="first_page_caption" placeholder="Optional caption or production note." />
            </div>
          </div>
        </section>

        <div className="actions">
          <button className="button" type="submit">
            Create Comic
          </button>
        </div>
      </form>
    </main>
  );
}
