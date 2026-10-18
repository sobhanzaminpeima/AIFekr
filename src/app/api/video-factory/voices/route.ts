import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {factoryRoute,boundedJson} from "@/lib/video-factory/http";
import {createVoiceConsent,revokeVoiceConsent} from "@/lib/video-factory/voiceConsent";
import {prisma} from "@/lib/db/prisma";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,false,async userId=>NextResponse.json({voices:await prisma.videoFactoryAsset.findMany({where:{userId,...(req.nextUrl.searchParams.get("projectId")?{projectId:req.nextUrl.searchParams.get("projectId")!.slice(0,100)}:{}),kind:"VOICE_CONSENT",status:"READY",OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]},select:{id:true,name:true,projectId:true,createdAt:true},take:100})}));}
export function POST(req:NextRequest){return factoryRoute(req,false,async id=>{const body=z.discriminatedUnion("action",[z.object({action:z.literal("consent"),value:z.unknown()}).strict(),z.object({action:z.literal("revoke"),id:z.string().max(100),deleteRemote:z.boolean().default(false)}).strict()]).parse(await boundedJson(req));return NextResponse.json(body.action==="consent"?await createVoiceConsent(id,body.value):await revokeVoiceConsent(id,body.id,body.deleteRemote));});}


