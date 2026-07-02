"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { safeFileName, slugify } from "@/lib/slug";

function asText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function asNumber(formData: FormData, key: string, fallback = 1) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function hasUpload(file: FormDataEntryValue | null): file is File {
  return file instanceof File && file.size > 0;
}

function requireUpload(formData: FormData, key = "image") {
  const file = formData.get(key);

  if (!hasUpload(file)) {
    throw new Error("Choose an image to upload.");
  }

  return file;
}

function publicIdFromParts(parts: string[], file: File) {
  const baseName = safeFileName(file.name).replace(/\.[^.]+$/, "");
  return [...parts, `${baseName}-${crypto.randomUUID()}`].join("/");
}

async function uploadPageImage({
  formData,
  comicSlug,
  seasonNumber,
  episodeNumber,
  pageNumber,
  imageKey = "image",
  suffix = ""
}: {
  formData: FormData;
  comicSlug: string;
  seasonNumber: number;
  episodeNumber: number;
  pageNumber: number;
  imageKey?: string;
  suffix?: string;
}) {
  const file = formData.get(imageKey);

  if (!hasUpload(file)) {
    return null;
  }

  const pagePart = `page-${String(pageNumber).padStart(3, "0")}${suffix ? `-${suffix}` : ""}`;
  const publicId = publicIdFromParts([comicSlug, `season-${seasonNumber}`, `episode-${episodeNumber}`, pagePart], file);

  return uploadImageToCloudinary(publicId, file);
}

