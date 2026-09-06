import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const isDev = process.env.NODE_ENV === "development";
const hasR2 = !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_ACCESS_KEY_ID !== "your-access-key");

let s3Client: S3Client | null = null;

function getClient() {
  if (!s3Client && hasR2) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "File storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
      "R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL to real Cloudflare " +
      "R2 values — they are still placeholders."
    );
    this.name = "StorageNotConfiguredError";
  }
}

export async function uploadToStorage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getClient();

  if (!client || !hasR2) {
    // Previously this returned a placehold.co URL in every environment. In
    // production that made uploads *look* successful while persisting a fake
    // image URL — which is how "social posts show no image" and silently
    // broken logos/property photos happened: nothing failed, the wrong thing
    // was simply saved. Outside development the caller must hear about it.
    if (!isDev) throw new StorageNotConfiguredError();
    console.warn("R2 not configured — returning a placeholder URL (development only)");
    return `https://placehold.co/1024x1024/1a1a1a/ea580c?text=${encodeURIComponent(key.split("/").pop() || "file")}`;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) return `${publicUrl}/${key}`;

  // Generate signed URL if no public URL configured
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }),
    { expiresIn: 60 * 60 * 24 * 7 } // 7 days
  );
  return url;
}

/**
 * Mints a fresh, short-lived signed URL for an already-uploaded object —
 * used by authenticated download routes (e.g. property/CRM documents) so
 * the link handed to the browser is only ever valid for a minute, instead
 * of the 7-day presigned URL uploadToStorage() returns for storage
 * (necessary there since R2_PUBLIC_URL may be unset). Every access this
 * way re-runs the caller's own permission check first — the short expiry
 * just bounds how long a leaked/cached link stays useful.
 */
export async function getSignedDownloadUrl(key: string, expiresInSeconds = 60): Promise<string> {
  const client = getClient();
  if (!client || !hasR2) {
    return `https://placehold.co/1024x1024/1a1a1a/ea580c?text=${encodeURIComponent(key.split("/").pop() || "file")}`;
  }
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

export async function deleteFromStorage(key: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key })
  );
}

export function getStorageKey(userId: string, type: "image" | "video" | "music" | "reference" | "document" | "invite-card", filename: string) {
  return `${type}s/${userId}/${Date.now()}-${filename}`;
}
