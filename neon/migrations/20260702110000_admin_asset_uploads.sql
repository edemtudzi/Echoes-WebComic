alter table public.comics
  add column if not exists now_streaming_image_path text,
  add column if not exists series_poster_image_path text;

alter table public.seasons
  add column if not exists cover_image_path text;

alter table public.episodes
  add column if not exists cover_image_path text;
