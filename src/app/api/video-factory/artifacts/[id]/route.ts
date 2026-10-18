import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { factoryRoute } from "@/lib/video-factory/http";
import { FactoryError } from "@/lib/video-factory/domain";
import { artifactPath } from "@/lib/video-factory/render";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import {verifyDownload} from "@/lib/video-factory/secureLinks";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const serve=async(userId:string)=>{
    const artifact = await prisma.videoFactoryArtifact.findFirst({ where: { id: params.id, job: { userId, status: "DELIVERED" } } });
    if (!artifact) throw new FactoryError("ARTIFACT_NOT_FOUND", 404);
    const file = artifactPath(artifact.jobId, artifact.fileName), size = (await stat(file)).size;
    const headers: Record<string, string> = { "Content-Type": artifact.kind === "video" ? "video/mp4" : artifact.kind === "manifest" ? "application/json" : "text/plain; charset=utf-8", "Content-Disposition": `${req.nextUrl.searchParams.get("preview") === "1" && artifact.kind === "video" ? "inline" : "attachment"}; filename="${artifact.fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" };
    let start = 0, end = size - 1, status = 200;
    if(artifact.fileName.endsWith(".m4a"))headers["Content-Type"]="audio/mp4";
    if(artifact.kind==="archive")headers["Content-Type"]="application/zip";
    if(artifact.kind==="thumbnail")headers["Content-Type"]="image/png";
    if (artifact.kind === "vtt") {
      headers["Content-Type"] = "text/vtt; charset=utf-8";
      if (req.nextUrl.searchParams.get("preview") === "1") headers["Content-Disposition"] = `inline; filename="${artifact.fileName}"`;
    }
    const range = req.headers.get("range");
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      status = 206; headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    }
    headers["Content-Length"] = String(end - start + 1);
    headers["Referrer-Policy"]="no-referrer";
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
    return new NextResponse(body, { status, headers });
  };
  const token=req.nextUrl.searchParams.get("downloadToken");
  if(token){try{const userId=verifyDownload(token,params.id),user=await prisma.user.findUnique({where:{id:userId},select:{isBlocked:true}});if(!user||user.isBlocked)throw new FactoryError("DOWNLOAD_LINK_INVALID",403);return await serve(userId);}catch(error){return NextResponse.json({code:error instanceof FactoryError?error.code:"ARTIFACT_NOT_FOUND"},{status:error instanceof FactoryError?error.status:404,headers:{"Cache-Control":"no-store"}});}}
  return factoryRoute(req,false,serve);
}

