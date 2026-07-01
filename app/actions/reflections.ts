"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { ensureReflectionRepliesTable } from "@/lib/reflection-replies";

type ReflectionResult = {
  reflection_id: string;
  unlocked_episode_id: string | null;
};

type EpisodeRoute = {
  comic_slug: string;
  season_number: number;
  episode_number: number;
};

async function getEpisodePath(episodeId: string) {
  const route = await one<EpisodeRoute>(
    `select c.slug as comic_slug,
            s.season_number,
            e.episode_number
     from public.episodes e
     join public.seasons s on s.id = e.season_id
     join public.comics c on c.id = s.comic_id
     where e.id = $1`,
    [episodeId]
  );

  if (!route) {
    return null;
  }

  return `/comics/${route.comic_slug}/season/${route.season_number}/episode/${route.episode_number}`;
}

function asRating(value: FormDataEntryValue | null) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

export async function submitReflection(formData: FormData) {
  const episodeId = String(formData.get("episodeId") ?? "");
  const reaction = String(formData.get("reaction") ?? "");
  const rating = asRating(formData.get("rating"));
  const body = String(formData.get("body") ?? "");
  const returnPath = String(formData.get("returnPath") ?? "/library");
  const user = await requireUser();
  let nextEpisodePath: string | null = null;

  try {
    const result = await one<ReflectionResult>(
      `select reflection_id, unlocked_episode_id
       from public.submit_episode_reflection($1, $2, $3, $4)`,
      [user.id, episodeId, reaction, body]
    );

    if (result?.reflection_id) {
      await query(`update public.reflections set moderation_status = 'approved' where id = $1`, [result.reflection_id]);
    }

    if (rating && result?.reflection_id) {
      try {
        await query(`update public.reflections set rating = $1 where id = $2`, [rating, result.reflection_id]);
      } catch {
        // The rating migration may not be applied yet. Reflection submission should still succeed.
      }
    }

    if (result?.unlocked_episode_id) {
      nextEpisodePath = await getEpisodePath(result.unlocked_episode_id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit reflection.";
    redirect(`${returnPath}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(returnPath);
  revalidatePath("/progress");
  revalidatePath("/admin");

  if (nextEpisodePath) {
    revalidatePath(nextEpisodePath);
    redirect(`${nextEpisodePath}?unlocked=1#comments`);
  }

  redirect(`${returnPath}?unlocked=1#comments`);
}

export async function submitReflectionReply(formData: FormData) {
  const reflectionId = String(formData.get("reflectionId") ?? "");
  const episodeId = String(formData.get("episodeId") ?? "");
  const returnPath = String(formData.get("returnPath") ?? "/library");
  const body = String(formData.get("body") ?? "").trim();
  const user = await requireUser();

  if (!body || body.length < 2) {
    redirect(`${returnPath}?error=${encodeURIComponent("Reply with at least 2 characters.")}#comments`);
  }

  try {
    await ensureReflectionRepliesTable();

    const parent = await one<{ id: string }>(
      `select id
       from public.reflections
       where id = $1 and episode_id = $2 and moderation_status = 'approved'`,
      [reflectionId, episodeId]
    );

    if (!parent) {
      throw new Error("This public comment is no longer available for replies.");
    }

    await query(
      `insert into public.reflection_replies (reflection_id, user_id, body, moderation_status)
       values ($1, $2, $3, 'approved')`,
      [reflectionId, user.id, body]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not post reply.";
    redirect(`${returnPath}?error=${encodeURIComponent(message)}#comments`);
  }

  revalidatePath(returnPath);
  revalidatePath("/admin");
  redirect(`${returnPath}#comments`);
}
