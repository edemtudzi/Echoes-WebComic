import { query } from "@/lib/db";

let assetSchemaPromise: Promise<void> | null = null;

export function ensureAssetColumns() {
  assetSchemaPromise ??= (async () => {
    await query("alter table public.comics add column if not exists cover_image_path text");
    await query("alter table public.comics add column if not exists now_streaming_image_path text");
    await query("alter table public.comics add column if not exists series_poster_image_path text");
    await query("alter table public.seasons add column if not exists cover_image_path text");
    await query("alter table public.episodes add column if not exists cover_image_path text");
  })();

  return assetSchemaPromise;
}
