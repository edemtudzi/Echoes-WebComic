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

type EpisodeContext = EpisodeRoute & {
  comic_id: string;
};

type NextEpisodeRoute = EpisodeRoute & {
  id: string;
};

function episodePath(route: EpisodeRoute) {
  return `/comics/${route.comic_slug}/season/${route.season_number}/episode/${route.episode_number}`;
}

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

  return route ? episodePath(route) : null;
}

async function getEpisodeContext(episodeId: string) {
  return one<EpisodeContext>(
    `select c.id as comic_id,
            c.slug as comic_slug,
            s.season_number,
            e.episode_number
     from public.episodes e
     join public.seasons s on s.id = e.season_id
     join public.comics c on c.id = s.comic_id
     where e.id = $1`,
    [episodeId]
  );
}

async function getNextEpisodeRoute(episodeId: string) {
  const current = await getEpisodeContext(episodeId);

  if (!current) {
    return null;
  }

  return one<NextEpisodeRoute>(
    `select id, comic_slug, season_number, episode_number
     from (
       select e.id::text as id,
              c.slug as comic_slug,
              s.season_number,
              e.episode_number,
              0 as priority
       from public.episodes e
       join public.seasons s on s.id = e.season_id
       join public.comics c on c.id = s.comic_id
       where c.id = $1
         and s.season_number = $2
         and e.episode_number > $3
         and e.status <> 'archived'

       union all

       select e.id::text as id,
              c.slug as comic_slug,
              s.season_number,
              e.episode_number,
              1 as priority
       from public.episodes e
       join public.seasons s on s.id = e.season_id
       join public.comics c on c.id = s.comic_id
       where c.id = $1
         and s.season_number > $2
         and e.status <> 'archived'
     ) next_episode
     order by priority asc, season_number asc, episode_number asc
     limit 1`,
    [current.comic_id, current.season_number, current.episode_number]
  );
}

function asRating(value: FormDataEntryValue | null) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

async function prepareReflectionSubmission() {
  await query(`alter table public.reflections drop constraint if exists reflections_user_id_episode_id_key`);
  await query(`alter table public.reflections alter column body type text`);

  try {
    await ensureReflectionRepliesTable();
    await query(`alter table public.reflection_replies alter column body type text`);
  } catch {
    // Replies are optional. Reflection submission must not fail because reply storage is unavailable.
  }

  await query(`
    do $$
    declare
      body_constraint record;
    begin
      for body_constraint in
        select conrelid::regclass::text as table_name,
               conname
        from pg_constraint
        where contype = 'c'
          and conrelid in (
            select oid
            from pg_class
            where oid in (to_regclass('public.reflections'), to_regclass('public.reflection_replies'))
          )
          and pg_get_constraintdef(oid) ilike '%body%'
      loop
        execute format('alter table %s drop constraint if exists %I', body_constraint.table_name, body_constraint.conname);
      end loop;
    end $$;
  `);
}

async function setReflectionRating(reflectionId: string, rating: number | null) {
  if (!rating) {
    return;
  }

  try {
    await query(`update public.reflections set rating = $1 where id = $2`, [rating, reflectionId]);
  } catch {
    // Older databases may not have the rating column yet. The reflection itself should still be valid.
  }
}

async function insertReflectionDirectly({
  body,
  episodeId,
  rating,
  reaction,
  userId
}: {
  body: string;
  episodeId: string;
  rating: number | null;
  reaction: string;
  userId: string;
}) {
  const reflection = await one<{ id: string }>(
    `insert into public.reflections (episode_id, user_id, reaction, body, moderation_status)
     values ($1, $2, $3, $4, 'approved')
     returning id::text as id`,
    [episodeId, userId, reaction || "other", body]
  );

  if (reflection?.id) {
    await setReflectionRating(reflection.id, rating);
  }

  return reflection?.id ?? null;
}

async function unlockNextEpisodeForUser(userId: string, episodeId: string) {
  const nextEpisode = await getNextEpisodeRoute(episodeId);

  if (!nextEpisode) {
    return null;
  }

  await query(
    `insert into public.unlocks (user_id, unlockable_type, unlockable_id)
     values ($1, 'episode', $2)
     on conflict do nothing`,
    [userId, nextEpisode.id]
  );

  return episodePath(nextEpisode);
}

export async function submitReflection(formData: FormData) {
  const episodeId = String(formData.get("episodeId") ?? "");
  const reaction = String(formData.get("reaction") ?? "");
  const rating = asRating(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();
  const returnPath = String(formData.get("returnPath") ?? "/library");
  const user = await requireUser();
  let nextEpisodePath: string | null = null;

  if (!body) {
    redirect(`${returnPath}?error=${encodeURIComponent("Write a comment before posting.")}#comments`);
  }

  try {
    await prepareReflectionSubmission();

    let result: ReflectionResult | null = null;

    try {
      result = await one<ReflectionResult>(
        `select reflection_id, unlocked_episode_id
         from public.submit_episode_reflection($1, $2, $3, $4)`,
        [user.id, episodeId, reaction, body]
      );
    } catch {
      result = null;
    }

    if (result?.reflection_id) {
      await query(`update public.reflections set moderation_status = 'approved' where id = $1`, [result.reflection_id]);
      await setReflectionRating(result.reflection_id, rating);
    } else {
      await insertReflectionDirectly({ body, episodeId, rating, reaction, userId: user.id });
    }

    if (result?.unlocked_episode_id) {
      nextEpisodePath = await getEpisodePath(result.unlocked_episode_id);
    }

    if (!nextEpisodePath) {
      nextEpisodePath = await unlockNextEpisodeForUser(user.id, episodeId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit reflection.";
    redirect(`${returnPath}?error=${encodeURIComponent(message)}#comments`);
  }

  revalidatePath(returnPath);
  revalidatePath("/progress");
  revalidatePath("/admin");

  if (nextEpisodePath) {
    revalidatePath(nextEpisodePath);
    redirect(`${nextEpisodePath}?unlocked=1`);
  }

  redirect(`${returnPath}?posted=1#comments`);
}

export async function submitReflectionReply(formData: FormData) {
  const reflectionId = String(formData.get("reflectionId") ?? "");
  const episodeId = String(formData.get("episodeId") ?? "");
  const returnPath = String(formData.get("returnPath") ?? "/library");
  const body = String(formData.get("body") ?? "").trim();
  const user = await requireUser();

  if (!body) {
    redirect(`${returnPath}?error=${encodeURIComponent("Write a reply before posting.")}#comments`);
  }

  try {
    await prepareReflectionSubmission();
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
