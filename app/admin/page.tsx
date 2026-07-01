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
    { label: "Total users", value: metrics.total_users, detail: `${fmt(metrics.total_readers)} readers / ${fmt(metrics.total_admins)} admins` },
    { label: "New readers", value: metrics.new_readers_7d, detail: "Last 7 days" },
    { label: "Active readers", value: metrics.active_readers_7d, detail: "Last 7 days" },
    { label: "Total reflections", value: metrics.total_reflections, detail: `${fmt(metrics.reflections_7d)} in 7 days` },
    { label: "Total unlocks", value: metrics.total_unlocks, detail: `${fmt(metrics.unlocks_7d)} in 7 days` },
    { label: "Pages", value: content.pages_total, detail: `${fmt(content.pages_published)} published / ${fmt(content.pages_draft)} draft / ${fmt(content.pages_hidden)} hidden` }
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
    <main className="view admin-dashboard">
      <section className="section-head admin-hero">
        <div>
          <div className="eyebrow">Admin Command Center</div>
          <h2>Analytics and upload control.</h2>
          <p>Track reader growth, engagement, unlock flow, reflections, publishing health, and new series uploads from one screen.</p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link className="button" href="/admin/comics/new">New Series</Link>
          <Link className="button-secondary" href="/admin/comics">Upload Channel</Link>
          <Link className="button-secondary" href="/library">Reader View</Link>
        </div>
      </section>

      <section className="upload-channel">
        <article className="analytics-panel upload-panel">
          <div className="eyebrow">Upload Channel</div>
          <h3>Series -&gt; seasons -&gt; episodes -&gt; pages</h3>
          <p>Create a new series, add its seasons and episodes, then upload Cloudinary-backed comic pages from the episode page manager.</p>
          <div className="actions">
            <Link className="button" href="/admin/comics/new">Create New Series</Link>
            <Link className="button-secondary" href="/admin/comics">Manage Existing Uploads</Link>
          </div>
        </article>
      </section>

      <section className="metric-grid" aria-label="Key metrics">
        {topMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{fmt(metric.value)}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="analytics-grid">
        <article className="analytics-panel graph-panel">
          <div className="eyebrow">7-Day Activity Graph</div>
          <h3>Readers, reflections, unlocks</h3>
          <div className="vertical-chart">
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
        </article>

        <article className="analytics-panel graph-panel">
          <div className="eyebrow">Funnel Graph</div>
          <h3>Account created -&gt; reflection</h3>
          <div className="wide-bars">
            {funnelSteps.map((step) => (
              <div className="wide-bar" key={step.label}>
                <div><span>{step.label}</span><strong>{fmt(step.value)}</strong></div>
                <i style={{ width: width(step.value, funnelSteps[0].value) }} />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="analytics-panel">
          <div className="eyebrow">Content Health</div>
          <h3>Publishing status</h3>
          <div className="status-grid">
            <div><span>Comics</span><strong>{fmt(content.comics_total)}</strong><small>{fmt(content.comics_published)} published</small></div>
            <div><span>Episodes</span><strong>{fmt(content.episodes_total)}</strong><small>{fmt(content.episodes_published)} published / {fmt(content.episodes_draft)} draft</small></div>
            <div><span>Pages</span><strong>{fmt(content.pages_total)}</strong><small>{fmt(content.pages_published)} published / {fmt(content.pages_draft)} draft / {fmt(content.pages_hidden)} hidden</small></div>
          </div>
        </article>

        <article className="analytics-panel graph-panel">
          <div className="eyebrow">Episode Completion Graph</div>
          <h3>Started vs completed</h3>
          <div className="wide-bars">
            {topEpisodes.length ? topEpisodes.map((episode) => (
              <div className="wide-bar" key={episode.episode_id}>
                <div><span>{episode.episode_title}</span><strong>{pct(episode.readers_completed, episode.readers_started)}</strong></div>
                <i style={{ width: width(episode.readers_completed, episode.readers_started) }} />
              </div>
            )) : <p className="hint">No episode data yet.</p>}
          </div>
        </article>

        <article className="analytics-panel">
          <div className="eyebrow">Reactions</div>
          <h3>Reader response</h3>
          <div className="bar-list">
            {Object.entries(reactionLabels).map(([key, label]) => {
              const total = totalFor(reactions, key);
              return <div className="bar-row" key={key}><div><span>{label}</span><strong>{fmt(total)}</strong></div><i style={{ width: width(total, metrics.total_reflections) }} /></div>;
            })}
          </div>
        </article>

        <article className="analytics-panel">
          <div className="eyebrow">Moderation</div>
          <h3>Reflection status</h3>
          <div className="bar-list">
            {Object.entries(statusLabels).map(([key, label]) => {
              const total = totalFor(moderation, key);
              return <div className="bar-row" key={key}><div><span>{label}</span><strong>{fmt(total)}</strong></div><i style={{ width: width(total, metrics.total_reflections) }} /></div>;
            })}
          </div>
        </article>
      </section>

      <section className="analytics-panel">
        <div className="eyebrow">Episode Performance</div>
        <h3>Where readers start, finish, and reflect</h3>
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
      </section>

      <section className="analytics-grid">
        <article className="analytics-panel">
          <div className="eyebrow">Recent Readers</div>
          <h3>Latest reader activity</h3>
          <div className="activity-list">
            {recentReaders.length ? recentReaders.map((reader) => (
              <div className="activity-item" key={reader.id}>
                <strong>{reader.display_name}</strong>
                <span>{reader.email}</span>
                <small>Joined {date(reader.created_at)} / last active {date(reader.last_activity_at)} / {fmt(reader.progress_entries)} starts / {fmt(reader.reflections)} reflections</small>
              </div>
            )) : <p className="hint">No readers yet.</p>}
          </div>
        </article>

        <article className="analytics-panel">
          <div className="eyebrow">Recent Reflections</div>
          <h3>Newest submissions</h3>
          <div className="activity-list">
            {recentReflections.length ? recentReflections.map((reflection) => (
              <div className="activity-item" key={reflection.id}>
                <strong>{reflection.display_name}</strong>
                <span>{reflection.episode_title} / {reactionLabels[reflection.reaction] ?? reflection.reaction} / {statusLabels[reflection.moderation_status] ?? reflection.moderation_status}</span>
                <p>{shortText(reflection.body)}</p>
                <small>{date(reflection.created_at)} / {reflection.email}</small>
              </div>
            )) : <p className="hint">No reflections yet.</p>}
          </div>
        </article>
      </section>

      <style>{`
        .admin-dashboard{display:grid;gap:24px}.admin-hero{margin-bottom:0}.upload-channel,.metric-grid,.analytics-grid{display:grid;gap:18px}.metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.analytics-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.metric-card,.analytics-panel{border:1.5px solid rgba(9,9,9,.16);background:rgba(255,254,248,.88);box-shadow:var(--shadow-card)}.metric-card{min-height:150px;padding:20px;border-radius:var(--radius-lg);display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}.metric-card:after{content:"";position:absolute;right:-32px;bottom:-42px;width:126px;height:126px;border-radius:50%;background:radial-gradient(circle,rgba(255,210,26,.58),transparent 68%)}.metric-card span,.status-grid span,.activity-item span,.wide-bar span,.day-bars span{color:var(--muted);font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.metric-card strong{display:block;margin-top:12px;font-size:clamp(34px,5vw,58px);line-height:.9;letter-spacing:-.055em}.metric-card p,.activity-item p,.upload-panel p{margin:10px 0 0;color:var(--muted)}.analytics-panel{border-radius:var(--radius-lg);padding:clamp(18px,3vw,26px);overflow:hidden}.analytics-panel h3{margin-bottom:16px}.funnel-list,.bar-list,.activity-list,.status-grid,.wide-bars{display:grid;gap:12px}.activity-item,.status-grid div{border:1px solid rgba(9,9,9,.12);border-radius:22px;background:rgba(247,245,235,.72);padding:15px}.status-grid div{background:linear-gradient(90deg,rgba(255,210,26,.34),transparent 44%),rgba(247,245,235,.72)}.status-grid strong{display:block;margin-top:8px;font-size:30px;line-height:1;letter-spacing:-.04em}.status-grid small,.activity-item small{display:block;margin-top:8px;color:var(--dim);line-height:1.4}.bar-row,.wide-bar{display:grid;gap:8px}.bar-row div,.wide-bar div{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.bar-row span{color:var(--muted);font-weight:850}.bar-row i,.wide-bar i{display:block;max-width:100%;height:10px;border-radius:999px;background:linear-gradient(90deg,var(--yellow),var(--yellow-deep));box-shadow:inset 0 0 0 1px rgba(9,9,9,.14)}.wide-bar{border:1px solid rgba(9,9,9,.1);border-radius:18px;padding:12px;background:rgba(247,245,235,.58)}.wide-bar i{height:14px}.vertical-chart{height:240px;display:grid;grid-template-columns:repeat(7,1fr);gap:12px;align-items:end;padding:12px;border:1px solid rgba(9,9,9,.1);border-radius:24px;background:rgba(247,245,235,.58)}.day-bars{height:100%;display:grid;grid-template-rows:1fr auto;gap:8px;text-align:center}.bars{display:flex;align-items:end;justify-content:center;gap:4px}.bars i{width:9px;min-height:2px;border-radius:999px 999px 0 0}.reader-bar{background:var(--ink)}.reflection-bar{background:var(--yellow-deep)}.unlock-bar{background:var(--yellow)}.legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;color:var(--muted);font-size:12px;font-weight:850}.legend span:before{content:"";display:inline-block;width:9px;height:9px;margin-right:6px;border-radius:50%;background:var(--ink)}.legend span:nth-child(2):before{background:var(--yellow-deep)}.legend span:nth-child(3):before{background:var(--yellow)}.table-wrap{width:100%;overflow-x:auto;border:1px solid rgba(9,9,9,.12);border-radius:24px;background:rgba(255,254,248,.74)}.analytics-table{width:100%;min-width:900px;border-collapse:collapse}.analytics-table th,.analytics-table td{padding:14px 15px;text-align:left;border-bottom:1px solid rgba(9,9,9,.10);vertical-align:top}.analytics-table th{color:var(--ink);background:rgba(255,210,26,.46);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.analytics-table tr:last-child td{border-bottom:0}.analytics-table td{color:var(--muted)}.analytics-table td strong{display:block;color:var(--ink)}.analytics-table td span{display:block;margin-top:4px;font-size:12px;color:var(--dim)}.activity-item{display:grid;gap:4px}.activity-item strong{font-size:16px}@media(max-width:980px){.metric-grid,.analytics-grid{grid-template-columns:1fr}}@media(max-width:640px){.metric-card{min-height:132px}.analytics-panel{padding:16px;border-radius:28px}.bar-row div,.wide-bar div{align-items:start;flex-direction:column;gap:4px}.vertical-chart{gap:7px}.bars i{width:7px}}
      `}</style>
    </main>
  );
}
