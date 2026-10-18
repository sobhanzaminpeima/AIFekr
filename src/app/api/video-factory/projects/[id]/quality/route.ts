import {NextRequest,NextResponse} from "next/server";
import {factoryRoute} from "@/lib/video-factory/http";
import {getProject} from "@/lib/video-factory/service";
import {prisma} from "@/lib/db/prisma";
export const dynamic="force-dynamic";
export function GET(req:NextRequest,{params}:{params:{id:string}}){return factoryRoute(req,false,async userId=>{await getProject(userId,params.id);return NextResponse.json({reports:await prisma.videoFactoryQualityReport.findMany({where:{jobId:{in:(await prisma.videoFactoryJob.findMany({where:{projectId:params.id,userId},select:{id:true},take:100,orderBy:{createdAt:"desc"}})).map(j=>j.id)}},orderBy:{createdAt:"desc"},take:100})},{headers:{"Cache-Control":"no-store"}});});}

