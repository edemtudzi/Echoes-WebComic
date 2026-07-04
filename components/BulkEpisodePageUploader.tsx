"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BulkEpisodePageUploaderProps = {
  comicSlug: string;
  defaultStartPageNumber: number;
  episodeId: string;
  episodeNumber: number;
  seasonNumber: number;
};

type SignedUpload = {
  apiKey: string;
  cloudName: string;
  fileName: string;
  folder: string;
  pageNumber: number;
  publicId: string;
  signature: string;
  timestamp: number;
};

type BulkCsvRow = {
  altText: string;
  caption: string;
  fileName: string;
  lineNumber: number;
  pageNumber: number;
  status: string;
};

type ProgressRow = {
  fileName: string;
  pageNumber: number;
  state: "waiting" | "uploading" | "done" | "error";
};

type UploadedPage = {
  altText: string;
  caption: string;
  fileName: string;
  imagePath: string;
  pageNumber: number;
  status: string;
};

const PAGE_STATUSES = new Set(["draft", "published", "hidden"]);

function sortFiles(files: File[]) {
  return [...files].sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));
}

function normalizeKey(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function findColumn(headers: string[], candidates: string[]) {
  const normalizedCandidates = new Set(candidates.map(normalizeKey));
  return headers.findIndex((header) => normalizedCandidates.has(normalizeKey(header)));
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function parseBulkCsv(text: string, fallbackStatus: string): BulkCsvRow[] {
  const [headers, ...dataRows] = parseCsv(text);

  if (!headers?.length) {
    throw new Error("CSV is empty.");
  }

  const pageNumberIndex = findColumn(headers, ["page_number", "page", "panel_number", "panel"]);
  const filenameIndex = findColumn(headers, ["filename", "file_name", "image", "image_filename"]);
  const altTextIndex = findColumn(headers, ["alt_text", "alt", "image_alt", "description"]);
  const captionIndex = findColumn(headers, ["caption", "reader_caption", "text"]);
  const statusIndex = findColumn(headers, ["status", "page_status"]);

  if (pageNumberIndex === -1 || filenameIndex === -1 || altTextIndex === -1) {
    throw new Error("CSV must include page_number, filename, and alt_text columns.");
  }

  const pageNumbers = new Set<number>();
  const fileNames = new Set<string>();

  return dataRows.map((cells, index) => {
    const lineNumber = index + 2;
    const pageNumber = Number(cells[pageNumberIndex]?.trim());
    const fileName = cells[filenameIndex]?.trim() ?? "";
    const altText = cells[altTextIndex]?.trim() ?? "";
    const caption = captionIndex === -1 ? "" : cells[captionIndex]?.trim() ?? "";
    const status = ((statusIndex === -1 ? "" : cells[statusIndex]?.trim()) || fallbackStatus).toLowerCase();
    const fileNameKey = imageLookupKey(fileName);

    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new Error(`CSV line ${lineNumber}: page_number must be a positive whole number.`);
    }

    if (!fileName) {
      throw new Error(`CSV line ${lineNumber}: filename is required.`);
    }

    if (!altText) {
      throw new Error(`CSV line ${lineNumber}: alt_text is required.`);
    }

    if (!PAGE_STATUSES.has(status)) {
      throw new Error(`CSV line ${lineNumber}: status must be draft, published, or hidden.`);
    }

    if (pageNumbers.has(pageNumber)) {
      throw new Error(`CSV line ${lineNumber}: duplicate page_number ${pageNumber}.`);
    }

    if (fileNames.has(fileNameKey)) {
      throw new Error(`CSV line ${lineNumber}: duplicate filename ${fileName}.`);
    }

    pageNumbers.add(pageNumber);
    fileNames.add(fileNameKey);

    return {
      altText,
      caption,
      fileName,
      lineNumber,
      pageNumber,
      status
    };
  });
}

function safeFileName(value: string) {
  const clean = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return clean || "page-image";
}

function imageLookupKey(fileName: string) {
  return safeFileName(fileName);
}

function isSupportedImage(file: File) {
  return file.size > 0 && (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name));
}

async function readJsonResponse<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as T & { error?: string } | null;

  if (!response.ok) {
    throw new Error(body?.error || "Upload request failed.");
  }

  if (!body) {
    throw new Error("Upload request returned an empty response.");
  }

  return body;
}

