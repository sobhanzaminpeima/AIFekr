export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(auth);
  if (unavailable) return unavailable;
  let form: FormData;
  try {
    const reader=req.body?.getReader();if(!reader)throw new Error("EMPTY_UPLOAD");
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_AVATAR_BYTES+65536){await reader.cancel();return NextResponse.json({error:"حجم تصویر باید حداکثر ۵ مگابایت باشد"},{status:413});}chunks.push(value);}
    form=await new Response(Buffer.concat(chunks),{headers:{"Content-Type":req.headers.get("content-type")||""}}).formData();
  } catch { return NextResponse.json({ error: "فایل تصویر معتبر نیست" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود" }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: "حجم تصویر باید حداکثر ۵ مگابایت باشد" }, { status: 413 });
  try {
    const sharp = (await import("sharp")).default;
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000 }).rotate().resize(512, 512, { fit: "cover", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    if(image.length>256*1024)return NextResponse.json({error:"تصویر بهینه‌شده بزرگ است؛ عکس ساده‌تری انتخاب کنید."},{status:413});
    // A small canonical WebP is persisted with the profile, surviving releases without R2 dependencies.
    const avatar=`data:image/webp;base64,${image.toString("base64")}`;
    const user = await prisma.user.update({ where: { id: auth.id }, data: { avatar }, select: { avatar: true } });
    return NextResponse.json({ avatar: user.avatar });
  } catch (error) {
    console.error("student avatar upload failed", error);
    return NextResponse.json({ error: "بارگذاری تصویر ناموفق بود" }, { status: 422 });
  }
}

// Serve uploaded photos from the same origin so canvas export works without R2 CORS.
export async function GET(req:NextRequest){
 const slug=req.nextUrl.searchParams.get("slug");
 let account;
 if(slug){account=await prisma.user.findFirst({where:{studentPublicSlug:slug,studentProfilePublic:true},select:{id:true,avatar:true}});if(!account||await studentWorkspaceDisabledResponse({id:account.id}))return new NextResponse(null,{status:404});}
 else{const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);account=await prisma.user.findUnique({where:{id:user.id},select:{id:true,avatar:true}});}
 if(!account?.avatar)return new NextResponse(null,{status:404});
 try{
  if(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(account.avatar)){const data=Buffer.from(account.avatar.slice("data:image/webp;base64,".length),"base64");if(data.length>256*1024)return new NextResponse(null,{status:413});return new NextResponse(new Uint8Array(data),{headers:{"Content-Type":"image/webp","Cache-Control":slug?"public, max-age=300":"private, no-store","X-Content-Type-Options":"nosniff"}});}
  const url=new URL(account.avatar);
  const storageHost=process.env.R2_PUBLIC_URL?new URL(process.env.R2_PUBLIC_URL).hostname:null;
  const signedHost=process.env.R2_ACCOUNT_ID?`${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`:null;
  if(url.protocol!=="https:"||![storageHost,signedHost,"lh3.googleusercontent.com"].includes(url.hostname))return new NextResponse(null,{status:400});
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:"error"});
  if(!response.ok||Number(response.headers.get("content-length"))>MAX_AVATAR_BYTES)return new NextResponse(null,{status:502});
  const reader=response.body?.getReader();if(!reader)throw new Error("PHOTO_UNAVAILABLE");
  const chunks:Uint8Array[]=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_AVATAR_BYTES){await reader.cancel();return new NextResponse(null,{status:413});}chunks.push(value);}
  const sharp=(await import("sharp")).default;
  const image=await sharp(Buffer.concat(chunks),{limitInputPixels:25_000_000}).rotate().resize(512,512,{fit:"cover"}).webp({quality:82}).toBuffer();
  return new NextResponse(new Uint8Array(image),{headers:{"Content-Type":"image/webp","Cache-Control":slug?"public, max-age=300":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return new NextResponse(null,{status:502});}
}
