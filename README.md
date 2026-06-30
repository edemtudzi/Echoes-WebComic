# Echoes Web-Comic

Production scaffold for the Echoes of the Source web-comic platform.

## What Exists Now

- Static prototype: `index.html`
- Production architecture: `docs/production-architecture.md`
- Legacy Supabase schema: `supabase/`
- Active Neon schema: `neon/`
- Cloudinary setup: `cloudinary/`
- Next.js app scaffold: `app/`, `components/`, `lib/`

## Production Stack

- Next.js
- Neon Postgres
- App-managed signed sessions
- Cloudinary image storage
- Vercel deployment

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then fill:

```text
DATABASE_URL=
AUTH_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=echoes-comic-assets
```

## Install and Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Neon + Cloudinary Setup Order

1. Create a Neon project.
2. Apply `neon/migrations/20260630165000_initial_neon_schema.sql`.
3. Create a Cloudinary account or open your existing Cloudinary dashboard.
4. Copy your Cloudinary cloud name, API key, and API secret.
5. Add Neon and Cloudinary environment variables to `.env.local`.
6. Start the app.
7. Create your first user account.
8. Edit and run `neon/bootstrap-admin.sql` to promote your account to admin.

## Current App Routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/sign-up` | Create reader account |
| `/sign-in` | Sign in |
| `/library` | Published comic library |
| `/comics/[comicSlug]` | Comic detail |
| `/comics/[comicSlug]/season/[seasonNumber]` | Episode list |
| `/comics/[comicSlug]/season/[seasonNumber]/episode/[episodeNumber]` | Comic reader and reflection form |
| `/progress` | Reader progress and reflection history |
| `/admin` | Admin dashboard |
| `/admin/comics` | Admin comic list |
| `/admin/comics/new` | Create comic |
| `/admin/comics/[comicId]` | Edit comic, add seasons, add episodes |
| `/admin/episodes/[episodeId]/pages` | Upload and manage episode pages |

## Next Build Step

After Neon and Cloudinary are connected, test the full content workflow:

1. Create or sign into the first admin account.
2. Promote it with `neon/bootstrap-admin.sql`.
3. Open `/admin/comics`.
4. Confirm the seeded Echoes comic appears.
5. Open the comic editor.
6. Add/edit seasons and episodes.
7. Upload Episode 1 page images through `/admin/episodes/[episodeId]/pages`; files will be stored in Cloudinary.
8. Publish the uploaded pages.
9. Read Episode 1 as a normal reader.
10. Submit a reflection and confirm Episode 2 unlocks.

The next missing production feature is page reordering. Right now page order is controlled by `page_number`.
