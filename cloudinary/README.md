# Echoes Cloudinary Setup

Use Cloudinary to store comic page images uploaded through the admin panel.

## 1. Get Credentials

Open the Cloudinary dashboard and copy:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Keep `CLOUDINARY_API_SECRET` server-side only. Never place it in browser code.

## 2. Configure Environment

Add these values to `.env.local`:

```text
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=echoes-comic-assets
```

## 3. Upload Flow

The admin page uploader sends the image to the server action. The server signs the upload request, posts the file to Cloudinary, and stores Cloudinary's `secure_url` in the `pages.image_path` column.

## 4. Test

1. Start the app.
2. Sign in as an admin.
3. Open `/admin/episodes/[episodeId]/pages`.
4. Upload a PNG, JPG, or WebP page.
5. Publish the page.
6. Open the reader route and confirm the image loads.
