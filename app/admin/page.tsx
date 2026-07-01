import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

type CountRow = Record<string, string>;
type BreakdownRow = { label: string; total: string };
type WeeklyRow = { label: string; new_readers: string; reflections: string; unlocks: string };
type EpisodeRow = {
  episode_id: string;
  comic_title: string;
  season_number: number;
  episode_number: number;
  episode_title: string;
  status: string;
  published_pages: string;
  total_pages: string;
  readers_started: string;
  readers_completed: string;
  reflections: string;
  last_reflection_at: string | null;
};
type RecentReaderRow = {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
  last_activity_at: string | null;
  progress_entries: string;
  reflections: string;
};
type RecentReflectionRow = {
  id: string;
  display_name: string;
  email: string;
  reaction: string;
  moderation_status: string;
  created_at: string;
  body: string;
  episode_title: string;
};

const reactionLabels: Record<string, string> = {
  moved: "Moved",
  curious: "Curious",
  disturbed: "Disturbed",
  confused: "Confused",
  inspired: "Inspired",
  other: "Other"
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  flagged: "Flagged",
  rejected: "Rejected"
};

function num(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function fmt(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en").format(num(value));
}

function pct(part: string | number | null | undefined, total: string | number | null | undefined) {
  const denominator = num(total);
  return denominator ? `${Math.round((num(part) / denominator) * 100)}%` : "0%";
}

function width(part: string | number | null | undefined, total: string | number | null | undefined) {
  const denominator = num(total);
  return `${denominator ? Math.max(5, Math.round((num(part) / denominator) * 100)) : 0}%`;
}

function maxOf(values: Array<string | number | null | undefined>) {
  return Math.max(1, ...values.map(num));
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "None yet";
}

function shortText(value: string) {
  return value.length > 118 ? `${value.slice(0, 118).trim()}...` : value;
}

function totalFor(rows: BreakdownRow[], label: string) {
  return rows.find((row) => row.label === label)?.total ?? "0";
}

export default async function AdminPage() {
  await requireAdmin();

  const [metrics] = await query<CountRow>(
    `select
       count(*)::text as total_users,
       count(*) filter (where role = 'reader')::text as total_readers,
       count(*) filter (where role = 'admin')::text as total_admins,
       count(*) filter (where role = 'reader' and created_at >= now() - interval '7 days')::text as new_readers_7d,
       (
         select count(distinct active.user_id)
         from (
           select user_id from public.reader_progress where updated_at >= now() - interval '7 days'
           union
           select user_id from public.reflections where created_at >= now() - interval '7 days'
           union
           select user_id from public.unlocks where created_at >= now() - interval '7 days'
         ) active
         join public.app_users au on au.id = active.user_id and au.role = 'reader'
       )::text as active_readers_7d,
       (select count(*) from public.reflections)::text as total_reflections,
       (select count(*) from public.reflections where created_at >= now() - interval '7 days')::text as reflections_7d,
       (select count(*) from public.unlocks)::text as total_unlocks,
       (select count(*) from public.unlocks where created_at >= now() - interval '7 days')::text as unlocks_7d
     from public.app_users`
  );

  const [content] = await query<CountRow>(
    `select
       (select count(*) from public.comics)::text as comics_total,
       (select count(*) from public.comics where status = 'published')::text as comics_published,
       (select count(*) from public.episodes)::text as episodes_total,
       (select count(*) from public.episodes where status = 'published')::text as episodes_published,
       (select count(*) from public.episodes where status = 'draft')::text as episodes_draft,
       (select count(*) from public.pages)::text as pages_total,
       (select count(*) from public.pages where status = 'published')::text as pages_published,
       (select count(*) from public.pages where status = 'draft')::text as pages_draft,
       (select count(*) from public.pages where status = 'hidden')::text as pages_hidden`
  );

  const [funnel] = await query<CountRow>(
    `select
       (select count(*) from public.app_users where role = 'reader')::text as account_created,
       (select count(distinct rp.user_id) from public.reader_progress rp join public.app_users u on u.id = rp.user_id where u.role = 'reader')::text as started_reading,
       (select count(distinct rp.user_id) from public.reader_progress rp join public.app_users u on u.id = rp.user_id where rp.completed = true and u.role = 'reader')::text as completed_episode,
       (select count(distinct r.user_id) from public.reflections r join public.app_users u on u.id = r.user_id where u.role = 'reader')::text as submitted_reflection`
  );

  const weekly = await query<WeeklyRow>(
    `select
       to_char(days.day, 'Dy') as label,
       (select count(*) from public.app_users where role = 'reader' and created_at >= days.day and created_at < days.day + interval '1 day')::text as new_readers,
       (select count(*) from public.reflections where created_at >= days.day and created_at < days.day + interval '1 day')::text as reflections,
       (select count(*) from public.unlocks where created_at >= days.day and created_at < days.day + interval '1 day')::text as unlocks
     from generate_series(current_date - interval '6 days', current_date, interval '1 day') as days(day)
     order by days.day asc`
  );

  const reactions = await query<BreakdownRow>(
    `select reaction as label, count(*)::text as total from public.reflections group by reaction order by reaction asc`
  );
  const moderation = await query<BreakdownRow>(
    `select moderation_status as label, count(*)::text as total from public.reflections group by moderation_status order by moderation_status asc`
  );
  const episodePerformance = await query<EpisodeRow>(
    `select
       e.id as episode_id,
       c.title as comic_title,
       s.season_number,
       e.episode_number,
       e.title as episode_title,
       e.status,
       count(distinct p.id) filter (where p.status = 'published')::text as published_pages,
       count(distinct p.id)::text as total_pages,
       count(distinct rp.user_id)::text as readers_started,
       count(distinct rp.user_id) filter (where rp.completed = true)::text as readers_completed,
       count(distinct r.id)::text as reflections,
       max(r.created_at)::text as last_reflection_at
     from public.episodes e
     join public.seasons s on s.id = e.season_id
     join public.comics c on c.id = s.comic_id
     left join public.pages p on p.episode_id = e.id
     left join public.reader_progress rp on rp.episode_id = e.id
     left join public.reflections r on r.episode_id = e.id
     group by e.id, c.title, s.season_number, e.episode_number, e.title, e.status
     order by c.title asc, s.season_number asc, e.episode_number asc`
  );
  const recentReaders = await query<RecentReaderRow>(
    `select
       u.id,
       u.display_name,
       u.email,
       u.created_at::text,
       nullif(greatest(coalesce(max(rp.updated_at), '-infinity'::timestamptz), coalesce(max(r.created_at), '-infinity'::timestamptz), coalesce(max(un.created_at), '-infinity'::timestamptz)), '-infinity'::timestamptz)::text as last_activity_at,
       count(distinct rp.id)::text as progress_entries,
       count(distinct r.id)::text as reflections
     from public.app_users u
     left join public.reader_progress rp on rp.user_id = u.id
     left join public.reflections r on r.user_id = u.id
     left join public.unlocks un on un.user_id = u.id
     where u.role = 'reader'
     group by u.id, u.display_name, u.email, u.created_at
     order by coalesce(nullif(greatest(coalesce(max(rp.updated_at), '-infinity'::timestamptz), coalesce(max(r.created_at), '-infinity'::timestamptz), coalesce(max(un.created_at), '-infinity'::timestamptz)), '-infinity'::timestamptz), u.created_at) desc
     limit 8`
  );
  const recentReflections = await query<RecentReflectionRow>(
    `select r.id, u.display_name, u.email, r.reaction, r.moderation_status, r.created_at::text, r.body, e.title as episode_title
     from public.reflections r
     join public.app_users u on u.id = r.user_id
     join public.episodes e on e.id = r.episode_id
     order by r.created_at desc
     limit 8`
  );

  const topMetrics = [
    { label: "Users", value: metrics.total_users, detail: `${fmt(metrics.total_readers)} readers / ${fmt(metrics.total_admins)} admins` },
    { label: "New readers", value: metrics.new_readers_7d, detail: "Last 7 days" },
    { label: "Active", value: metrics.active_readers_7d, detail: "Last 7 days" },
    { label: "Reflections", value: metrics.total_reflections, detail: `${fmt(metrics.reflections_7d)} in 7 days` },
    { label: "Unlocks", value: metrics.total_unlocks, detail: `${fmt(metrics.unlocks_7d)} in 7 days` },
    { label: "Pages", value: content.pages_total, detail: `${fmt(content.pages_published)} pub / ${fmt(content.pages_draft)} draft / ${fmt(content.pages_hidden)} hidden` }
  ];
  const funnelSteps = [
    { label: "Account created", value: funnel.account_created },
    { label: "Started reading", value: funnel.started_reading },
    { label: "Completed episode", value: funnel.completed_episode },
    { label: "Submitted reflection", value: funnel.submitted_reflection }
  ];
  const weeklyMax = maxOf(weekly.flatMap((day) => [day.new_readers, day.reflections, day.unlocks]));
  const topEpisodes = episodePerformance.slice(0, 8);

  return (
    <main className="view admin-dashboard redesigned-dashboard">
      <section className="compact-command-hero admin-hero">
        <div>
          <div className="eyebrow">Admin Command Center</div>
          <h2>Analytics and upload control.</h2>
          <p>Track growth, reading, reflections, publishing health, and uploads from one tighter command screen.</p>
        </div>
        <div className="actions">
          <Link className="button" href="/admin/comics/new">New Series</Link>
          <Link className="button-secondary" href="/admin/comics">Uploads</Link>
          <Link className="button-secondary" href="/library">Reader View</Link>
        </div>
      </section>

      <details className="collapse-panel upload-panel" open>
        <summary>
          <span>Upload Channel</span>
          <strong>Series -&gt; seasons -&gt; episodes -&gt; pages</strong>
          <em>{fmt(content.comics_total)} series</em>
        </summary>
        <div className="panel-actions-row">
          <p>Create a new series, manage seasons and episodes, then upload or replace Cloudinary-backed comic pages.</p>
          <div className="actions">
            <Link className="button" href="/admin/comics/new">Create New Series</Link>
            <Link className="button-secondary" href="/admin/comics">Manage Uploads</Link>
          </div>
        </div>
      </details>

      <section className="metric-grid compact-stat-grid" aria-label="Key metrics">
        {topMetrics.map((metric) => (
          <article className="metric-card compact-stat" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{fmt(metric.value)}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="collapsible-grid">
        <details className="collapse-panel graph-panel" open>
          <summary>
            <span>7-Day Activity</span>
            <strong>Readers, reflections, unlocks</strong>
            <em>{fmt(metrics.active_readers_7d)} active</em>
          </summary>
          <div className="vertical-chart compact-chart">
            {weekly.map((day) => (
              <div className="day-bars" key={day.label}>
                <div className="bars">
                  <i className="reader-bar" style={{ height: width(day.new_readers, weeklyMax) }} title={`${day.new_readers} new readers`} />
                  <i className="reflection-bar" style={{ height: width(day.reflections, weeklyMax) }} title={`${day.reflections} reflections`} />
                  <i className="unlock-bar" style={{ height: width(day.unlocks, weeklyMax) }} title={`${day.unlocks} unlocks`} />
                </div>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
          <div className="legend"><span>Readers</span><span>Reflections</span><span>Unlocks</span></div>
        </details>

        <details className="collapse-panel graph-panel" open>
          <summary>
            <span>Reader Funnel</span>
            <strong>Account created -&gt; reflection</strong>
            <em>{pct(funnel.submitted_reflection, funnel.account_created)}</em>
          </summary>
          <div className="wide-bars compact-bars">
            {funnelSteps.map((step) => (
              <div className="wide-bar" key={step.label}>
                <div><span>{step.label}</span><strong>{fmt(step.value)}</strong></div>
                <i style={{ width: width(step.value, funnelSteps[0].value) }} />
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="collapsible-grid">
        <details className="collapse-panel" open>
          <summary>
            <span>Content Health</span>
            <strong>Publishing status</strong>
            <em>{fmt(content.pages_published)} pages live</em>
          </summary>
          <div className="compact-stat-grid content-status-grid">
            <div className="compact-stat"><span>Comics</span><strong>{fmt(content.comics_total)}</strong><small>{fmt(content.comics_published)} published</small></div>
            <div className="compact-stat"><span>Episodes</span><strong>{fmt(content.episodes_total)}</strong><small>{fmt(content.episodes_published)} published / {fmt(content.episodes_draft)} draft</small></div>
            <div className="compact-stat"><span>Pages</span><strong>{fmt(content.pages_total)}</strong><small>{fmt(content.pages_published)} published / {fmt(content.pages_draft)} draft / {fmt(content.pages_hidden)} hidden</small></div>
          </div>
        </details>

        <details className="collapse-panel graph-panel">
          <summary>
            <span>Completion</span>
            <strong>Started vs completed</strong>
            <em>{fmt(topEpisodes.length)} shown</em>
          </summary>
          <div className="wide-bars compact-bars">
            {topEpisodes.length ? topEpisodes.map((episode) => (
              <div className="wide-bar" key={episode.episode_id}>
                <div><span>{episode.episode_title}</span><strong>{pct(episode.readers_completed, episode.readers_started)}</strong></div>
                <i style={{ width: width(episode.readers_completed, episode.readers_started) }} />
              </div>
            )) : <p className="hint">No episode data yet.</p>}
          </div>
        </details>

        <details className="collapse-panel">
          <summary>
            <span>Reactions</span>
            <strong>Reader response</strong>
            <em>{fmt(metrics.total_reflections)} total</em>
          </summary>
          <div className="bar-list compact-bars">
            {Object.entries(reactionLabels).map(([key, label]) => {
              const total = totalFor(reactions, key);
              return <div className="bar-row" key={key}><div><span>{label}</span><strong>{fmt(total)}</strong></div><i style={{ width: width(total, metrics.total_reflections) }} /></div>;
            })}
          </div>
        </details>

        <details className="collapse-panel">
          <summary>
            <span>Moderation</span>
            <strong>Reflection status</strong>
            <em>{fmt(totalFor(moderation, "pending"))} pending</em>
          </summary>
          <div className="bar-list compact-bars">
            {Object.entries(statusLabels).map(([key, label]) => {
              const total = totalFor(moderation, key);
              return <div className="bar-row" key={key}><div><span>{label}</span><strong>{fmt(total)}</strong></div><i style={{ width: width(total, metrics.total_reflections) }} /></div>;
            })}
          </div>
        </details>
      </section>

      <details className="collapse-panel table-panel">
        <summary>
          <span>Episode Performance</span>
          <strong>Starts, completions, reflections</strong>
          <em>{fmt(episodePerformance.length)} episodes</em>
        </summary>
        <div className="table-wrap">
          <table className="analytics-table">
            <thead><tr><th>Episode</th><th>Status</th><th>Pages</th><th>Started</th><th>Completed</th><th>Rate</th><th>Reflections</th><th>Last reflection</th></tr></thead>
            <tbody>
              {episodePerformance.length ? episodePerformance.map((episode) => (
                <tr key={episode.episode_id}>
                  <td><strong>{episode.episode_title}</strong><span>{episode.comic_title} / S{episode.season_number} E{episode.episode_number}</span></td>
                  <td>{episode.status}</td>
                  <td>{fmt(episode.published_pages)} / {fmt(episode.total_pages)}</td>
                  <td>{fmt(episode.readers_started)}</td>
                  <td>{fmt(episode.readers_completed)}</td>
                  <td>{pct(episode.readers_completed, episode.readers_started)}</td>
                  <td>{fmt(episode.reflections)}</td>
                  <td>{date(episode.last_reflection_at)}</td>
                </tr>
              )) : <tr><td colSpan={8}>No episodes have been created yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </details>

      <section className="collapsible-grid">
        <details className="collapse-panel">
          <summary>
            <span>Recent Readers</span>
            <strong>Latest reader activity</strong>
            <em>{fmt(recentReaders.length)} shown</em>
          </summary>
          <div className="compact-list">
            {recentReaders.length ? recentReaders.map((reader) => (
              <div className="compact-row" key={reader.id}>
                <div><strong>{reader.display_name}</strong><span>{reader.email}</span></div>
                <em>{fmt(reader.progress_entries)} starts / {fmt(reader.reflections)} reflections</em>
              </div>
            )) : <p className="hint">No readers yet.</p>}
          </div>
        </details>

        <details className="collapse-panel">
          <summary>
            <span>Recent Reflections</span>
            <strong>Newest submissions</strong>
            <em>{fmt(recentReflections.length)} shown</em>
          </summary>
          <div className="compact-list">
            {recentReflections.length ? recentReflections.map((reflection) => (
              <div className="compact-row reflection-row" key={reflection.id}>
                <div>
                  <strong>{reflection.display_name}</strong>
                  <span>{reflection.episode_title} / {reactionLabels[reflection.reaction] ?? reflection.reaction} / {statusLabels[reflection.moderation_status] ?? reflection.moderation_status}</span>
                </div>
                <p>{shortText(reflection.body)}</p>
              </div>
            )) : <p className="hint">No reflections yet.</p>}
          </div>
        </details>
      </section>
    </main>
  );
}
