import type {Prisma,AiCourse} from "@prisma/client";
export async function preserveRevision(tx:Prisma.TransactionClient,c:AiCourse,actorId:string,reason:string){
 if(!c.content)return;
 const metadata={title:c.title,description:c.description,language:c.language,fieldOfStudy:c.fieldOfStudy,configuration:c.configuration,difficulty:c.difficulty,durationMinutes:c.durationMinutes,topic:c.topic,skills:c.skills,prerequisites:c.prerequisites,coverUrl:c.coverUrl};
 return tx.aiCourseRevision.upsert({where:{courseId_version:{courseId:c.id,version:c.version}},create:{courseId:c.id,version:c.version,actorId,reason,metadata:JSON.stringify(metadata),content:c.content},update:{}});
}
