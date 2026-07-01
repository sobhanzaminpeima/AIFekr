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

export async function uploadToStorage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getClient();

  if (!client || !hasR2) {
    // Dev fallback: return a placeholder URL
    console.warn("R2 not configured — returning placeholder URL");
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

export async function deleteFromStorage(key: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key })
  );
}

export function getStorageKey(userId: string, type: "image" | "video" | "music", filename: string) {
  return `${type}s/${userId}/${Date.now()}-${filename}`;
}
