import { NextResponse } from "next/server";
import { createSignedCloudinaryUpload } from "@/lib/cloudinary";
import { getUser } from "@/lib/auth";
import { safeFileName, slugify } from "@/lib/slug";

type SignRequest = {
  comicSlug?: string;
  episodeNumber?: number;
  files?: Array<{
    fileName?: string;
    pageNumber?: number;
  }>;
  seasonNumber?: number;
};

function publicIdForPanel({
  comicSlug,
  seasonNumber,
  episodeNumber,
  pageNumber,
  fileName
}: {
  comicSlug: string;
  seasonNumber: number;
  episodeNumber: number;
  pageNumber: number;
  fileName: string;
}) {
  const baseName = safeFileName(fileName).replace(/\.[^.]+$/, "") || `panel-${pageNumber}`;
  const pagePart = `page-${String(pageNumber).padStart(3, "0")}`;

  return [
    comicSlug,
    `season-${seasonNumber}`,
    `episode-${episodeNumber}`,
    pagePart,
    `${baseName}-${crypto.randomUUID()}`
  ].join("/");
}

export async function POST(request: Request) {
  const user = await getUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as SignRequest | null;
  const files = Array.isArray(body?.files) ? body.files : [];
  const comicSlug = slugify(body?.comicSlug || "comic");
  const seasonNumber = Number(body?.seasonNumber || 1);
  const episodeNumber = Number(body?.episodeNumber || 1);

  if (!files.length) {
    return NextResponse.json({ error: "No files were provided." }, { status: 400 });
  }

  if (files.length > 80) {
    return NextResponse.json({ error: "Upload fewer than 80 files at once." }, { status: 400 });
  }

  const uploads = files.map((file, index) => {
    const pageNumber = Number(file.pageNumber || index + 1);
    const fileName = String(file.fileName || `panel-${pageNumber}.png`);
    const publicId = publicIdForPanel({ comicSlug, seasonNumber, episodeNumber, pageNumber, fileName });
    const signedUpload = createSignedCloudinaryUpload(publicId);

    return {
      fileName,
      pageNumber,
      ...signedUpload
    };
  });

  return NextResponse.json({ uploads });
}
