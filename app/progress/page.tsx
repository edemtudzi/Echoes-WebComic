import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type CountRow = Record<string, string>;

type ProgressRow = {
  id: string;
  last_page_number: number;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
  episode_title: string;
  episode_number: number;
  season_title: string;
  comic_title: string;
};

type ReflectionRow = {
  id: string;
  reaction: string;
  body: string;
  moderation_status: string;
  created_at: string;
  episode_title: string;
};

const reactionIcons: Record<string, string> = {
  moved: "Heart",
  curious: "Question",
  disturbed: "Alert",
  confused: "Wave",
  inspired: "Spark",
  other: "Plus"
};

const levels = [
  { name: "New Reader", min: 0 },
  { name: "Light Seeker", min: 100 },
  { name: "Reflection Keeper", min: 250 },
  { name: "Source Witness", min: 500 },
  { name: "Canon Builder", min: 1000 },
  { name: "Merch Circle", min: 2000 }
];

const merchMilestones = [
  { points: 500, title: "Early Supporter Sticker", detail: "Future custom sticker or digital badge eligibility." },
  { points: 1000, title: "Source Reader Tee", detail: "Future T-shirt shortlist when merch production begins." },
  { points: 2000, title: "Custom Merch Circle", detail: "Priority candidate for limited merch drops and reader recognition." }
];

