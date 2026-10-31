export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const MAX_BYTES=5*1024*1024;
/** Decode and re-encode uploads; persist only small canonical WebP, no arbitrary URL fetch. */
export async function POST(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 let form:FormData;
 try{
  const reader=req.body?.getReader();if(!reader)throw Error("EMPTY");
  const chunks:Uint8Array[]=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_BYTES+65536){await reader.cancel();return NextResponse.json({error:"IMAGE_TOO_LARGE"},{status:413});}chunks.push(value);}
  form=await new Response(Buffer.concat(chunks),{headers:{"Content-Type":req.headers.get("content-type")||""}}).formData();
 }catch{return NextResponse.json({error:"INVALID_IMAGE_UPLOAD"},{status:400});}
 const file=form.get("file");
 if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type))return NextResponse.json({error:"UNSUPPORTED_IMAGE_TYPE"},{status:415});
 if(!file.size||file.size>MAX_BYTES)return NextResponse.json({error:"IMAGE_TOO_LARGE"},{status:413});
 try{
  const sharp=(await import('sharp')).default;
  const image=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25_000_000}).rotate().resize(512,512,{fit:'cover',withoutEnlargement:true}).webp({quality:82}).toBuffer();
  if(image.length>256*1024)return NextResponse.json({error:"OPTIMIZED_IMAGE_TOO_LARGE"},{status:413});
  await prisma.user.update({where:{id:user.id},data:{avatar:`data:image/webp;base64,${image.toString('base64')}`}});
  return NextResponse.json({success:true});
 }catch{return NextResponse.json({error:"IMAGE_DECODE_FAILED"},{status:422});}
}
