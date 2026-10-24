import {NextRequest,NextResponse} from "next/server";
import {factoryRoute} from "@/lib/video-factory/http";
import {prisma} from "@/lib/db/prisma";
import {FactoryError} from "@/lib/video-factory/domain";
import {signDownload} from "@/lib/video-factory/secureLinks";
export async function POST(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return factoryRoute(req,false,async userId=>{const row=await prisma.videoFactoryArtifact.findFirst({where:{id:params.id,job:{userId,status:"DELIVERED"}}});if(!row)throw new FactoryError("ARTIFACT_NOT_FOUND",404);const token=signDownload(userId,row.id);await prisma.auditLog.create({data:{actorId:userId,action:"video_factory.download_link_created",targetId:row.id}});return NextResponse.json({url:`/api/video-factory/artifacts/${row.id}?downloadToken=${encodeURIComponent(token)}`,expiresInSeconds:600},{headers:{"Cache-Control":"no-store"}});});
}
