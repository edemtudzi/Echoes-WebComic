-- Add reader episode ratings to reflections.

alter table public.reflections
add column if not exists rating integer
check (rating is null or (rating >= 1 and rating <= 5));

create index if not exists reflections_rating_idx
on public.reflections (episode_id, rating, created_at desc);
