# Neon + Cloudinary Connection Checklist

## 1. Neon

Create a Neon project:

```text
echoes-webcomic
```

Apply:

```text
neon/migrations/20260630165000_initial_neon_schema.sql
```

Copy the pooled connection string:

```text
DATABASE_URL=postgresql://...
```

## 2. Cloudinary

Open your Cloudinary dashboard and copy:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Use this folder for comic assets:

```text
CLOUDINARY_FOLDER=echoes-comic-assets
```

The API secret stays server-side only in `.env.local`.

## 3. App Environment

Create `.env.local`:

```text
DATABASE_URL=
AUTH_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=echoes-comic-assets
```

Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```

## 4. First Admin

1. Run the app.
2. Create your first account.
3. Edit `neon/bootstrap-admin.sql`.
4. Replace `YOUR_ADMIN_EMAIL@example.com`.
5. Run it in Neon SQL Editor.

## 5. Test Order

1. `/sign-up`
2. `/library`
3. `/admin`
4. `/admin/comics`
5. open Echoes comic
6. open Episode 1 page manager
7. upload a page image
8. set it to `published`
9. read Episode 1 as a reader
10. submit reflection
11. confirm Episode 2 unlocks
