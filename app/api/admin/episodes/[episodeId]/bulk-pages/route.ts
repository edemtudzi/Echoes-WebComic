import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type BulkPageRequest = {
  comicSlug?: string;
  episodeNumber?: number;
  pages?: Array<{
    altText?: string;
    caption?: string;
    fileName?: string;
    imagePath?: string;
    pageNumber?: number;
    status?: string;
  }>;
  replaceExisting?: boolean;
  seasonNumber?: number;
  status?: string;
};

const PAGE_STATUSES = new Set(["draft", "published", "hidden"]);

type CleanBulkPage = {
  altText: string;
  caption: string;
  fileName: string;
  imagePath: string;
  pageNumber: number;
  status: string;
};

function cleanStatus(status: string | undefined) {
  const value = String(status || "").trim().toLowerCase();
  return PAGE_STATUSES.has(value) ? value : null;
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

  const fallbackStatus = cleanStatus(body?.status) || "draft";
  const replaceExisting = body?.replaceExisting !== false;

  const pageNumbers = new Set<number>();
  const fileNames = new Set<string>();
  let cleanedPages: CleanBulkPage[];

  try {
    cleanedPages = pages.map((page, index) => {
      const rowNumber = index + 1;
      const fileName = String(page.fileName || "").trim();
      const imagePath = String(page.imagePath || "").trim();
      const pageNumber = Number(page.pageNumber || 0);
      const altText = String(page.altText || "").trim();
      const caption = String(page.caption || "").trim();
      const pageStatus = page.status ? cleanStatus(page.status) : fallbackStatus;
      const fileNameKey = fileName.toLowerCase();

      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new Error(`Page row ${rowNumber}: pageNumber must be a positive whole number.`);
      }

      if (!fileName) {
        throw new Error(`Page row ${rowNumber}: fileName is required.`);
      }

      if (!imagePath.startsWith("https://")) {
        throw new Error(`Page row ${rowNumber}: a valid Cloudinary image URL is required.`);
      }

      if (!altText) {
        throw new Error(`Page row ${rowNumber}: altText is required.`);
      }

      if (!pageStatus) {
        throw new Error(`Page row ${rowNumber}: status must be draft, published, or hidden.`);
      }

      if (pageNumbers.has(pageNumber)) {
        throw new Error(`Page row ${rowNumber}: duplicate pageNumber ${pageNumber}.`);
      }

      if (fileNames.has(fileNameKey)) {
        throw new Error(`Page row ${rowNumber}: duplicate fileName ${fileName}.`);
      }

      pageNumbers.add(pageNumber);
      fileNames.add(fileNameKey);

      return {
        altText,
        caption,
        fileName,
        imagePath,
        pageNumber,
        status: pageStatus
      };
    }).sort((left, right) => left.pageNumber - right.pageNumber);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid uploaded page metadata.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!cleanedPages.length) {
    return NextResponse.json({ error: "No valid Cloudinary image URLs were provided." }, { status: 400 });
  }

  const cleanedPageNumbers = cleanedPages.map((page) => page.pageNumber);
  const imagePaths = cleanedPages.map((page) => page.imagePath);
  const altTexts = cleanedPages.map((page) => page.altText);
  const captions = cleanedPages.map((page) => page.caption);
  const statuses = cleanedPages.map((page) => page.status);

  try {
    if (!replaceExisting) {
      const existing = await query<{ page_number: number }>(
        `select page_number
         from public.pages
         where episode_id = $1
           and page_number = any($2::int[])`,
        [episodeId, cleanedPageNumbers]
      );

      if (existing.length) {
        return NextResponse.json(
          { error: `Page number(s) already exist: ${existing.map((page) => page.page_number).join(", ")}. Turn on replacement to overwrite them.` },
          { status: 409 }
        );
      }
    }

    if (replaceExisting) {
      await query(
        `insert into public.pages (episode_id, page_number, image_path, alt_text, caption, status)
         select $1, page_number, image_path, alt_text, nullif(caption, ''), status
         from unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::text[]) as page_input(page_number, image_path, alt_text, caption, status)
         on conflict (episode_id, page_number)
         do update set
           image_path = excluded.image_path,
           alt_text = excluded.alt_text,
           caption = excluded.caption,
           status = excluded.status,
           updated_at = now()`,
        [episodeId, cleanedPageNumbers, imagePaths, altTexts, captions, statuses]
      );
    } else {
      await query(
        `insert into public.pages (episode_id, page_number, image_path, alt_text, caption, status)
         select $1, page_number, image_path, alt_text, nullif(caption, ''), status
         from unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::text[]) as page_input(page_number, image_path, alt_text, caption, status)`,
        [episodeId, cleanedPageNumbers, imagePaths, altTexts, captions, statuses]
      );
    }
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
