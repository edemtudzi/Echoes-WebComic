import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function LibraryPage() {
  await requireUser();
  const comics = await query<{
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string;
  }>(
    `select id, slug, title, subtitle, description
     from public.comics
     where status = 'published'
     order by sort_order asc, created_at asc`
  );

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">Comic Library</div>
          <h2>Choose what to read.</h2>
        </div>
        <p>Only published comics appear here. Admins can add more later, but the pilot should prove Echoes first.</p>
      </section>
      <section className="grid">
        {comics.map((comic) => (
          <article className="card" key={comic.id}>
            <div className="cover" aria-hidden="true" />
            <div className="card-body">
              <h3>{comic.title}</h3>
              <p className="hint">{comic.subtitle}</p>
              <p>{comic.description}</p>
              <div className="tag-row">
                <span className="tag">Cinematic</span>
                <span className="tag">Allegory</span>
              </div>
              <Link className="button" href={`/comics/${comic.slug}`}>
                Open Comic
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
