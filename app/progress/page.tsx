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
  return [
    { title: "First Step", detail: "Started your first episode.", earned: num(stats.started) >= 1 },
    { title: "Episode Finisher", detail: "Completed an episode.", earned: num(stats.completed) >= 1 },
    { title: "Reflection Keeper", detail: "Submitted three reflections.", earned: num(stats.reflections) >= 3 },
    { title: "Unlock Runner", detail: "Unlocked three episodes.", earned: num(stats.unlocks) >= 3 },
    { title: "Trusted Voice", detail: "Earned three approved reflections.", earned: num(stats.approved_reflections) >= 3 },
    { title: "Season Climber", detail: "Completed five episodes.", earned: num(stats.completed) >= 5 }
  ];
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
  const statTiles = [
    { label: "Started", value: stats.started, detail: "5 pts each" },
    { label: "Completed", value: stats.completed, detail: "20 pts each" },
    { label: "Reflections", value: stats.reflections, detail: "40 pts each" },
    { label: "Approved", value: stats.approved_reflections, detail: "20 bonus pts" },
    { label: "Unlocks", value: stats.unlocks, detail: "15 pts each" },
    { label: "Badges", value: `${earnedCount}/${badges.length}`, detail: "Milestones" }
  ];

  return (
    <main className="view rewards-view redesigned-dashboard">
      <section className="compact-command-hero rewards-hero-copy">
        <div>
          <div className="eyebrow">Reader Progress</div>
          <h2>Your rewards path.</h2>
          <p>Track reading, reflections, unlocks, badges, and future merch eligibility without the long scroll.</p>
        </div>
        <Link className="button-secondary" href="/library">
          Back to Library
        </Link>
      </section>

      <section className="progress-overview">
        <article className="score-panel">
          <div>
            <div className="eyebrow">Current Level</div>
            <h3>{level.name}</h3>
          </div>
          <strong>{fmt(totalPoints)} pts</strong>
          <div className="level-track" aria-label="Level progress">
            <i style={{ width: `${progressToNext(totalPoints)}%` }} />
          </div>
          <p>{next ? `${fmt(next.min - totalPoints)} points until ${next.name}.` : "Top level reached for the current reward system."}</p>
        </article>

        <article className="compact-stat-grid reward-breakdown" aria-label="Reward point breakdown">
          {statTiles.map((tile) => (
            <div className="compact-stat" key={tile.label}>
              <span>{tile.label}</span>
              <strong>{typeof tile.value === "string" && tile.value.includes("/") ? tile.value : fmt(tile.value)}</strong>
              <small>{tile.detail}</small>
            </div>
          ))}
        </article>
      </section>

      <section className="collapsible-grid">
        <details className="collapse-panel" open>
          <summary>
            <span>Badges</span>
            <strong>Reader achievements</strong>
            <em>{earnedCount}/{badges.length} earned</em>
          </summary>
          <div className="badge-grid compact-card-grid">
            {badges.map((badge) => (
              <div className={`badge-card${badge.earned ? " earned" : ""}`} key={badge.title}>
                <span>{badge.earned ? "Unlocked" : "Locked"}</span>
                <strong>{badge.title}</strong>
                <p>{badge.detail}</p>
              </div>
            ))}
          </div>
        </details>

        <details className="collapse-panel">
          <summary>
            <span>Merch Rewards</span>
            <strong>Future custom merch path</strong>
            <em>{fmt(totalPoints)} pts</em>
          </summary>
          <p className="hint compact-note">Eligibility milestones only. Merch becomes redeemable after production, budget, sizes, delivery rules, and fraud checks are ready.</p>
          <div className="merch-list compact-list">
            {merchMilestones.map((milestone) => (
              <div className={`merch-card${totalPoints >= milestone.points ? " earned" : ""}`} key={milestone.title}>
                <span>{fmt(milestone.points)} pts</span>
                <strong>{milestone.title}</strong>
                <p>{milestone.detail}</p>
              </div>
            ))}
          </div>
        </details>
      </section>

      <details className="collapse-panel" open>
        <summary>
          <span>Reading Activity</span>
          <strong>Your unlocked path</strong>
          <em>{fmt(progress.length)} entries</em>
        </summary>
        <div className="compact-list">
          {progress.length ? (
            progress.map((item) => (
              <article className="compact-row" key={item.id}>
                <div>
                  <strong>{item.episode_title}</strong>
                  <span>{item.comic_title} / {item.season_title}</span>
                </div>
                <em>Page {item.last_page_number} / {item.completed ? "completed" : "in progress"}</em>
              </article>
            ))
          ) : (
            <p className="warning">No progress yet. Start with the library.</p>
          )}
        </div>
      </details>

      <details className="collapse-panel">
        <summary>
          <span>Reflections</span>
          <strong>What you submitted</strong>
          <em>{fmt(reflections.length)} total</em>
        </summary>
        <div className="compact-list">
          {reflections.length ? (
            reflections.map((reflection) => (
              <article className="compact-row reflection-row" key={reflection.id}>
                <div>
                  <strong>{reflection.episode_title}</strong>
                  <span>{reactionIcons[reflection.reaction] ?? "Reaction"} / {reflection.reaction} / {reflection.moderation_status}</span>
                </div>
                <p>{reflection.body}</p>
              </article>
            ))
          ) : (
            <p className="warning">No reflections submitted yet.</p>
          )}
        </div>
      </details>
    </main>
  );
}
