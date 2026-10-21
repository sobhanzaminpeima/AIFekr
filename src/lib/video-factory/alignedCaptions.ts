import {assetBytes,ownedAsset,storagePath} from "./assets";
import {alignmentSchema} from "./advancedAdapters";
import {captionCues,type Configuration,type timeline,FactoryError} from "./domain";
import type {ProductionPlan} from "./production";
import {mediaCommand} from "./render";
export async function productionCaptions(edit:ReturnType<typeof timeline>,configuration:Configuration,plan?:ProductionPlan,userId?:string){
 if(!configuration.forcedAlignment || !plan || !userId)return captionCues(edit);
 const cues:ReturnType<typeof captionCues>=[];
 for(const shot of edit.shots){
  const alignmentId=plan.assetIds[`alignment-${shot.id}`];if(!alignmentId){if(shot.narration.trim())throw new FactoryError("ALIGNMENT_MISSING",409);continue;}
  const aligned=alignmentSchema.parse(JSON.parse((await assetBytes(userId,alignmentId)).bytes.toString()));
  const voice=await ownedAsset(userId,plan.assetIds[`tts-${shot.id}`]);
  const info=JSON.parse(await mediaCommand("ffprobe",["-v","error","-show_entries","format=duration","-of","json",storagePath(voice.storageKey)]));
  const duration=Number(info.format?.duration);if(!Number.isFinite(duration)||duration<=0)throw new FactoryError("INVALID_VOICE_MEDIA");const speed=Math.max(.5,Math.min(2,duration/(shot.durationFrames/24)));
  let previous=shot.startFrame;
  for(const word of aligned.words){const startFrame=Math.max(previous,shot.startFrame+Math.round(word.start/speed*24)),endFrame=Math.min(shot.startFrame+shot.durationFrames,shot.startFrame+Math.round(word.end/speed*24));if(endFrame>startFrame){cues.push({text:word.text,startFrame,endFrame});previous=endFrame;}}
  if(shot.narration.trim() && previous===shot.startFrame)throw new FactoryError("EMPTY_ALIGNMENT",502);
 }return cues;
}
