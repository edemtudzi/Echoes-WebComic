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

type ProgressRow = {
  fileName: string;
  pageNumber: number;
  state: "waiting" | "uploading" | "done" | "error";
};

function sortFiles(files: File[]) {
  return [...files].sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));
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
  const [altPrefix, setAltPrefix] = useState(`Episode ${episodeNumber} panel`);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [startPageNumber, setStartPageNumber] = useState(defaultStartPageNumber);
  const [status, setStatus] = useState("published");
  const [uploading, setUploading] = useState(false);

  const orderedFiles = useMemo(() => sortFiles(files), [files]);

  async function uploadAll() {
    setError("");

    if (!orderedFiles.length) {
      setError("Choose the episode panel images first.");
      return;
    }

    setUploading(true);
    const rows = orderedFiles.map((file, index) => ({
      fileName: file.name,
      pageNumber: startPageNumber + index,
      state: "waiting" as const
    }));
    setProgress(rows);

    try {
      const signResponse = await fetch("/api/admin/cloudinary/sign-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comicSlug,
          episodeNumber,
          files: rows.map((row) => ({ fileName: row.fileName, pageNumber: row.pageNumber })),
          seasonNumber
        })
      });
      const signed = await readJsonResponse<{ uploads: SignedUpload[] }>(signResponse);
      const uploadedPages: Array<{ fileName: string; imagePath: string; pageNumber: number }> = [];

      for (const [index, signedUpload] of signed.uploads.entries()) {
        const file = orderedFiles[index];

        if (!file) {
          throw new Error(`Missing file for page ${signedUpload.pageNumber}.`);
        }

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
          fileName: file.name,
          imagePath: uploaded.secure_url,
          pageNumber: signedUpload.pageNumber
        });
        setProgress((current) => current.map((row) => row.pageNumber === signedUpload.pageNumber ? { ...row, state: "done" } : row));
      }

      const saveResponse = await fetch(`/api/admin/episodes/${episodeId}/bulk-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          altPrefix,
          caption,
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
      <div className="eyebrow">Bulk Episode Upload</div>
      <h3>Upload all panels at once</h3>
      <p className="hint">Select panel files together. They will be sorted by filename and saved as consecutive story pages.</p>

      {error ? <p className="warning">{error}</p> : null}

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
        <span className="hint">Best naming: episode-1-panel-01.png, episode-1-panel-02.png, and so on.</span>
      </div>

      <div className="bulk-upload-grid">
        <div className="field">
          <label htmlFor="bulk-start-page">Start page number</label>
          <input
            id="bulk-start-page"
            min={1}
            type="number"
            value={startPageNumber}
            disabled={uploading}
            onChange={(event) => setStartPageNumber(Number(event.target.value || defaultStartPageNumber))}
          />
        </div>
        <div className="field">
          <label htmlFor="bulk-status">Page status</label>
          <select id="bulk-status" value={status} disabled={uploading} onChange={(event) => setStatus(event.target.value)}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="bulk-alt-prefix">Alt text prefix</label>
        <input
          id="bulk-alt-prefix"
          value={altPrefix}
          disabled={uploading}
          onChange={(event) => setAltPrefix(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="bulk-caption">Shared caption</label>
        <textarea
          id="bulk-caption"
          value={caption}
          disabled={uploading}
          placeholder="Optional. Leave empty if each panel already contains the text readers need."
          onChange={(event) => setCaption(event.target.value)}
        />
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

      {orderedFiles.length ? (
        <div className="bulk-file-list">
          {orderedFiles.map((file, index) => (
            <span key={`${file.name}-${file.lastModified}`}>
              Page {startPageNumber + index}: {file.name}
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
        <button className="button" type="button" disabled={uploading || !orderedFiles.length} onClick={uploadAll}>
          {uploading ? `Uploading ${progress.filter((row) => row.state === "done").length}/${progress.length}` : `Upload ${orderedFiles.length || "All"} Panels`}
        </button>
      </div>

      <style>{`
        .bulk-upload-card { display: grid; gap: 12px; }
        .bulk-upload-card h3 { margin-bottom: 0; }
        .bulk-upload-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .bulk-upload-check { display: flex; align-items: center; gap: 10px; color: var(--muted); font-weight: 800; }
        .bulk-upload-check input { width: auto; }
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
