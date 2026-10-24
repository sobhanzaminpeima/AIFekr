import { NextRequest,NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { stat } from "node:fs/promises";
import { factoryRoute } from "@/lib/video-factory/http";
import { ownedAsset,removeAsset,storagePath } from "@/lib/video-factory/assets";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return factoryRoute(req,false,async userId=>{
    const asset=await ownedAsset(userId,params.id),file=storagePath(asset.storageKey),size=(await stat(file)).size;
    let start=0,end=size-1,status=200;const headers:Record<string,string>={"Content-Type":asset.mimeType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Accept-Ranges":"bytes"};
    const range=req.headers.get("range");if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)return new NextResponse(null,{status:416,headers:{"Content-Range":`bytes */${size}`}});start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return new NextResponse(null,{status:416,headers:{"Content-Range":`bytes */${size}`}});headers["Content-Range"]=`bytes ${start}-${end}/${size}`;status=206;}
    headers["Content-Length"]=String(end-start+1);
    return new NextResponse(Readable.toWeb(createReadStream(file,{start,end})) as ReadableStream<Uint8Array>,{status,headers});
  });
}
export async function DELETE(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return factoryRoute(req,false,async userId=>NextResponse.json(await removeAsset(userId,params.id)));
}
