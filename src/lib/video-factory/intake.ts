import { safeFetch } from "@/lib/net/safeUrl";
import { prisma } from "@/lib/db/prisma";
import { FactoryError } from "./domain";
import { getProject } from "./service";
import { z } from "zod";
import {preserveProjectVersion} from "./versions";
export const sourceSchema=z.object({url:z.string().url().max(2000),title:z.string().max(300),excerpt:z.string().max(15000),retrievedAt:z.string().datetime(),sha256:z.string()});
/** Fetch source text with the existing DNS-pinned SSRF/redirect guard. Never execute page scripts. */
export async function importArticle(userId:string,projectId:string,url:string){
  const project=await getProject(userId,projectId);if(project.activeJobId)throw new FactoryError("PROJECT_BUSY");
  const response=await safeFetch(url,{headers:{Accept:"text/html,text/plain"}});
  if(!response.ok)throw new FactoryError("SOURCE_FETCH_FAILED",400);
  if(!/text\/(?:html|plain)/i.test(response.headers.get("content-type") || ""))throw new FactoryError("UNSUPPORTED_SOURCE_TYPE",400);
  const html=await response.text();
  const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(url).hostname).replace(/<[^>]*>/g,"").slice(0,300);
  const excerpt=html.replace(/<(script|style|noscript|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim().slice(0,15000);
  if(excerpt.length<30)throw new FactoryError("SOURCE_HAS_NO_TEXT",400);
  const {createHash}=await import("node:crypto");const source=sourceSchema.parse({url:response.url || url,title,excerpt,retrievedAt:new Date().toISOString(),sha256:createHash("sha256").update(excerpt).digest("hex")});
  const previous=z.array(sourceSchema).parse(JSON.parse(project.research));if(previous.length>=10)throw new FactoryError("SOURCE_LIMIT",400);
  await prisma.$transaction(async tx=>{await preserveProjectVersion(tx,project,userId);const changed=await tx.videoFactoryProject.updateMany({where:{id:projectId,userId,version:project.version,activeJobId:null},data:{research:JSON.stringify([...previous.filter(s=>s.url!==source.url),source]),version:{increment:1}}});if(!changed.count)throw new FactoryError("VERSION_CONFLICT");});return source;
}
export async function importScript(userId:string,projectId:string,text:string){
  if(text.length<10 || text.length>30000)throw new FactoryError("INVALID_SCRIPT",400);
  const project=await getProject(userId,projectId);if(project.activeJobId)throw new FactoryError("PROJECT_BUSY");
  await prisma.$transaction(async tx=>{await preserveProjectVersion(tx,project,userId);const changed=await tx.videoFactoryProject.updateMany({where:{id:projectId,userId,activeJobId:null,version:project.version},data:{brief:text,manifest:"{}",planning:"{}",version:{increment:1}}});if(!changed.count)throw new FactoryError("VERSION_CONFLICT");});return {saved:true};
}
