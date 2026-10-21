import {createHmac,randomInt,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {CourseError} from "./errors";
import {assessmentSettings} from "./assessment";
const selection=z.object({userId:z.string(),versionId:z.string(),lessonId:z.string(),indices:z.array(z.number().int().min(0).max(29)).min(1).max(30),expires:z.number()}).strict();
type Scope={userId:string;versionId:string;lessonId:string};
function signature(data:string){if(!process.env.JWT_SECRET)throw Error("Authentication configuration unavailable");return createHmac("sha256",process.env.JWT_SECRET).update("academy-assessment:"+data).digest();}
export function selectAssessment(scope:Scope,size:number,settings:z.infer<typeof assessmentSettings>){
 const indices=Array.from({length:size},(_,i)=>i);
 if(settings.randomize)for(let i=size-1;i>0;i--){const j=randomInt(i+1);[indices[i],indices[j]]=[indices[j],indices[i]];}
 const chosen=indices.slice(0,Math.min(settings.questionCount||size,size)),data=Buffer.from(JSON.stringify({...scope,indices:chosen,expires:Date.now()+2*3600000})).toString("base64url");
 return {indices:chosen,token:data+"."+signature(data).toString("base64url")};
}
export function verifyAssessment(token:string|undefined,scope:Scope,size:number,settings:z.infer<typeof assessmentSettings>){
 try{if(!token||token.length>4000)throw Error();const [data,sig,extra]=token.split(".");if(extra||!sig)throw Error();const received=Buffer.from(sig,"base64url"),expected=signature(data);if(received.length!==expected.length||!timingSafeEqual(received,expected))throw Error();const v=selection.parse(JSON.parse(Buffer.from(data,"base64url").toString()));if(v.expires<Date.now()||v.userId!==scope.userId||v.versionId!==scope.versionId||v.lessonId!==scope.lessonId||new Set(v.indices).size!==v.indices.length||v.indices.some(i=>i>=size)||v.indices.length!==Math.min(settings.questionCount||size,size))throw Error();return v.indices;
 }catch{throw new CourseError("ASSESSMENT_EXPIRED_RELOAD",409);}
}
