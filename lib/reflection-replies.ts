import { query } from "@/lib/db";

export async function ensureReflectionRepliesTable() {
  await query(`create extension if not exists pgcrypto`);
  await query(
    `create table if not exists public.reflection_replies (
       id uuid primary key default gen_random_uuid(),
       reflection_id uuid not null references public.reflections(id) on delete cascade,
       user_id uuid not null references public.app_users(id) on delete cascade,
       body text not null,
       moderation_status text not null default 'approved',
       created_at timestamptz not null default now()
     )`
  );
  await query(
    `create index if not exists reflection_replies_reflection_created_idx
     on public.reflection_replies (reflection_id, created_at asc)`
  );
}
