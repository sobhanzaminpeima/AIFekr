import { NextRequest,NextResponse } from "next/server";
import { factoryRoute } from "@/lib/video-factory/http";
import { listAssets,uploadAsset } from "@/lib/video-factory/assets";
import { FactoryError } from "@/lib/video-factory/domain";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,false,async id=>NextResponse.json({assets:await listAssets(id,req.nextUrl.searchParams.get("projectId") || undefined,(req.nextUrl.searchParams.get("q") || "").slice(0,100),Math.max(0,Math.min(10000,Math.floor(Number(req.nextUrl.searchParams.get("page")) || 0))))}));}
export function POST(req:NextRequest){return factoryRoute(req,false,async id=>{
  if(Number(req.headers.get("content-length"))>51000000)throw new FactoryError("UPLOAD_TOO_LARGE",413);
  const reader=req.body?.getReader();if(!reader)throw new FactoryError("EMPTY_UPLOAD",400);let size=0;const chunks:Uint8Array[]=[];
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>51000000){await reader.cancel();throw new FactoryError("UPLOAD_TOO_LARGE",413);}chunks.push(part.value);}
  const copy=new Request(req.url,{method:"POST",headers:{"Content-Type":req.headers.get("content-type") || ""},body:new Uint8Array(Buffer.concat(chunks))});
  const form=await copy.formData(),file=form.get("file");if(!file || typeof file==="string")throw new FactoryError("FILE_REQUIRED",400);
  const asset=await uploadAsset(id,String(form.get("projectId") || ""),Buffer.from(await file.arrayBuffer()),file.type,file.name,form.get("rightsConfirmed")==="true");
  return NextResponse.json({asset},{status:201});
});}
