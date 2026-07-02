import { createHash } from "node:crypto";
import { requireEnv } from "@/lib/env";

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
};

export function cloudinaryFolder() {
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

export function createSignedCloudinaryUpload(publicId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder: cloudinaryFolder(),
    public_id: publicId,
    timestamp
  };

  return {
    apiKey: requireEnv("CLOUDINARY_API_KEY"),
    cloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
    folder: paramsToSign.folder,
    publicId,
    signature: signUploadParams(paramsToSign),
    timestamp
  };
}

export async function uploadImageToCloudinary(publicId: string, file: File) {
  const signedUpload = createSignedCloudinaryUpload(publicId);

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", signedUpload.apiKey);
  body.append("folder", signedUpload.folder);
  body.append("public_id", signedUpload.publicId);
  body.append("timestamp", String(signedUpload.timestamp));
  body.append("signature", signedUpload.signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/image/upload`, {
    method: "POST",
    body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Cloudinary upload failed: ${message}`);
  }

  return (await response.json()) as CloudinaryUploadResponse;
}
