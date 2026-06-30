-- Echoes Web-Comic initial production schema
-- Apply this in Supabase after creating a new project.

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

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Reader',
  email text,
  role text not null default 'reader'
    check (role in ('reader', 'moderator', 'admin')),
  trust_score integer not null default 0 check (trust_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_moderator_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'moderator')
  );
$$;

create table public.comics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text not null default '',
  cover_image_path text,
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
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  user_id uuid not null references public.profiles(id) on delete cascade,
  unlockable_type text not null
    check (unlockable_type in ('comic', 'season', 'episode')),
  unlockable_id uuid not null,
  reason text not null
    check (reason in ('signup', 'reflection', 'admin', 'season_complete', 'seed')),
  created_at timestamptz not null default now(),
  unique (user_id, unlockable_type, unlockable_id)
);

create index comics_published_sort_idx
  on public.comics (status, sort_order, created_at);

create index seasons_comic_status_idx
  on public.seasons (comic_id, status, season_number);

create index episodes_season_status_idx
  on public.episodes (season_id, status, episode_number);

create index pages_episode_status_idx
  on public.pages (episode_id, status, page_number);

create index reader_progress_user_idx
  on public.reader_progress (user_id, updated_at desc);

create index reflections_episode_idx
  on public.reflections (episode_id, moderation_status, created_at desc);

create index unlocks_user_type_idx
  on public.unlocks (user_id, unlockable_type, unlockable_id);

create trigger profiles_set_updated_at
before update on public.profiles
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Reader'),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_reader_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Direct SQL editor/service setup has no auth.uid(); allow it for bootstrap and maintenance.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only admins can change profile roles.';
  end if;

  if new.trust_score is distinct from old.trust_score then
    raise exception 'Only admins can change trust scores.';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Email is managed by authentication.';
  end if;

  return new;
end;
$$;

create trigger profiles_prevent_reader_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_reader_privilege_escalation();

create or replace function public.user_can_read_episode(target_episode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.unlocks
      where user_id = auth.uid()
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
  target_episode_id uuid,
  selected_reaction text,
  reflection_body text
)
returns table (
  reflection_id uuid,
  unlocked_episode_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
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

  if not public.user_can_read_episode(target_episode_id) then
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

alter table public.profiles enable row level security;
alter table public.comics enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;
alter table public.pages enable row level security;
alter table public.reader_progress enable row level security;
alter table public.reflections enable row level security;
alter table public.unlocks enable row level security;

create policy "profiles can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_moderator_or_admin());

create policy "profiles can update own display info"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "readers can view published comics"
on public.comics
for select
to authenticated
using (status = 'published' or public.is_admin());

create policy "admins manage comics"
on public.comics
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "readers can view published seasons"
on public.seasons
for select
to authenticated
using (
  public.is_admin()
  or (
    status in ('published', 'locked')
    and exists (
      select 1
      from public.comics c
      where c.id = seasons.comic_id
        and c.status = 'published'
    )
  )
);

create policy "admins manage seasons"
on public.seasons
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "readers can view visible episode metadata"
on public.episodes
for select
to authenticated
using (
  public.is_admin()
  or (
    status in ('published', 'locked')
    and exists (
      select 1
      from public.seasons s
      join public.comics c on c.id = s.comic_id
      where s.id = episodes.season_id
        and s.status in ('published', 'locked')
        and c.status = 'published'
    )
  )
);

create policy "admins manage episodes"
on public.episodes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "readers can view unlocked published pages"
on public.pages
for select
to authenticated
using (
  public.is_admin()
  or (
    status = 'published'
    and public.user_can_read_episode(episode_id)
  )
);

create policy "admins manage pages"
on public.pages
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "readers can view own progress"
on public.reader_progress
for select
to authenticated
using (user_id = auth.uid() or public.is_moderator_or_admin());

create policy "readers can insert own progress for readable episodes"
on public.reader_progress
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.user_can_read_episode(episode_id)
);

create policy "readers can update own progress"
on public.reader_progress
for update
to authenticated
using (
  user_id = auth.uid()
  and public.user_can_read_episode(episode_id)
)
with check (
  user_id = auth.uid()
  and public.user_can_read_episode(episode_id)
);

create policy "admins manage reader progress"
on public.reader_progress
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "readers can view own reflections"
on public.reflections
for select
to authenticated
using (user_id = auth.uid() or public.is_moderator_or_admin());

create policy "moderators can update reflection moderation"
on public.reflections
for update
to authenticated
using (public.is_moderator_or_admin())
with check (public.is_moderator_or_admin());

create policy "readers can view own unlocks"
on public.unlocks
for select
to authenticated
using (user_id = auth.uid() or public.is_moderator_or_admin());

create policy "admins manage unlocks"
on public.unlocks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Storage setup. Supabase's storage schema exists in hosted projects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comic-assets',
  'comic-assets',
  true,
  10485760,
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-uploads',
  'admin-uploads',
  false,
  10485760,
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can read comic assets"
on storage.objects
for select
to public
using (bucket_id = 'comic-assets');

create policy "admins manage comic assets"
on storage.objects
for all
to authenticated
using (
  bucket_id in ('comic-assets', 'admin-uploads')
  and public.is_admin()
)
with check (
  bucket_id in ('comic-assets', 'admin-uploads')
  and public.is_admin()
);

-- Seed the first comic shell. Real page images should be uploaded later.
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
