import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { editManifest, getProject } from "@/lib/video-factory/service";
import { configurationSchema, manifestSchema, type Manifest } from "@/lib/video-factory/domain";
import { promptList, shotMedia, storedZip, withShotAsset } from "@/lib/video-factory/media";
import { storagePath } from "@/lib/video-factory/assets";
import { FactoryError } from "@/lib/video-factory/errors";
import { prisma } from "@/lib/db/prisma";
export const dynamic = "force-dynamic";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function load(userId: string, id: string) {
  const project = await getProject(userId, id);
  const raw = JSON.parse(project.manifest || "{}");
  const manifest: Manifest | null = raw && Array.isArray(raw.chapters) ? manifestSchema.parse(raw) : null;
  const configuration = configurationSchema.parse(JSON.parse(project.configuration));
  return { project, manifest, configuration };
}

/** Each shot's image: the one chosen or uploaded for it, otherwise the newest generated for it. Only this user's ready images. */
async function shotImages(userId: string, projectId: string, manifest: Manifest) {
  const shots = shotMedia(manifest);
  const assets = await prisma.videoFactoryAsset.findMany({
    where: { userId, projectId, status: "READY", mimeType: { in: IMAGE_TYPES }, OR: [{ shotId: { in: shots.map((s) => s.id) } }, { id: { in: shots.map((s) => s.assetId).filter((v): v is string => !!v) } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, shotId: true, mimeType: true, provenance: true, createdAt: true },
  });
  const byId = new Map(assets.map((a) => [a.id, a]));
  return shots.map((s) => {
    const chosen = s.assetId ? byId.get(s.assetId) : undefined;
    const generated = assets.find((a) => a.shotId === s.id);
    const image = chosen ?? generated ?? null;
    return { ...s, image: image ? { id: image.id, mimeType: image.mimeType, source: chosen ? "chosen" : "generated", url: `/api/video-factory/assets/${encodeURIComponent(image.id)}`, createdAt: image.createdAt } : null };
  });
}

/**
 * The project's media library: every shot in order with its image prompt and image.
 * ?format=prompts downloads the prompt list ([SHOT n] blocks); ?format=zip downloads
 * every shot image named SHOT_###.ext. Owner-only, like every Video Factory route.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return factoryRoute(req, false, async (userId) => {
    const { project, manifest, configuration } = await load(userId, id);
    const format = req.nextUrl.searchParams.get("format");
    if (!manifest) return NextResponse.json({ version: project.version, shots: [], ready: false });
    if (format === "prompts") {
      return new NextResponse(promptList(shotMedia(manifest), configuration.styleBible), { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="prompts-${id}.txt"`, "Cache-Control": "private, no-store" } });
    }
    const shots = await shotImages(userId, id, manifest);
    if (format === "zip") {
      const withImages = shots.filter((s) => s.image);
      if (!withImages.length) throw new FactoryError("NO_IMAGES_YET", 404);
      const files = [];
      for (const s of withImages) {
        const asset = await prisma.videoFactoryAsset.findFirst({ where: { id: s.image!.id, userId }, select: { storageKey: true, mimeType: true } });
        if (asset) files.push({ name: `${s.code}.${EXT[asset.mimeType] ?? "img"}`, data: await readFile(storagePath(asset.storageKey)) });
      }
      files.push({ name: "prompts.txt", data: Buffer.from(promptList(shotMedia(manifest), configuration.styleBible), "utf8") });
      return new NextResponse(new Uint8Array(storedZip(files)), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="images-${id}.zip"`, "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ version: project.version, ready: true, shots, withImage: shots.filter((s) => s.image).length });
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("attach"), expectedVersion: z.number().int().min(0), items: z.array(z.object({ shotId: z.string().min(1).max(64), assetId: z.string().min(1).max(100) }).strict()).min(1).max(400) }).strict(),
  z.object({ action: z.literal("regenerate"), expectedVersion: z.number().int().min(0), shotIds: z.array(z.string().min(1).max(64)).min(1).max(400) }).strict(),
]);

/**
 * attach: put uploaded or chosen images on shots (one request for a whole dropped folder).
 * regenerate: clear the shots' images and bump their revision, so the next run makes new ones.
 * Both go through editManifest, which checks ownership, image type, busy jobs and the version.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return factoryRoute(req, false, async (userId) => {
    const body = actionSchema.parse(await boundedJson(req));
    const { manifest } = await load(userId, id);
    if (!manifest) throw new FactoryError("SCRIPT_NOT_READY", 409);
    let next = manifest;
    try {
      if (body.action === "attach") for (const item of body.items) next = withShotAsset(next, item.shotId, item.assetId);
      else for (const shotId of body.shotIds) next = withShotAsset(next, shotId, null, true);
    } catch {
      throw new FactoryError("SHOT_NOT_FOUND", 404);
    }
    return NextResponse.json(await editManifest(userId, id, body.expectedVersion, next));
  });
}
