# Legacy Supabase Setup

This folder is now retained only as a historical reference.

The active backend setup for Echoes is:

```text
neon/ + cloudinary/
```

Do not apply these Supabase migrations unless you intentionally return to Supabase.

---

# Echoes Web-Comic Supabase Setup

## Files

| File | Purpose |
|---|---|
| `migrations/20260630150000_initial_echoes_webcomic_schema.sql` | Main schema, RLS, storage buckets, seed comic shell |
| `bootstrap-admin.sql` | One-time manual query to promote your first admin |

## Apply Order

1. Create a new Supabase project.
2. Apply the migration SQL.
3. Create your first account through the app once auth is wired.
4. Edit `bootstrap-admin.sql` and replace `YOUR_ADMIN_EMAIL@example.com`.
5. Run `bootstrap-admin.sql` in Supabase SQL editor.
6. Confirm your profile role is `admin`.

## Important Security Notes

- Readers cannot manage comics, seasons, episodes, pages, or unlocks.
- Readers cannot directly insert reflections through table access.
- Reflections should be submitted through `public.submit_episode_reflection(...)`.
- The first episode of Season 1 is readable when published.
- Later episode pages are readable only when the user has an `episode` unlock.
- Storage bucket `comic-assets` is public for published comic images.
- Storage bucket `admin-uploads` is private and admin-managed.

## Reflection RPC

The app should call:

```sql
select *
from public.submit_episode_reflection(
  'EPISODE_UUID_HERE',
  'moved',
  'This episode stayed with me because...'
);
```

Allowed reactions:

```text
moved
curious
disturbed
confused
inspired
other
```

The reflection body must be at least 40 characters.
