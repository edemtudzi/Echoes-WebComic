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

export async function createComic(formData: FormData) {
  await requireAdmin();
  const title = asText(formData, "title");
  const slug = slugify(asText(formData, "slug") || title);
  let comicId = "";

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create comic.";
    redirect(`/admin/comics/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/comics");
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

export async function uploadEpisodePage(formData: FormData) {
  await requireAdmin();
  const episodeId = asText(formData, "episodeId");
  const comicSlug = slugify(asText(formData, "comicSlug") || "comic");
  const seasonNumber = asNumber(formData, "seasonNumber", 1);
  const episodeNumber = asNumber(formData, "episodeNumber", 1);
  const pageNumber = asNumber(formData, "page_number", 1);
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/episodes/${episodeId}/pages?error=${encodeURIComponent("Choose an image to upload.")}`);
  }

  const baseName = safeFileName(file.name).replace(/\.[^.]+$/, "");
  const publicId = `${comicSlug}/season-${seasonNumber}/episode-${episodeNumber}/page-${String(pageNumber).padStart(3, "0")}-${baseName}-${crypto.randomUUID()}`;

  try {
    const upload = await uploadImageToCloudinary(publicId, file);
    await query(
      `insert into public.pages (episode_id, page_number, image_path, alt_text, caption, status)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        episodeId,
        pageNumber,
        upload.secure_url,
        asText(formData, "alt_text"),
        asText(formData, "caption") || null,
        asText(formData, "status") || "draft"
      ]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload page.";
    redirect(`/admin/episodes/${episodeId}/pages?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/episodes/${episodeId}/pages`);
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
