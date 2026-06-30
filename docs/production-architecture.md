# Echoes Web-Comic Production Architecture

## Objective

Build a real web-comic platform where readers create accounts, browse comics, read seasons and episodes, leave meaningful reflections, and unlock future content through engagement.

The first production target is not a giant comic marketplace. The first target is:

**Echoes of the Source, Season 1, Episode 1, with real accounts, real comic pages, saved progress, and a reflection-based unlock system.**

## Recommended Stack

Revision note: Supabase was the first backend choice, but the active implementation has moved to Neon Postgres plus Cloudinary because the available Supabase free project limit was already used and Cloudflare R2 activation was blocked by billing.

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js | Good routing, auth pages, server actions/API routes, easy deployment |
| Auth | App-managed signed sessions on Neon users | Keeps the MVP independent from Supabase project limits |
| Database | Neon Postgres | Structured content, progress, reflections, roles |
| File Storage | Cloudinary | Comic page images, covers, avatars |
| Hosting | Vercel | Simple Next.js deployment |
| Admin Access | Role-based `app_users` profile | Keeps normal readers out of content management |

## Main User Flow

1. Visitor lands on homepage.
2. Visitor creates account or signs in.
3. Reader enters comic library.
4. Reader selects a comic.
5. Reader selects an unlocked season.
6. Reader selects an unlocked episode.
7. Reader reads comic pages.
8. At the end, reader submits a reaction and reflection.
9. Platform saves reflection and unlocks the next episode.
10. Reader can return later and continue from saved progress.

## Unlock Principle

Do not require a comment after every page. That is friction and will create fake engagement.

Use this rule:

**Episode unlocks happen after the reader finishes an episode and submits a meaningful reflection.**

Season unlocks happen after the required number of episodes in the previous season are completed.

## Database Schema

### profiles

Stores public and platform-specific user information.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key, matches auth.users.id |
| display_name | text | Reader-visible name |
| email | text | Copied from auth for convenience |
| role | text | `reader`, `admin`, `moderator` |
| trust_score | integer | Starts at 0, increases with useful engagement |
| created_at | timestamptz | Default now |
| updated_at | timestamptz | Updated on profile changes |

### comics

Stores comic series.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| slug | text | Unique URL slug |
| title | text | Example: Echoes of the Source |
| subtitle | text | Optional |
| description | text | Comic summary |
| cover_image_path | text | Cloudinary secure URL or asset path |
| status | text | `draft`, `published`, `archived` |
| sort_order | integer | Library ordering |
| created_at | timestamptz | Default now |
| updated_at | timestamptz | Updated on edits |

### seasons

Stores seasons inside a comic.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| comic_id | uuid | Foreign key to comics.id |
| season_number | integer | 1, 2, 3 |
| title | text | Example: Season 1 |
| description | text | Season summary |
| status | text | `draft`, `published`, `locked`, `archived` |
| unlock_rule | jsonb | Optional rule data |
| created_at | timestamptz | Default now |
| updated_at | timestamptz | Updated on edits |

### episodes

Stores chapters/episodes inside a season.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| season_id | uuid | Foreign key to seasons.id |
| episode_number | integer | 1, 2, 3 |
| title | text | Example: The Glow We Lost |
| synopsis | text | Short episode description |
| status | text | `draft`, `published`, `locked`, `archived` |
| requires_reflection | boolean | Default true |
| created_at | timestamptz | Default now |
| updated_at | timestamptz | Updated on edits |

### pages

Stores individual comic pages/panels.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| episode_id | uuid | Foreign key to episodes.id |
| page_number | integer | Reading order |
| image_path | text | Cloudinary secure URL |
| alt_text | text | Accessibility and SEO |
| caption | text | Optional text/caption |
| status | text | `draft`, `published`, `hidden` |
| created_at | timestamptz | Default now |
| updated_at | timestamptz | Updated on edits |

### reader_progress

Tracks where each reader is.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to profiles.id |
| comic_id | uuid | Foreign key to comics.id |
| season_id | uuid | Foreign key to seasons.id |
| episode_id | uuid | Foreign key to episodes.id |
| last_page_number | integer | Resume point |
| completed | boolean | Episode completion |
| completed_at | timestamptz | Null until completed |
| updated_at | timestamptz | Updated as reader moves |

Unique constraint:

```sql
unique (user_id, episode_id)
```

### reflections

Stores reader reactions and comments after episodes.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to profiles.id |
| comic_id | uuid | Foreign key to comics.id |
| season_id | uuid | Foreign key to seasons.id |
| episode_id | uuid | Foreign key to episodes.id |
| reaction | text | `moved`, `curious`, `disturbed`, `confused`, etc. |
| body | text | Reader reflection |
| quality_score | integer | Optional moderation score |
| moderation_status | text | `pending`, `approved`, `rejected`, `flagged` |
| created_at | timestamptz | Default now |

Unique constraint:

