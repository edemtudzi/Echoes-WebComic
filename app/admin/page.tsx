import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h2>Production control.</h2>
        </div>
        <Link className="button-secondary" href="/library">
          Reader View
        </Link>
      </section>

      <section className="grid">
        <article className="card">
          <div className="cover" aria-hidden="true" />
          <div className="card-body">
            <h3>Comics</h3>
            <p>Create and manage comics, seasons, and episodes.</p>
            <Link className="button" href="/admin/comics">
              Manage Comics
            </Link>
          </div>
        </article>
        <article className="card">
          <div className="cover" aria-hidden="true" />
          <div className="card-body">
            <h3>Pages</h3>
            <p>Upload and reorder comic pages. This gets built next.</p>
            <button className="button-small" disabled>
              Coming Next
            </button>
          </div>
        </article>
        <article className="card">
          <div className="cover" aria-hidden="true" />
          <div className="card-body">
            <h3>Reflections</h3>
            <p>Review reader reflections and spot weak engagement.</p>
            <button className="button-small" disabled>
              Coming Next
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}
