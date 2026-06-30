import { createHash } from "node:crypto";
import { requireEnv } from "@/lib/env";

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
};

function cloudinaryFolder() {
  return process.env.CLOUDINARY_FOLDER || "echoes-comic-assets";
}

function signUploadParams(params: Record<string, string | number>) {
  const serializedParams = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1")
    .update(`${serializedParams}${requireEnv("CLOUDINARY_API_SECRET")}`)
    .digest("hex");
}

export async function uploadImageToCloudinary(publicId: string, file: File) {
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder: cloudinaryFolder(),
    public_id: publicId,
    timestamp
  };

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", requireEnv("CLOUDINARY_API_KEY"));
  body.append("folder", paramsToSign.folder);
  body.append("public_id", paramsToSign.public_id);
  body.append("timestamp", String(paramsToSign.timestamp));
  body.append("signature", signUploadParams(paramsToSign));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Cloudinary upload failed: ${message}`);
  }

  return (await response.json()) as CloudinaryUploadResponse;
}