async function uploadPageFromForm({
  formData,
  episodeId,
  comicSlug,
  seasonNumber,
  episodeNumber,
  pageNumber,
  imageKey = "image"
}: {
  formData: FormData;
  episodeId: string;
  comicSlug: string;
  seasonNumber: number;
  episodeNumber: number;
  pageNumber: number;
  imageKey?: string;
}) {
  const upload = await uploadPageImage({ formData, comicSlug, seasonNumber, episodeNumber, pageNumber, imageKey });

  if (!upload) {
    return;
  }

  await query(
    `insert into public.pages (episode_id, page_number, image_path, alt_text, caption, status)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      episodeId,
      pageNumber,
      upload.secure_url,
      asText(formData, "alt_text") || asText(formData, "first_page_alt_text"),
      asText(formData, "caption") || asText(formData, "first_page_caption") || null,
      asText(formData, "status") || asText(formData, "page_status") || asText(formData, "first_page_status") || "draft"
    ]
  );
}

export async function createComic(formData: FormData) {
  await requireAdmin();
  const title = asText(formData, "title");
  const slug = slugify(asText(formData, "slug") || title);
  const seasonTitle = asText(formData, "first_season_title");
  const episodeTitle = asText(formData, "first_episode_title");
  const firstPageFile = formData.get("first_page_image");
  const shouldCreateFirstContent = Boolean(seasonTitle || episodeTitle || hasUpload(firstPageFile));
  let comicId = "";
  let episodeId = "";

  try {
    const comic = await one<{ id: string }>(
      `insert into public.comics (title, slug, subtitle, description, status, sort_order)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        title,
        slug,
        asText(formData, "subtitle") || null,
        asText(formData, "description"),
        asText(formData, "status") || "draft",
        asNumber(formData, "sort_order", 0)
      ]
    );

    comicId = comic?.id ?? "";

    if (shouldCreateFirstContent && comicId) {
      const seasonNumber = asNumber(formData, "first_season_number", 1);
      const episodeNumber = asNumber(formData, "first_episode_number", 1);
      const season = await one<{ id: string }>(
        `insert into public.seasons (comic_id, season_number, title, description, status)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [
          comicId,
          seasonNumber,
          seasonTitle || "Season 1",
          asText(formData, "first_season_description"),
          asText(formData, "first_season_status") || "draft"
        ]
      );

      if (season?.id) {
        const episode = await one<{ id: string }>(
          `insert into public.episodes (season_id, episode_number, title, synopsis, status, requires_reflection)
           values ($1, $2, $3, $4, $5, $6)
           returning id`,
          [
            season.id,
            episodeNumber,
            episodeTitle || "Episode 1",
            asText(formData, "first_episode_synopsis"),
            asText(formData, "first_episode_status") || "draft",
            formData.get("first_requires_reflection") !== "off"
          ]
        );

        episodeId = episode?.id ?? "";

        if (episodeId && hasUpload(firstPageFile)) {
          await uploadPageFromForm({
            formData,
            episodeId,
            comicSlug: slug,
            seasonNumber,
            episodeNumber,
            pageNumber: asNumber(formData, "first_page_number", 1),
            imageKey: "first_page_image"
          });
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create comic.";
    redirect(`/admin/comics/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/comics");
  revalidatePath("/admin");

  if (episodeId) {
    redirect(`/admin/episodes/${episodeId}/pages?saved=1`);
  }

  redirect(`/admin/comics/${comicId}`);
}

export async function updateComic(formData: FormData) {
  await requireAdmin();
  const comicId = asText(formData, "comicId");
  const title = asText(formData, "title");
  const slug = slugify(asText(formData, "slug") || title);

  try {
    await query(
      `update public.comics
       set title = $1,
           slug = $2,
           subtitle = $3,
           description = $4,
           status = $5,
           sort_order = $6
       where id = $7`,
      [
        title,
        slug,
        asText(formData, "subtitle") || null,
        asText(formData, "description"),
        asText(formData, "status") || "draft",
        asNumber(formData, "sort_order", 0),
        comicId
      ]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update comic.";
    redirect(`/admin/comics/${comicId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/comics");
  revalidatePath(`/admin/comics/${comicId}`);
  redirect(`/admin/comics/${comicId}?saved=1`);
}

export async function uploadComicAsset(formData: FormData) {
  await requireAdmin();
  const comicId = asText(formData, "comicId");
  const comicSlug = slugify(asText(formData, "comicSlug") || "comic");
  const assetType = asText(formData, "assetType");
  const assets: Record<string, { column: string; pathPart: string; label: string }> = {
    cover: { column: "cover_image_path", pathPart: "series-cover", label: "series/library cover" },
    now_streaming: { column: "now_streaming_image_path", pathPart: "now-streaming-poster", label: "now streaming poster" },
    series_poster: { column: "series_poster_image_path", pathPart: "series-poster", label: "series poster" }
  };
  const asset = assets[assetType];

  if (!asset) {
    redirect(`/admin/comics/${comicId}?error=${encodeURIComponent("Unknown comic asset type.")}`);
  }

  try {
    const file = requireUpload(formData);
    const publicId = publicIdFromParts([comicSlug, "series-assets", asset.pathPart], file);
    const upload = await uploadImageToCloudinary(publicId, file);

    await query(`update public.comics set ${asset.column} = $1 where id = $2`, [upload.secure_url, comicId]);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Could not upload ${asset.label}.`;
    redirect(`/admin/comics/${comicId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/admin/comics/${comicId}`);
  redirect(`/admin/comics/${comicId}?saved=1`);
}

export async function createSeason(formData: FormData) {
  await requireAdmin();
  const comicId = asText(formData, "comicId");

  try {
    await query(
      `insert into public.seasons (comic_id, season_number, title, description, status)
       values ($1, $2, $3, $4, $5)`,
      [
        comicId,
        asNumber(formData, "season_number", 1),
        asText(formData, "title"),
        asText(formData, "description"),
        asText(formData, "status") || "draft"
      ]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create season.";
    redirect(`/admin/comics/${comicId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/comics/${comicId}`);
  redirect(`/admin/comics/${comicId}?saved=1`);
}

export async function uploadSeasonCover(formData: FormData) {
  await requireAdmin();
  const comicId = asText(formData, "comicId");
  const seasonId = asText(formData, "seasonId");
  const comicSlug = slugify(asText(formData, "comicSlug") || "comic");
  const seasonNumber = asNumber(formData, "seasonNumber", 1);

  try {
    const file = requireUpload(formData);
    const publicId = publicIdFromParts([comicSlug, `season-${seasonNumber}`, "season-cover"], file);
    const upload = await uploadImageToCloudinary(publicId, file);

    await query(`update public.seasons set cover_image_path = $1 where id = $2 and comic_id = $3`, [
      upload.secure_url,
      seasonId,
      comicId
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload season cover.";
    redirect(`/admin/comics/${comicId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/comics/${comicId}`);
  redirect(`/admin/comics/${comicId}?saved=1`);
}

export async function createEpisode(formData: FormData) {
  await requireAdmin();
  const comicId = asText(formData, "comicId");
  const seasonId = asText(formData, "seasonId");
  let episodeId = "";

  try {
    const episode = await one<{ id: string }>(
      `insert into public.episodes (season_id, episode_number, title, synopsis, status, requires_reflection)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        seasonId,
        asNumber(formData, "episode_number", 1),
        asText(formData, "title"),
        asText(formData, "synopsis"),
        asText(formData, "status") || "draft",
        formData.get("requires_reflection") === "on"
      ]
    );

    episodeId = episode?.id ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create episode.";
    redirect(`/admin/comics/${comicId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/comics/${comicId}`);
  redirect(`/admin/episodes/${episodeId}/pages`);
}

export async function uploadEpisodeCover(formData: FormData) {
  await requireAdmin();
  const episodeId = asText(formData, "episodeId");
  const comicSlug = slugify(asText(formData, "comicSlug") || "comic");
  const seasonNumber = asNumber(formData, "seasonNumber", 1);
  const episodeNumber = asNumber(formData, "episodeNumber", 1);

  try {
    const file = requireUpload(formData);
    const publicId = publicIdFromParts([comicSlug, `season-${seasonNumber}`, `episode-${episodeNumber}`, "episode-cover"], file);
    const upload = await uploadImageToCloudinary(publicId, file);

    await query(`update public.episodes set cover_image_path = $1 where id = $2`, [upload.secure_url, episodeId]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload episode cover.";
    redirect(`/admin/episodes/${episodeId}/pages?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/episodes/${episodeId}/pages`);
  redirect(`/admin/episodes/${episodeId}/pages?saved=1`);
}

export async function uploadEpisodePage(formData: FormData) {
  await requireAdmin();
  const episodeId = asText(formData, "episodeId");
  const comicSlug = slugify(asText(formData, "comicSlug") || "comic");
  const seasonNumber = asNumber(formData, "seasonNumber", 1);
  const episodeNumber = asNumber(formData, "episodeNumber", 1);
  const pageNumber = asNumber(formData, "page_number", 1);
  const file = formData.get("image");

  if (!hasUpload(file)) {
    redirect(`/admin/episodes/${episodeId}/pages?error=${encodeURIComponent("Choose an image to upload.")}`);
  }

  try {
    await uploadPageFromForm({ formData, episodeId, comicSlug, seasonNumber, episodeNumber, pageNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload page.";
    redirect(`/admin/episodes/${episodeId}/pages?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/episodes/${episodeId}/pages`);
  redirect(`/admin/episodes/${episodeId}/pages?saved=1`);
}

export async function replaceEpisodePageImage(formData: FormData) {
  await requireAdmin();
  const episodeId = asText(formData, "episodeId");
  const pageId = asText(formData, "pageId");
  const comicSlug = slugify(asText(formData, "comicSlug") || "comic");
  const seasonNumber = asNumber(formData, "seasonNumber", 1);
  const episodeNumber = asNumber(formData, "episodeNumber", 1);
  const pageNumber = asNumber(formData, "pageNumber", 1);
  const file = formData.get("replacementImage");

  if (!hasUpload(file)) {
    redirect(`/admin/episodes/${episodeId}/pages?error=${encodeURIComponent("Choose a replacement image.")}`);
  }

  try {
    const upload = await uploadPageImage({
      formData,
      comicSlug,
      seasonNumber,
      episodeNumber,
      pageNumber,
      imageKey: "replacementImage",
      suffix: "replacement"
    });

    if (!upload) {
      throw new Error("Choose a replacement image.");
    }

    await query(
      `update public.pages
       set image_path = $1,
           alt_text = coalesce(nullif($2, ''), alt_text),
           caption = case when $3 = '' then caption else $3 end
       where id = $4 and episode_id = $5`,
      [upload.secure_url, asText(formData, "alt_text"), asText(formData, "caption"), pageId, episodeId]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not replace page image.";
    redirect(`/admin/episodes/${episodeId}/pages?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/episodes/${episodeId}/pages`);
  revalidatePath("/admin");
  redirect(`/admin/episodes/${episodeId}/pages?saved=1`);
}

export async function updatePageStatus(formData: FormData) {
  await requireAdmin();
  const episodeId = asText(formData, "episodeId");
  const pageId = asText(formData, "pageId");
  const status = asText(formData, "status");

  try {
    await query(`update public.pages set status = $1 where id = $2`, [status, pageId]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update page.";
    redirect(`/admin/episodes/${episodeId}/pages?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/episodes/${episodeId}/pages`);
  redirect(`/admin/episodes/${episodeId}/pages?saved=1`);
}
