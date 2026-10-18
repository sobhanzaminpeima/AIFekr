import {spawn} from "node:child_process";
import {writeFile,access} from "node:fs/promises";
import path from "node:path";
import {FactoryError,type TimelineShot} from "./domain";
export async function remotionReady(){try{await access(path.resolve("tools/video-factory-renderer/node_modules/@remotion/renderer"));return true;}catch{return false;}}
export async function renderRemotion(directory:string,index:number,shot:TimelineShot,width:number,height:number,rtl:boolean,signal:AbortSignal){
 if(!await remotionReady())throw new FactoryError("REMOTION_NOT_INSTALLED",503);
 const input=path.join(directory,`remotion-${index}.json`),output=path.join(directory,`remotion-${index}.mp4`);await writeFile(input,JSON.stringify({width,height,frames:shot.durationFrames,title:shot.title,rtl,chart:shot.chart}));
 const env:NodeJS.ProcessEnv={NODE_ENV:process.env.NODE_ENV};for(const key of ["PATH","SystemRoot","SYSTEMROOT","TEMP","TMP","USERPROFILE","LOCALAPPDATA","VIDEO_FACTORY_CHROME"])if(process.env[key])env[key]=process.env[key];
 await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,[path.resolve("tools/video-factory-renderer/render.cjs"),input,output],{env,windowsHide:true,shell:false,stdio:"ignore",signal});child.once("error",()=>reject(new FactoryError("REMOTION_RENDER_FAILED",503)));child.once("close",code=>code===0?resolve():reject(new FactoryError("REMOTION_RENDER_FAILED",503)));});return output;
}