```sql
unique (user_id, episode_id)
```

This prevents one reader from repeatedly submitting reflections to manipulate unlocks.

### unlocks

Stores explicit access grants.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to profiles.id |
| unlockable_type | text | `comic`, `season`, `episode` |
| unlockable_id | uuid | ID of unlocked item |
| reason | text | `signup`, `reflection`, `admin`, `season_complete` |
| created_at | timestamptz | Default now |

Unique constraint:

```sql
unique (user_id, unlockable_type, unlockable_id)
```

### comments_optional_later

Do not build open comment threads in the first production version.

Reason: comments add moderation burden. Reflections are enough for the MVP because they give useful feedback and unlock logic.

Add public comments later only after the reflection system proves useful.

## Image Storage

### Cloudinary folder

Stores public comic images.

Suggested folder structure:

```text
echoes-comic-assets/
  echoes-of-the-source/
    covers/
      cover-main.webp
    season-1/
      episode-1/
        page-001.webp
        page-002.webp
        page-003.webp
```

The MVP stores Cloudinary `secure_url` values in the existing `image_path` columns. That avoids a new database migration while keeping the images immediately readable from the comic pages.

## App Routes

### Public/Auth Routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/sign-in` | Login |
| `/sign-up` | Create account |
| `/forgot-password` | Password recovery |

### Reader Routes

| Route | Purpose |
|---|---|
| `/library` | Comic library |
| `/comics/[comicSlug]` | Comic detail page |
| `/comics/[comicSlug]/season/[seasonNumber]` | Season episode list |
| `/comics/[comicSlug]/season/[seasonNumber]/episode/[episodeNumber]` | Comic reader |
| `/progress` | Reader progress and reflection history |

### Admin Routes

| Route | Purpose |
|---|---|
| `/admin` | Admin dashboard |
| `/admin/comics` | Manage comics |
| `/admin/comics/new` | Create comic |
| `/admin/comics/[comicId]` | Edit comic |
| `/admin/episodes/[episodeId]/pages` | Upload/reorder pages |
| `/admin/reflections` | Review reflections |
| `/admin/readers` | Reader list and progress overview |

## Access Rules

### Reader

Can:

- view published comics
- view unlocked seasons and episodes
- read unlocked pages
- submit one reflection per episode
- view own progress

Cannot:

- upload pages
- edit content
- see other users' private reflections unless later approved for public display

### Admin

Can:

- create/edit comics
- create/edit seasons
- create/edit episodes
- upload comic pages
- publish/unpublish content
- review reflections
- manually unlock content for a reader

### Moderator

Can:

- review reflections
- flag low-quality or abusive submissions
- cannot create or publish official comic content

## Reflection Quality Rules

First version should use simple rules:

- reaction is required
- reflection body minimum: 40 characters
- repeated copy-paste should be rejected
- reader can submit only once per episode

Later version can add AI moderation:

- spam detection
- harmful content detection
- low-effort reflection detection
- sentiment/theme summaries

## Production MVP Build Phases

### Phase 1: Real Auth and Database

Build:

- Neon project
- database migrations
- auth pages
- profile creation after signup
- protected reader routes

### Phase 2: Content Display

Build:

- library page
- comic detail page
- season page
- episode reader
- page image loading from Cloudinary

### Phase 3: Progress and Unlocks

Build:

- track last page read
- mark episode complete
- reflection form
- unlock next episode after valid reflection
- progress page

### Phase 4: Admin Upload System

Build:

- admin route protection
- create comic/season/episode forms
- upload comic pages
- reorder pages
- publish/unpublish controls

### Phase 5: Engagement Intelligence

Build later:

- reflection review dashboard
- quality score
- reader trust score
- analytics: completion rate, drop-off page, most reacted episode

## First Production Content Target

Only build enough content to support this:

```text
Echoes of the Source
Season 1
Episode 1: The Glow We Lost
20-40 real comic pages
Episode 2 locked until reflection
```

Do not build multiple comics before this is working.

## Biggest Risks

| Risk | Problem | Solution |
|---|---|---|
| Fake comments | Readers write nonsense to unlock | Use reflections, minimum quality rules, one submission per episode |
| Scope creep | Too many comics/features too early | Build only Echoes Episode 1 first |
| Weak visual consistency | Comic pages look unrelated | Build character/environment reference packs before generating final pages |
| Admin complexity | Uploading content becomes painful | Build admin tools early, but keep them simple |
| Reader friction | Forced signup can reduce readership | Consider public preview pages before signup later |

## Strategic Recommendation

Start with a closed but polished pilot:

1. Real signup required.
2. One comic available.
3. One episode fully readable.
4. Episode 2 locked.
5. Reflection unlock works.
6. Admin can upload and manage pages.

Then test with 20-50 real readers before creating more episodes.

If readers do not finish Episode 1 or do not care enough to reflect, the problem is the story presentation, not the technology.
