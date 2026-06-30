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
      <section className="section-head">
        <div>
          <div className="eyebrow">Admin / New Comic</div>
          <h2>Create comic.</h2>
        </div>
        <Link className="button-secondary" href="/admin/comics">
          Back to Comics
        </Link>
      </section>

      <form className="form-card" action={createComic}>
        {error ? <p className="warning">{error}</p> : null}
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
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" required />
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
        <div className="actions">
          <button className="button" type="submit">
            Create Comic
          </button>
        </div>
      </form>
    </main>
  );
}
