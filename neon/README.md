# Echoes Neon Setup

Use this instead of Supabase for the Echoes web-comic platform.

## Files

| File | Purpose |
|---|---|
| `migrations/20260630165000_initial_neon_schema.sql` | Main Neon Postgres schema, functions, seed data |
| `bootstrap-admin.sql` | One-time manual query to promote your first admin |

## Apply Order

1. Create a Neon project named `echoes-webcomic`.
2. Open the Neon SQL Editor.
3. Run `migrations/20260630165000_initial_neon_schema.sql`.
4. Copy your pooled `DATABASE_URL`.
5. Add it to `.env.local`.
6. Start the app.
7. Create your first account.
8. Edit and run `bootstrap-admin.sql` to promote your email to admin.

## Confirm Tables

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected tables:

```text
app_users
comics
episodes
pages
reader_progress
reflections
seasons
unlocks
```

## Confirm Seed Data

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
