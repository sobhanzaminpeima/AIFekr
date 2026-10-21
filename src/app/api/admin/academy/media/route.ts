import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,forbiddenResponse} from "@/lib/auth/middleware";
import {uploadToStorage,StorageNotConfiguredError,getStorageKey} from "@/lib/storage/r2";
import sharp from "sharp";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {publicAppUrl} from "@/lib/utils/publicAppUrl";
import {prisma} from "@/lib/db/prisma";
export async function POST(req:NextRequest){const admin=await requireAdmin(req);if(!admin)return forbiddenResponse();const form=await req.formData().catch(()=>null),file=form?.get("file");if(!(file instanceof File)||file.size>8*1024*1024||!["image/png","image/jpeg","image/webp"].includes(file.type))return NextResponse.json({error:"INVALID_IMAGE"},{status:400});try{const image=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25000000}).rotate().resize({width:1800,height:1800,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer(),name=`${randomUUID()}.webp`;let url:string;try{url=await uploadToStorage(image,getStorageKey(admin.id,"image",`academy-${name}`),"image/webp");if(url.includes("placehold.co"))throw new StorageNotConfiguredError();}catch(error){if(!(error instanceof StorageNotConfiguredError))throw error;const folder=path.join(process.cwd(),"public/uploads/academy");await mkdir(folder,{recursive:true});await writeFile(path.join(folder,name),image,{flag:"wx"});url=`${publicAppUrl()}/uploads/academy/${name}`;}await prisma.auditLog.create({data:{actorId:admin.id,action:"academy_media_uploaded",metadata:JSON.stringify({url})}});return NextResponse.json({url});}catch{return NextResponse.json({error:"IMAGE_UPLOAD_FAILED"},{status:400});}}
