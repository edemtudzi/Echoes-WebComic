import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function ProgressPage() {
  const user = await requireUser();

  const progress = await query<{
    id: string;
    last_page_number: number;
    completed: boolean;
    completed_at: string | null;
    updated_at: string;
    episode_title: string;
    episode_number: number;
    season_title: string;
    comic_title: string;
  }>(
    `select
       rp.id,
       rp.last_page_number,
       rp.completed,
       rp.completed_at,
       rp.updated_at,
       e.title as episode_title,
       e.episode_number,
       s.title as season_title,
       c.title as comic_title
     from public.reader_progress rp
     join public.episodes e on e.id = rp.episode_id
     join public.seasons s on s.id = rp.season_id
     join public.comics c on c.id = rp.comic_id
     where rp.user_id = $1
     order by rp.updated_at desc`,
    [user.id]
  );

  const reflections = await query<{
    id: string;
    reaction: string;
    body: string;
    moderation_status: string;
    created_at: string;
    episode_title: string;
  }>(
    `select
       r.id,
       r.reaction,
       r.body,
       r.moderation_status,
       r.created_at,
       e.title as episode_title
     from public.reflections r
     join public.episodes e on e.id = r.episode_id
     where r.user_id = $1
     order by r.created_at desc`,
    [user.id]
  );

  return (
    <main className="view">
      <section className="section-head">
        <div>
          <div className="eyebrow">Reader Progress</div>
          <h2>Your unlocked path.</h2>
        </div>
        <Link className="button-secondary" href="/library">
          Back to Library
        </Link>
      </section>

      <section className="stack">
        {progress.length ? (
          progress.map((item) => (
            <article className="row-card" key={item.id}>
              <h3>{item.episode_title}</h3>
              <p className="hint">
                Last page: {item.last_page_number} / {item.completed ? "completed" : "in progress"}
              </p>
            </article>
          ))
        ) : (
          <p className="warning">No progress yet. Start with the library.</p>
        )}
      </section>

      <section className="section-head" style={{ marginTop: 40 }}>
        <div>
          <div className="eyebrow">Reflections</div>
          <h2>What you submitted.</h2>
        </div>
      </section>

      <section className="stack">
        {reflections.length ? (
          reflections.map((reflection) => (
            <article className="row-card" key={reflection.id}>
              <h3>{reflection.episode_title}</h3>
              <p className="hint">Reaction: {reflection.reaction} / {reflection.moderation_status}</p>
              <p>{reflection.body}</p>
            </article>
          ))
        ) : (
          <p className="warning">No reflections submitted yet.</p>
        )}
      </section>
    </main>
  );
}
