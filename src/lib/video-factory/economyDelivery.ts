import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { artifactDirectory } from "./render";
import { FactoryError } from "./errors";
import { orderView } from "./economyOrders";

const maxVideo = 150 * 1024 * 1024;
const maxThumb = 8 * 1024 * 1024;
const maxRequest = maxVideo + maxThumb + 65536;
const metadata = z.object({
  orderId: z.string().uuid(), title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(5000), tags: z.array(z.string().trim().min(1).max(100)).max(50),
});
async function readForm(req: NextRequest) {
  if (!req.body || !req.headers.get("content-type")?.startsWith("multipart/form-data")) throw new FactoryError("INVALID_INPUT", 400);
  if (Number(req.headers.get("content-length")) > maxRequest) throw new FactoryError("INPUT_TOO_LARGE", 413);
  let received = 0;
  const bounded = req.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > maxRequest) throw new FactoryError("INPUT_TOO_LARGE", 413);
      controller.enqueue(chunk);
    },
  }));
  try { return await new Response(bounded, { headers: { "content-type": req.headers.get("content-type")! } }).formData(); }
  catch { throw new FactoryError(received > maxRequest ? "INPUT_TOO_LARGE" : "INVALID_INPUT", received > maxRequest ? 413 : 400); }
}
function filePart(form: FormData, key: string, limit: number) {
  const file = form.get(key);
  if (!file || typeof file === "string" || !file.size) throw new FactoryError("INVALID_INPUT", 400);
  if (file.size > limit) throw new FactoryError("INPUT_TOO_LARGE", 413);
  return file;
}
export async function deliverOrder(actorId: string, req: NextRequest) {
  const form = await readForm(req);
  const { orderId, title, description, tags } = metadata.parse({ orderId: form.get("orderId"), title: form.get("title"),
    description: form.get("description"), tags: JSON.parse(String(form.get("tags") || "[]")) });
  const order = await prisma.economyVideoOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new FactoryError("ORDER_NOT_FOUND", 404);
  if (order.status === "PENDING") throw new FactoryError("ORDER_APPROVAL_REQUIRED", 409);
  if (order.status !== "APPROVED") throw new FactoryError("ORDER_ALREADY_DELIVERED", 409);
  const video = filePart(form, "video", maxVideo);
  const header = Buffer.from(await video.slice(0, 12).arrayBuffer());
  if (header.toString("ascii", 4, 8) !== "ftyp") throw new FactoryError("INVALID_VIDEO", 400);
  const thumb = filePart(form, "thumbnail", maxThumb);
  let png: Buffer;
  try {
    const input = sharp(Buffer.from(await thumb.arrayBuffer()), { limitInputPixels: 32_000_000 });
    if (!["jpeg", "png", "webp"].includes((await input.metadata()).format || "")) throw Error();
    png = await input.rotate().png().toBuffer();
  } catch { throw new FactoryError("INVALID_THUMBNAIL", 400); }
  const deliveryKey = randomUUID();
  const directory = artifactDirectory(deliveryKey);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(path.join(directory, "film.mp4"), Readable.fromWeb(video.stream() as Parameters<typeof Readable.fromWeb>[0]), { flag: "wx" });
    await writeFile(path.join(directory, "thumbnail.png"), png, { flag: "wx" });
    return await prisma.$transaction(async tx => {
      const updated = await tx.economyVideoOrder.updateMany({ where: { id: orderId, status: "APPROVED" }, data: {
        status: "DELIVERED", deliveredAt: new Date(), deliveredBy: actorId, title, description, tags: JSON.stringify(tags), deliveryKey,
      } });
      if (!updated.count) throw new FactoryError("ORDER_ALREADY_DELIVERED", 409);
      return orderView(await tx.economyVideoOrder.findUniqueOrThrow({ where: { id: orderId } }));
    });
  } catch (error) { await rm(directory, { force: true, recursive: true }); throw error; }
}
export async function downloadDelivery(userId: string, id: string, kind: string, req?: NextRequest) {
  if (!["video", "thumbnail"].includes(kind)) throw new FactoryError("FILE_NOT_FOUND", 404);
  const order = await prisma.economyVideoOrder.findFirst({ where: { id, userId, status: "DELIVERED" }, select: { deliveryKey: true } });
  if (!order?.deliveryKey) throw new FactoryError("FILE_NOT_FOUND", 404);
  const name = kind === "video" ? "film.mp4" : "thumbnail.png";
  const file = path.join(artifactDirectory(order.deliveryKey), name);
  const size = (await stat(file)).size;
  const disposition = req?.nextUrl.searchParams.get("preview") === "1" ? "inline" : "attachment";
  const headers: Record<string,string> = {
    "Content-Type": kind === "video" ? "video/mp4" : "image/png", "Accept-Ranges":"bytes",
    "Content-Disposition": disposition + '; filename="' + name + '"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  };
  let start = 0, end = size - 1;
  const range = req?.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const invalid = () => new NextResponse(null,{status:416,headers:{...headers,"Content-Range":`bytes */${size}`}});
    if (!match || (!match[1] && !match[2])) return invalid();
    start = match[1] ? Number(match[1]) : Math.max(0,size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(end,Number(match[2])) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) return invalid();
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  return new NextResponse(Readable.toWeb(createReadStream(file,{start,end})) as ReadableStream<Uint8Array>,
    {status:range ? 206 : 200,headers});
}
