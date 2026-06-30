import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function AdminComicsPage() {
  await requireAdmin();
  const comics = await query<{
    id: string;
    slug: string;
    title: string;
    status: string;
    sort_order: number;
  }>(
    `select id, slug, title, status, sort_order
     from public.comics
     order by sort_order asc, created_at asc`
  );

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">Admin / Comics</div>
          <h2>Manage comics.</h2>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link className="button" href="/admin/comics/new">
            New Comic
          </Link>
          <Link className="button-secondary" href="/admin">
            Admin Home
          </Link>
        </div>
      </section>
      <section className="stack">
        {comics.map((comic) => (
          <article className="row-card" key={comic.id}>
            <h3>{comic.title}</h3>
            <p className="hint">
              /{comic.slug} / {comic.status} / order {comic.sort_order}
            </p>
            <Link className="button-small" href={`/admin/comics/${comic.id}`}>
              Edit
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