export function BulkEpisodePageUploader({
  comicSlug,
  defaultStartPageNumber,
  episodeId,
  episodeNumber,
  seasonNumber
}: BulkEpisodePageUploaderProps) {
  const router = useRouter();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [status, setStatus] = useState("published");
  const [uploading, setUploading] = useState(false);

  const orderedFiles = useMemo(() => sortFiles(files), [files]);
  const templateHref = useMemo(() => {
    const templateCsv = [
      "page_number,filename,alt_text,caption,status",
      `${defaultStartPageNumber},episode-${episodeNumber}-panel-${String(defaultStartPageNumber).padStart(2, "0")}.png,"Describe what appears in this panel.","Reader caption shown under the image.",published`
    ].join("\n");

    return `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`;
  }, [defaultStartPageNumber, episodeNumber]);

  async function uploadAll() {
    setError("");

    if (!orderedFiles.length) {
      setError("Choose the episode panel images first.");
      return;
    }

    if (!csvFile) {
      setError("Choose a CSV file with page_number, filename, alt_text, caption, and status columns.");
      return;
    }

    try {
      const invalidImage = orderedFiles.find((file) => !isSupportedImage(file));
      if (invalidImage) {
        throw new Error(`${invalidImage.name} is not a supported image. Use PNG, JPG, JPEG, or WEBP.`);
      }

      const fileMap = new Map<string, File>();
      for (const file of orderedFiles) {
        const fileNameKey = imageLookupKey(file.name);

        if (fileMap.has(fileNameKey)) {
          throw new Error(`Duplicate uploaded image filename: ${file.name}.`);
        }

        fileMap.set(fileNameKey, file);
      }

      const csvRows = parseBulkCsv(await csvFile.text(), status);
      if (!csvRows.length) {
        throw new Error("CSV has headers but no page rows.");
      }

      const matchedKeys = new Set<string>();
      const uploadPlan = csvRows
        .map((row) => {
          const fileNameKey = imageLookupKey(row.fileName);
          const file = fileMap.get(fileNameKey);

          if (!file) {
            throw new Error(`CSV line ${row.lineNumber}: no uploaded image matches ${row.fileName}.`);
          }

          matchedKeys.add(fileNameKey);
          return { file, row };
        })
        .sort((left, right) => left.row.pageNumber - right.row.pageNumber);

      const extraFiles = orderedFiles.filter((file) => !matchedKeys.has(imageLookupKey(file.name)));
      if (extraFiles.length) {
        throw new Error(`These uploaded images are not listed in the CSV: ${extraFiles.map((file) => file.name).join(", ")}.`);
      }

      setUploading(true);
      const progressRows = uploadPlan.map(({ row }) => ({
        fileName: row.fileName,
        pageNumber: row.pageNumber,
        state: "waiting" as const
      }));
      setProgress(progressRows);

      const signResponse = await fetch("/api/admin/cloudinary/sign-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comicSlug,
          episodeNumber,
          files: uploadPlan.map(({ row }) => ({ fileName: row.fileName, pageNumber: row.pageNumber })),
          seasonNumber
        })
      });
      const signed = await readJsonResponse<{ uploads: SignedUpload[] }>(signResponse);
      const uploadedPages: UploadedPage[] = [];

      for (const [index, signedUpload] of signed.uploads.entries()) {
        const plan = uploadPlan[index];

        if (!plan) {
          throw new Error(`Missing file for page ${signedUpload.pageNumber}.`);
        }

        const { file, row } = plan;
        setProgress((current) => current.map((row) => row.pageNumber === signedUpload.pageNumber ? { ...row, state: "uploading" } : row));

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", signedUpload.apiKey);
        formData.append("folder", signedUpload.folder);
        formData.append("public_id", signedUpload.publicId);
        formData.append("timestamp", String(signedUpload.timestamp));
        formData.append("signature", signedUpload.signature);

        const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/image/upload`, {
          method: "POST",
          body: formData
        });

        if (!cloudinaryResponse.ok) {
          const message = await cloudinaryResponse.text();
          setProgress((current) => current.map((row) => row.pageNumber === signedUpload.pageNumber ? { ...row, state: "error" } : row));
          throw new Error(`Cloudinary rejected ${file.name}: ${message}`);
        }

        const uploaded = (await cloudinaryResponse.json()) as { secure_url?: string };

        if (!uploaded.secure_url) {
          throw new Error(`Cloudinary did not return a URL for ${file.name}.`);
        }

        uploadedPages.push({
          altText: row.altText,
          caption: row.caption,
          fileName: file.name,
          imagePath: uploaded.secure_url,
          pageNumber: row.pageNumber,
          status: row.status
        });
        setProgress((current) => current.map((row) => row.pageNumber === signedUpload.pageNumber ? { ...row, state: "done" } : row));
      }

      const saveResponse = await fetch(`/api/admin/episodes/${episodeId}/bulk-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comicSlug,
          episodeNumber,
          pages: uploadedPages,
          replaceExisting,
          seasonNumber,
          status
        })
      });
      const saved = await readJsonResponse<{ saved: number }>(saveResponse);

      router.refresh();
      setFiles([]);
      setCsvFile(null);
      setProgress([]);
      setError(`Saved ${saved.saved} page(s).`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="form-card bulk-upload-card">
      <div className="page-row-head">
        <div>
          <div className="eyebrow">Bulk Episode Upload</div>
          <h3>Upload panels + CSV metadata</h3>
          <p className="hint">Map every image to its page number, alt text, caption, and status before upload.</p>
        </div>
        <a className="button-small" href={templateHref} download={`episode-${episodeNumber}-pages-template.csv`}>
          CSV Template
        </a>
      </div>

      {error ? <p className="warning">{error}</p> : null}

      <div className="bulk-upload-grid">
        <div className="field">
          <label htmlFor="bulk-panel-images">Panel images</label>
          <input
            id="bulk-panel-images"
            multiple
            name="bulkPanelImages"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={(event) => setFiles(sortFiles(Array.from(event.target.files || [])))}
          />
          <span className="hint">Filenames must match the CSV, for example episode-1-panel-01.png.</span>
        </div>
        <div className="field">
          <label htmlFor="bulk-metadata-csv">Captions + alt text CSV</label>
          <input
            id="bulk-metadata-csv"
            name="metadataCsv"
            type="file"
            accept=".csv,text/csv"
            disabled={uploading}
            onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
          />
          <span className="hint">Required columns: page_number, filename, alt_text. Optional columns: caption, status.</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="bulk-status">Fallback status</label>
        <select id="bulk-status" value={status} disabled={uploading} onChange={(event) => setStatus(event.target.value)}>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="hidden">Hidden</option>
        </select>
        <span className="hint">Used only when a CSV row has no status value.</span>
      </div>

      <label className="bulk-upload-check">
        <input
          checked={replaceExisting}
          disabled={uploading}
          type="checkbox"
          onChange={(event) => setReplaceExisting(event.target.checked)}
        />
        Replace existing pages with the same page numbers
      </label>

      <div className="csv-note">
        <strong>CSV format:</strong> <code>page_number,filename,alt_text,caption,status</code>
      </div>

      {orderedFiles.length ? (
        <div className="bulk-file-list">
          {orderedFiles.map((file) => (
            <span key={`${file.name}-${file.lastModified}`}>
              {file.name}
            </span>
          ))}
        </div>
      ) : null}

      {progress.length ? (
        <div className="bulk-progress-list">
          {progress.map((row) => (
            <span className={`bulk-progress-row ${row.state}`} key={`${row.pageNumber}-${row.fileName}`}>
              Page {row.pageNumber}: {row.fileName} — {row.state}
            </span>
          ))}
        </div>
      ) : null}

      <div className="actions">
        <button className="button" type="button" disabled={uploading || !orderedFiles.length || !csvFile} onClick={uploadAll}>
          {uploading ? `Uploading ${progress.filter((row) => row.state === "done").length}/${progress.length}` : `Upload ${orderedFiles.length || "All"} Panels`}
        </button>
      </div>

      <style>{`
        .bulk-upload-card { display: grid; gap: 12px; }
        .bulk-upload-card h3 { margin-bottom: 0; }
        .bulk-upload-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .bulk-upload-check { display: flex; align-items: center; gap: 10px; color: var(--muted); font-weight: 800; }
        .bulk-upload-check input { width: auto; }
        .csv-note { padding: 10px; border: 1px dashed rgba(9,9,9,.18); border-radius: 14px; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
        .bulk-file-list, .bulk-progress-list { display: grid; gap: 6px; max-height: 220px; overflow: auto; padding: 10px; border: 1px solid rgba(9,9,9,.12); border-radius: 16px; background: rgba(255,254,248,.68); }
        .bulk-file-list span, .bulk-progress-row { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
        .bulk-progress-row.done { color: #1e6b36; }
        .bulk-progress-row.uploading { color: #8b6500; font-weight: 900; }
        .bulk-progress-row.error { color: #791c1c; font-weight: 900; }
        @media(max-width: 760px) { .bulk-upload-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
