import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";

type BulkPageRequest = {
  altPrefix?: string;
  caption?: string;
  comicSlug?: string;
  episodeNumber?: number;
  pages?: Array<{
    fileName?: string;
    imagePath?: string;
    pageNumber?: number;
  }>;
  replaceExisting?: boolean;
  seasonNumber?: number;
  status?: string;
};

function cleanStatus(status: string | undefined) {
  return ["draft", "published", "hidden"].includes(status || "") ? status || "draft" : "draft";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const user = await getUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { episodeId } = await params;
  const body = (await request.json().catch(() => null)) as BulkPageRequest | null;
  const pages = Array.isArray(body?.pages) ? body.pages : [];

  if (!pages.length) {
    return NextResponse.json({ error: "No uploaded pages were provided." }, { status: 400 });
  }

  if (pages.length > 80) {
    return NextResponse.json({ error: "Register fewer than 80 pages at once." }, { status: 400 });
  }

  const status = cleanStatus(body?.status);
  const caption = String(body?.caption || "").trim();
  const altPrefix = String(body?.altPrefix || "Episode panel").trim();
  const replaceExisting = body?.replaceExisting !== false;

  const cleanedPages = pages
    .map((page) => ({
      fileName: String(page.fileName || "panel image"),
      imagePath: String(page.imagePath || ""),
      pageNumber: Number(page.pageNumber || 0)
    }))
    .filter((page) => page.pageNumber > 0 && page.imagePath.startsWith("https://"))
    .sort((left, right) => left.pageNumber - right.pageNumber);

  if (!cleanedPages.length) {
    return NextResponse.json({ error: "No valid Cloudinary image URLs were provided." }, { status: 400 });
  }

  const pageNumbers = cleanedPages.map((page) => page.pageNumber);
  const imagePaths = cleanedPages.map((page) => page.imagePath);
  const altTexts = cleanedPages.map((page) => `${altPrefix} ${String(page.pageNumber).padStart(2, "0")}: ${page.fileName}`);
  const captions = cleanedPages.map(() => caption);
  const statuses = cleanedPages.map(() => status);

  try {
    if (replaceExisting) {
      await query(`delete from public.pages where episode_id = $1 and page_number = any($2::int[])`, [episodeId, pageNumbers]);
    }

    await query(
      `insert into public.pages (episode_id, page_number, image_path, alt_text, caption, status)
       select $1, page_number, image_path, alt_text, nullif(caption, ''), status
       from unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::text[]) as page_input(page_number, image_path, alt_text, caption, status)`,
      [episodeId, pageNumbers, imagePaths, altTexts, captions, statuses]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save uploaded pages.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  revalidatePath(`/admin/episodes/${episodeId}/pages`);

  if (body?.comicSlug && body?.seasonNumber && body?.episodeNumber) {
    revalidatePath(`/comics/${body.comicSlug}/season/${body.seasonNumber}/episode/${body.episodeNumber}`);
  }

  return NextResponse.json({ saved: cleanedPages.length });
}
