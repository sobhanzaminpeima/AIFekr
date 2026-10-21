import type {Prisma,VideoFactoryProject} from "@prisma/client";
import {prisma} from "@/lib/db/prisma";
import {configurationSchema,manifestSchema,FactoryError} from "./domain";
export async function preserveProjectVersion(tx:Prisma.TransactionClient,project:VideoFactoryProject,actorId:string){
  await tx.videoFactoryVersion.create({data:{projectId:project.id,version:project.version,actorId,manifest:JSON.stringify({manifest:JSON.parse(project.manifest),brief:project.brief,configuration:JSON.parse(project.configuration),research:JSON.parse(project.research)})}});
}
export async function projectVersions(userId:string,projectId:string){
  const owner=await prisma.videoFactoryProject.findFirst({where:{id:projectId,userId,deletedAt:null},select:{id:true}});if(!owner)throw new FactoryError("PROJECT_NOT_FOUND",404);
  return prisma.videoFactoryVersion.findMany({where:{projectId},orderBy:{version:"desc"},take:50,select:{id:true,version:true,actorId:true,createdAt:true}});
}
export async function restoreProjectVersion(userId:string,projectId:string,version:number,expectedVersion:number){
  return prisma.$transaction(async tx=>{const project=await tx.videoFactoryProject.findFirst({where:{id:projectId,userId,deletedAt:null}});if(!project)throw new FactoryError("PROJECT_NOT_FOUND",404);if(project.activeJobId)throw new FactoryError("PROJECT_BUSY");if(project.version!==expectedVersion)throw new FactoryError("VERSION_CONFLICT");
    const saved=await tx.videoFactoryVersion.findUnique({where:{projectId_version:{projectId,version}}});if(!saved)throw new FactoryError("VERSION_NOT_FOUND",404);
    const value=JSON.parse(saved.manifest),manifest=value.manifest || value;
    if(JSON.stringify(manifest)!=="{}")manifestSchema.parse(manifest);
    await preserveProjectVersion(tx,project,userId);
    const changed=await tx.videoFactoryProject.updateMany({where:{id:projectId,userId,version:expectedVersion,activeJobId:null},data:{manifest:JSON.stringify(manifest),...(value.brief?{brief:String(value.brief).slice(0,30000)}:{}),...(value.configuration?{configuration:JSON.stringify(configurationSchema.parse(value.configuration))}:{}),version:{increment:1}}});if(!changed.count)throw new FactoryError("VERSION_CONFLICT");
    await tx.auditLog.create({data:{actorId:userId,action:"video_factory.version_restored",targetId:projectId,metadata:JSON.stringify({sourceVersion:version,newVersion:expectedVersion+1})}});return {version:expectedVersion+1};
  });
}
