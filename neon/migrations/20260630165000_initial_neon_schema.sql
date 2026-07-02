-- Echoes Web-Comic initial Neon Postgres schema
-- This replaces the Supabase-specific migration for projects using Neon + external image storage.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null default 'Reader',
  role text not null default 'reader'
    check (role in ('reader', 'moderator', 'admin')),
  trust_score integer not null default 0 check (trust_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text not null default '',
  cover_image_path text,
  now_streaming_image_path text,
  series_poster_image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid not null references public.comics(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  title text not null,
  description text not null default '',
  cover_image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'locked', 'archived')),
  unlock_rule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comic_id, season_number)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text not null,
  synopsis text not null default '',
  cover_image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'locked', 'archived')),
  requires_reflection boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  image_path text not null,
  alt_text text not null default '',
  caption text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, page_number)
);

create table public.reader_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  comic_id uuid not null references public.comics(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  last_page_number integer not null default 1 check (last_page_number > 0),
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, episode_id)
);

create table public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  comic_id uuid not null references public.comics(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  reaction text not null
    check (reaction in ('moved', 'curious', 'disturbed', 'confused', 'inspired', 'other')),
  body text not null check (char_length(trim(body)) >= 40),
  quality_score integer check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected', 'flagged')),
  created_at timestamptz not null default now(),
  unique (user_id, episode_id)
);

create table public.unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  unlockable_type text not null
    check (unlockable_type in ('comic', 'season', 'episode')),
  unlockable_id uuid not null,
  reason text not null
    check (reason in ('signup', 'reflection', 'admin', 'season_complete', 'seed')),
  created_at timestamptz not null default now(),
  unique (user_id, unlockable_type, unlockable_id)
);

create index app_users_email_idx on public.app_users (lower(email));
create index comics_published_sort_idx on public.comics (status, sort_order, created_at);
create index seasons_comic_status_idx on public.seasons (comic_id, status, season_number);
create index episodes_season_status_idx on public.episodes (season_id, status, episode_number);
create index pages_episode_status_idx on public.pages (episode_id, status, page_number);
create index reader_progress_user_idx on public.reader_progress (user_id, updated_at desc);
create index reflections_episode_idx on public.reflections (episode_id, moderation_status, created_at desc);
create index unlocks_user_type_idx on public.unlocks (user_id, unlockable_type, unlockable_id);

create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create trigger comics_set_updated_at
before update on public.comics
for each row execute function public.set_updated_at();

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function public.set_updated_at();

create trigger episodes_set_updated_at
before update on public.episodes
for each row execute function public.set_updated_at();

create trigger pages_set_updated_at
before update on public.pages
for each row execute function public.set_updated_at();

create trigger reader_progress_set_updated_at
before update on public.reader_progress
for each row execute function public.set_updated_at();

create or replace function public.user_can_read_episode(
  current_user_id uuid,
  target_episode_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_users
    where id = current_user_id
      and role = 'admin'
  )
  or exists (
    select 1
    from public.unlocks
    where user_id = current_user_id
      and unlockable_type = 'episode'
      and unlockable_id = target_episode_id
  )
  or exists (
    select 1
    from public.episodes e
    join public.seasons s on s.id = e.season_id
    join public.comics c on c.id = s.comic_id
    where e.id = target_episode_id
      and e.episode_number = 1
      and s.season_number = 1
      and e.status = 'published'
      and s.status = 'published'
      and c.status = 'published'
  );
$$;

create or replace function public.submit_episode_reflection(
  current_user_id uuid,
  target_episode_id uuid,
  selected_reaction text,
  reflection_body text
)
returns table (
  reflection_id uuid,
  unlocked_episode_id uuid
)
language plpgsql
as $$
declare
  episode_record record;
  next_episode_id uuid;
  new_reflection_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if char_length(trim(reflection_body)) < 40 then
    raise exception 'Reflection must be at least 40 characters.';
  end if;

  select
    e.id as episode_id,
    e.episode_number,
    e.season_id,
    s.comic_id
  into episode_record
  from public.episodes e
  join public.seasons s on s.id = e.season_id
  where e.id = target_episode_id
    and e.status = 'published'
    and s.status = 'published';

  if episode_record is null then
    raise exception 'Episode not found or not published.';
  end if;

  if not public.user_can_read_episode(current_user_id, target_episode_id) then
    raise exception 'Episode is locked.';
  end if;

  insert into public.reader_progress (
    user_id,
    comic_id,
    season_id,
    episode_id,
    completed,
    completed_at
  )
  values (
    current_user_id,
    episode_record.comic_id,
    episode_record.season_id,
    episode_record.episode_id,
    true,
    now()
  )
  on conflict (user_id, episode_id)
  do update set
    completed = true,
    completed_at = coalesce(public.reader_progress.completed_at, now()),
    updated_at = now();

  insert into public.reflections (
    user_id,
    comic_id,
    season_id,
    episode_id,
    reaction,
    body
  )
  values (
    current_user_id,
    episode_record.comic_id,
    episode_record.season_id,
    episode_record.episode_id,
    selected_reaction,
    trim(reflection_body)
  )
  returning id into new_reflection_id;

  select e.id
  into next_episode_id
  from public.episodes e
  where e.season_id = episode_record.season_id
    and e.episode_number = episode_record.episode_number + 1
    and e.status = 'published'
  limit 1;

  if next_episode_id is not null then
    insert into public.unlocks (
      user_id,
      unlockable_type,
      unlockable_id,
      reason
    )
    values (
      current_user_id,
      'episode',
      next_episode_id,
      'reflection'
    )
    on conflict (user_id, unlockable_type, unlockable_id) do nothing;
  end if;

  return query select new_reflection_id, next_episode_id;
end;
$$;

insert into public.comics (slug, title, subtitle, description, status, sort_order)
values (
  'echoes-of-the-source',
  'Echoes of the Source',
  'A cinematic salvation allegory',
  'A web-comic about Light, separation, corruption, sacrifice, and the invitation to return.',
  'published',
  1
)
on conflict (slug) do nothing;

insert into public.seasons (comic_id, season_number, title, description, status)
select
  c.id,
  1,
  'Season 1',
  'Kael survives in a broken world where Light has become something people steal.',
  'published'
from public.comics c
where c.slug = 'echoes-of-the-source'
on conflict (comic_id, season_number) do nothing;

insert into public.episodes (season_id, episode_number, title, synopsis, status, requires_reflection)
select
  s.id,
  1,
  'The Glow We Lost',
  'Kael moves through the broken world and quietly takes Light to survive.',
  'published',
  true
from public.seasons s
join public.comics c on c.id = s.comic_id
where c.slug = 'echoes-of-the-source'
  and s.season_number = 1
on conflict (season_id, episode_number) do nothing;

insert into public.episodes (season_id, episode_number, title, synopsis, status, requires_reflection)
select
  s.id,
  2,
  'Borrowed Light',
  'The cost of survival begins to show.',
  'published',
  true
from public.seasons s
join public.comics c on c.id = s.comic_id
where c.slug = 'echoes-of-the-source'
  and s.season_number = 1
on conflict (season_id, episode_number) do nothing;
