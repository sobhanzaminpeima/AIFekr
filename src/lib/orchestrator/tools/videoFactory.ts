import {prisma} from "@/lib/db/prisma";
import {defineTool,validText,type NoArgs,type ToolDefinition} from "./types";
import {projectSchema} from "@/lib/video-factory/domain";
import {createProject,listProjects} from "@/lib/video-factory/service";
import {tri} from "@/lib/i18n/tri";
import {sanitizeFreeText} from "@/lib/agents/crmAgent";
const projectsTool=defineTool<NoArgs>({key:"videoFactory.projects",tier:"READ",capabilityKey:"video-factory",description:"List the authenticated account's Video Factory projects and actual production status. Never claim a film is rendered unless its job is DELIVERED. No generation or publishing.",validate:()=>({}),run:async(_args,ctx)=>{
  const projects=await listProjects(ctx.actingUserId);return {data:{projects:projects.map(p=>({id:p.id,title:sanitizeFreeText(p.title).slice(0,180),version:p.version,status:p.jobs[0]?.status || "DRAFT",stage:p.jobs[0]?.stage || null,url:"/video-factory"}))},empty:projects.length===0};
}});
type Draft={title:string;brief:string;durationSeconds:number};
const draftTool=defineTool<Draft>({key:"videoFactory.createDraft",tier:"COMMIT",capabilityKey:"video-factory",description:"Create a free Video Factory draft from title, brief and target duration (15-3600 seconds), after confirmation. Does not start paid generation or publish. The user must approve production costs in the Video Factory workspace.",validate:raw=>{const value=raw as Record<string,unknown>|null;if(!value)return null;const title=validText(value.title,180),brief=validText(value.brief,30000),durationSeconds=Number(value.durationSeconds || 60);return title && title.length>=3 && brief && brief.length>=10 && Number.isInteger(durationSeconds)&&durationSeconds>=15&&durationSeconds<=3600?{title,brief,durationSeconds}:null;},summarize:(args,_ctx,lang)=>tri(lang,`ساخت پیش‌نویس رایگان «${args.title}»؛ تولید پولی و انتشار آغاز نمی‌شود.`,`Create free draft “${args.title}”; paid production and publication will not start.`,`Kostenlosen Entwurf „${args.title}“ anlegen; keine kostenpflichtige Produktion oder Veröffentlichung.`),run:async(args,ctx)=>{
  const input=projectSchema.parse({title:args.title,brief:args.brief,configuration:{durationSeconds:args.durationSeconds,language:ctx.lang,ratio:"16:9",mode:"REVIEW_GATES",quality:"SMART",budgetCap:500}});
  const project=await createProject(ctx.actingUserId,input);await prisma.auditLog.create({data:{actorId:ctx.actingUserId,action:"video_factory.chat_draft_created",targetId:project.id}});return {data:{id:project.id,title:sanitizeFreeText(project.title),status:"DRAFT",url:"/video-factory",note:"No generation credits spent. Open the project to estimate and authorize production."}};
}});
export const VIDEO_FACTORY_TOOLS=[projectsTool,draftTool] as unknown as ToolDefinition<never>[];
