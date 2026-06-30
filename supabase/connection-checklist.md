# Echoes Supabase Connection Checklist

Use this when creating the real Echoes Supabase project.

## 1. Create Project

Create a new Supabase project named:

```text
echoes-webcomic
```

Do not reuse Agora or SellLink. Echoes needs its own database.

## 2. Apply Migration

Open Supabase:

```text
SQL Editor -> New query
```

Paste and run:

```text
supabase/migrations/20260630150000_initial_echoes_webcomic_schema.sql
```

Expected result:

- tables are created
- RLS policies are created
- `comic-assets` bucket is created
- `admin-uploads` bucket is created
- Echoes comic shell is seeded
- Season 1 is seeded
- Episodes 1 and 2 are seeded

## 3. Confirm Tables

Run:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected tables:

```text
comics
episodes
pages
profiles
reader_progress
reflections
seasons
unlocks
```

## 4. Confirm Seed Data

Run:

```sql
select c.title as comic, s.title as season, e.episode_number, e.title as episode
from public.comics c
join public.seasons s on s.comic_id = c.id
join public.episodes e on e.season_id = s.id
order by s.season_number, e.episode_number;
```

Expected:

```text
Echoes of the Source / Season 1 / 1 / The Glow We Lost
Echoes of the Source / Season 1 / 2 / Borrowed Light
```

## 5. Add App Environment Values

In the Supabase dashboard:

```text
Project Settings -> API
```

Copy:

```text
Project URL
anon public key
```

Then create:

```text
.env.local
```

with:

```text
NEXT_PUBLIC_SUPABASE_URL=YOUR_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## 6. Create First User

Start the app and create your account through:

```text
/sign-up
```

## 7. Promote First Admin

Edit:

```text
supabase/bootstrap-admin.sql
```

Replace:

```text
YOUR_ADMIN_EMAIL@example.com
```

with your real account email.

Then run it in Supabase SQL editor.

## 8. Confirm Admin

Run:

```sql
select email, role
from public.profiles
where role = 'admin';
```

You should see your email with:

```text
admin
```

## 9. Test App Flow

Test in this order:

1. `/sign-in`
2. `/library`
3. open Echoes of the Source
4. open Season 1
5. open Episode 1
6. upload pages from admin
7. publish pages
8. read as normal reader
9. submit reflection
10. confirm Episode 2 unlocks

## What I Need To Connect It Here

To wire the app environment from this workspace, provide:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

To apply the migration from here instead of manually, this workspace needs one of these:

- an Echoes-specific Supabase connector
- Supabase CLI authenticated to your account
- direct database connection credentials

Do not apply this migration to the Agora or SellLink Supabase projects.
