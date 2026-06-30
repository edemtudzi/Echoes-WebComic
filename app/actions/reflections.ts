"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export async function submitReflection(formData: FormData) {
  const episodeId = String(formData.get("episodeId") ?? "");
  const reaction = String(formData.get("reaction") ?? "");
  const body = String(formData.get("body") ?? "");
  const returnPath = String(formData.get("returnPath") ?? "/library");
  const user = await requireUser();

  try {
    await query(
      `select *
       from public.submit_episode_reflection($1, $2, $3, $4)`,
      [user.id, episodeId, reaction, body]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit reflection.";
    redirect(`${returnPath}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(returnPath);
  redirect(`${returnPath}?unlocked=1`);
}
