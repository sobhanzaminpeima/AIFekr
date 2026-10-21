import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { artifactDirectory,mediaCommand } from "./render";
import { type Configuration,type Manifest,timeline,FactoryError } from "./domain";
export async function inspectRenderedShot(jobId:string,index:number,manifest:Manifest,configuration:Configuration,signal:AbortSignal){
  const edit=timeline(manifest,configuration.durationSeconds),shot=edit.shots[index],file=path.join(artifactDirectory(jobId),`shot-${index}.mp4`);
  const info=JSON.parse(await mediaCommand("ffprobe",["-v","error","-show_entries","format=duration:stream=codec_type,width,height,r_frame_rate","-of","json",file],signal));
  const findings:{code:string;severity:"ERROR"|"WARNING";value?:number}[]=[];
  if(Math.abs(Number(info.format?.duration)-shot.durationFrames/24)>.15)findings.push({code:"DURATION_DRIFT",severity:"ERROR"});
  if(!info.streams?.some((s:{codec_type:string})=>s.codec_type==="video"))findings.push({code:"MISSING_VIDEO",severity:"ERROR"});
  if(configuration.mediaMode==="MULTIMEDIA" && configuration.narration && shot.narration.trim()){
    const audio=await mediaCommand("ffmpeg",["-hide_banner","-i",file,"-vn","-af","volumedetect","-f","null","-"],signal,true);
    const peak=audio.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/),silence=audio.includes("max_volume: -inf");
    if(silence || (peak && Number(peak[1])< -55))findings.push({code:"SILENT_NARRATION",severity:"ERROR"});
    if(peak && Number(peak[1])>-.1)findings.push({code:"AUDIO_CLIPPING_RISK",severity:"WARNING",value:Number(peak[1])});
  }
  if(!shot.narration.trim() && configuration.narration)findings.push({code:"EMPTY_NARRATION",severity:"WARNING"});
  const status=findings.some(f=>f.severity==="ERROR")?"FAILED":findings.length?"WARNING":"PASSED";
  await prisma.videoFactoryQualityReport.create({data:{jobId,shotId:shot.id,kind:"MEDIA",status,findings:JSON.stringify(findings)}});
  if(status==="FAILED")throw new FactoryError("SHOT_QUALITY_FAILED",502);
  return {status,findings};
}
export function checkContinuity(manifest:Manifest,configuration:Configuration){
  const edit=timeline(manifest,configuration.durationSeconds),findings:{code:string;shotId?:string}[]=[];
  const titles=new Set<string>();for(const shot of edit.shots){if(shot.durationFrames<12)findings.push({code:"SHOT_TOO_SHORT",shotId:shot.id});if(titles.has(shot.title))findings.push({code:"REPEATED_SHOT_TITLE",shotId:shot.id});titles.add(shot.title);}
  for(const shot of edit.shots){if(shot.motion==="CHART" && !shot.chart)findings.push({code:"MISSING_CHART_DATA",shotId:shot.id});if(shot.motion==="MAP" && !shot.map)findings.push({code:"MISSING_MAP_DATA",shotId:shot.id});}
  if(configuration.language==="fa" && manifest.chapters.some(c=>c.shots.some(s=>s.narration && !/[\u0600-\u06ff]/.test(s.narration))))findings.push({code:"LANGUAGE_DRIFT_REVIEW"});
  if(manifest.chapters.length>1 && manifest.chapters.some(c=>!c.continuity.trim()))findings.push({code:"MISSING_CHAPTER_CONTINUITY"});
  return findings;
}