function num(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function fmt(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en").format(num(value));
}

function pointsFor(stats: CountRow) {
  return (
    num(stats.started) * 5 +
    num(stats.completed) * 20 +
    num(stats.reflections) * 40 +
    num(stats.approved_reflections) * 20 +
    num(stats.unlocks) * 15
  );
}

function currentLevel(points: number) {
  return [...levels].reverse().find((level) => points >= level.min) ?? levels[0];
}

function nextLevel(points: number) {
  return levels.find((level) => points < level.min) ?? null;
}

function progressToNext(points: number) {
  const current = currentLevel(points);
  const next = nextLevel(points);

  if (!next) {
    return 100;
  }

  return Math.max(5, Math.round(((points - current.min) / (next.min - current.min)) * 100));
}

function earnedBadges(stats: CountRow) {
  const badges = [
    { title: "First Step", detail: "Started your first episode.", earned: num(stats.started) >= 1 },
    { title: "Episode Finisher", detail: "Completed an episode.", earned: num(stats.completed) >= 1 },
    { title: "Reflection Keeper", detail: "Submitted three reflections.", earned: num(stats.reflections) >= 3 },
    { title: "Unlock Runner", detail: "Unlocked three episodes.", earned: num(stats.unlocks) >= 3 },
    { title: "Trusted Voice", detail: "Earned three approved reflections.", earned: num(stats.approved_reflections) >= 3 },
    { title: "Season Climber", detail: "Completed five episodes.", earned: num(stats.completed) >= 5 }
  ];

  return badges;
}

export default async function ProgressPage() {
  const user = await requireUser();

  const progress = await query<ProgressRow>(
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

  const reflections = await query<ReflectionRow>(
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

  const [stats] = await query<CountRow>(
    `select
       (select count(*) from public.reader_progress where user_id = $1)::text as started,
       (select count(*) from public.reader_progress where user_id = $1 and completed = true)::text as completed,
       (select count(*) from public.reflections where user_id = $1)::text as reflections,
       (select count(*) from public.reflections where user_id = $1 and moderation_status = 'approved')::text as approved_reflections,
       (select count(*) from public.unlocks where user_id = $1)::text as unlocks`,
    [user.id]
  );

  const totalPoints = pointsFor(stats);
  const level = currentLevel(totalPoints);
  const next = nextLevel(totalPoints);
  const badges = earnedBadges(stats);
  const earnedCount = badges.filter((badge) => badge.earned).length;

  return (
    <main className="view rewards-view">
      <section className="section-head">
        <div>
          <div className="eyebrow">Reader Progress</div>
          <h2>Your rewards path.</h2>
          <p>Earn points by reading, completing episodes, submitting reflections, and unlocking new story chapters.</p>
        </div>
        <Link className="button-secondary" href="/library">
          Back to Library
        </Link>
      </section>

      <section className="reward-hero">
        <article className="reward-score-card">
          <div className="eyebrow">Current Level</div>
          <h3>{level.name}</h3>
          <strong>{fmt(totalPoints)} pts</strong>
          <div className="level-track" aria-label="Level progress">
            <i style={{ width: `${progressToNext(totalPoints)}%` }} />
          </div>
          <p>{next ? `${fmt(next.min - totalPoints)} points until ${next.name}.` : "Top level reached for the current reward system."}</p>
        </article>

        <article className="reward-breakdown">
          <div><span>Started</span><strong>{fmt(stats.started)}</strong><small>5 pts each</small></div>
          <div><span>Completed</span><strong>{fmt(stats.completed)}</strong><small>20 pts each</small></div>
          <div><span>Reflections</span><strong>{fmt(stats.reflections)}</strong><small>40 pts each</small></div>
          <div><span>Approved</span><strong>{fmt(stats.approved_reflections)}</strong><small>20 bonus pts</small></div>
          <div><span>Unlocks</span><strong>{fmt(stats.unlocks)}</strong><small>15 pts each</small></div>
          <div><span>Badges</span><strong>{earnedCount}/{badges.length}</strong><small>Milestones</small></div>
        </article>
      </section>

      <section className="rewards-grid">
        <article className="reward-panel">
          <div className="eyebrow">Badges</div>
          <h3>Reader achievements</h3>
          <div className="badge-grid">
            {badges.map((badge) => (
              <div className={`badge-card${badge.earned ? " earned" : ""}`} key={badge.title}>
                <span>{badge.earned ? "Unlocked" : "Locked"}</span>
                <strong>{badge.title}</strong>
                <p>{badge.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="reward-panel">
          <div className="eyebrow">Merch Rewards</div>
          <h3>Future custom merch path</h3>
          <p className="hint">These are eligibility milestones, not instant claims. Merch should only become redeemable after production, budget, sizes, delivery rules, and fraud checks are ready.</p>
          <div className="merch-list">
            {merchMilestones.map((milestone) => (
              <div className={`merch-card${totalPoints >= milestone.points ? " earned" : ""}`} key={milestone.title}>
                <span>{fmt(milestone.points)} pts</span>
                <strong>{milestone.title}</strong>
                <p>{milestone.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="section-head" style={{ marginTop: 24 }}>
        <div>
          <div className="eyebrow">Reading Activity</div>
          <h2>Your unlocked path.</h2>
        </div>
      </section>

      <section className="stack">
        {progress.length ? (
          progress.map((item) => (
            <article className="row-card" key={item.id}>
              <h3>{item.episode_title}</h3>
              <p className="hint">
                {item.comic_title} / {item.season_title} / Last page: {item.last_page_number} / {item.completed ? "completed" : "in progress"}
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
              <p className="hint">Reaction: {reactionIcons[reflection.reaction] ?? "Reaction"} / {reflection.reaction} / {reflection.moderation_status}</p>
              <p>{reflection.body}</p>
            </article>
          ))
        ) : (
          <p className="warning">No reflections submitted yet.</p>
        )}
      </section>

      <style>{`
        .rewards-view {
          display: grid;
          gap: 22px;
        }

        .reward-hero,
        .rewards-grid {
          display: grid;
          grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
          gap: 18px;
          align-items: stretch;
        }

        .reward-score-card,
        .reward-breakdown,
        .reward-panel {
          border: 1.5px solid rgba(9, 9, 9, .16);
          border-radius: var(--radius-lg);
          background: rgba(255, 254, 248, .86);
          box-shadow: var(--shadow-card);
        }

        .reward-score-card,
        .reward-panel {
          padding: clamp(20px, 3vw, 28px);
        }

        .reward-score-card strong {
          display: block;
          margin: 16px 0;
          font-size: clamp(42px, 7vw, 78px);
          line-height: .85;
          letter-spacing: -.06em;
        }

        .reward-score-card p,
        .badge-card p,
        .merch-card p {
          color: var(--muted);
          margin-bottom: 0;
        }

        .level-track {
          height: 16px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(9, 9, 9, .10);
          box-shadow: inset 0 0 0 1px rgba(9, 9, 9, .10);
        }

        .level-track i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--yellow), var(--yellow-deep));
        }

        .reward-breakdown {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          overflow: hidden;
          background: rgba(9, 9, 9, .12);
        }

        .reward-breakdown div {
          padding: 18px;
          background: rgba(255, 254, 248, .9);
        }

        .reward-breakdown span,
        .badge-card span,
        .merch-card span {
          display: block;
          color: var(--muted);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .reward-breakdown strong {
          display: block;
          margin-top: 8px;
          font-size: 34px;
          line-height: 1;
          letter-spacing: -.04em;
        }

        .reward-breakdown small {
          display: block;
          margin-top: 8px;
          color: var(--dim);
        }

        .badge-grid,
        .merch-list {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .badge-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .badge-card,
        .merch-card {
          padding: 16px;
          border: 1.5px solid rgba(9, 9, 9, .12);
          border-radius: 22px;
          background: rgba(247, 245, 235, .72);
        }

        .badge-card.earned,
        .merch-card.earned {
          border-color: rgba(9, 9, 9, .45);
          background: linear-gradient(135deg, rgba(255, 210, 26, .44), rgba(255, 254, 248, .88));
        }

        .badge-card strong,
        .merch-card strong {
          display: block;
          margin-top: 8px;
          font-size: 18px;
        }

        @media (max-width: 900px) {
          .reward-hero,
          .rewards-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .reward-breakdown,
          .badge-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
