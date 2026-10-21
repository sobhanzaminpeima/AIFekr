import { createHash } from "node:crypto";
import { z } from "zod";
import { configurationSchema, policySchema, timeline, type Configuration, type Manifest, type Policy } from "./domain";

export const mediaTaskSchema=z.object({key:z.string(),kind:z.enum(["IMAGE","VIDEO","TTS","MUSIC","CLONE","ALIGNMENT","TRANSCRIPTION","SFX"]),shotId:z.string().nullable(),prompt:z.string(),providerId:z.string(),credits:z.number().int().nonnegative(),units:z.number().nonnegative(),fingerprint:z.string()});
export type MediaTask=z.infer<typeof mediaTaskSchema>;
export const productionPlanSchema=z.object({configuration:configurationSchema,policy:policySchema,tasks:z.array(mediaTaskSchema),rendered:z.record(z.string(),z.string()).default({}),assetIds:z.record(z.string(),z.string()).default({})});
export type ProductionPlan=z.infer<typeof productionPlanSchema>;
export function fingerprint(value:unknown){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
/** Assign a stable, budgeted mixture of generated clips/images and deterministic code scenes. */
export function visualKinds(count:number,policy:Policy,quality:Configuration["quality"]){
  const mix=policy.presets[quality],videos=Math.ceil(count*mix.videoPercent/100),images=Math.min(count-videos,Math.ceil(count*mix.imagePercent/100));
  return Array.from({length:count},(_,i)=>i<videos?"VIDEO" as const:i<videos+images?"IMAGE" as const:"CODE" as const);
}
export function buildProductionPlan(manifest:Manifest,configuration:Configuration,policy:Policy):ProductionPlan{
  const edit=timeline(manifest,configuration.durationSeconds),kinds=visualKinds(edit.shots.length,policy,configuration.quality),tasks:MediaTask[]=[];
  const add=(kind:MediaTask["kind"],shotId:string|null,prompt:string,credits:number,units=1)=>{
    const providerId=["CLONE","ALIGNMENT","TRANSCRIPTION","SFX"].includes(kind)?policy.advancedProviders[kind.toLowerCase() as "clone"|"alignment"|"transcription"|"sfx"]:policy.providers[kind==="TTS"?"tts":kind.toLowerCase() as "image"|"video"|"music"];
    tasks.push({key:`${kind.toLowerCase()}-${shotId || "bed"}`,kind,shotId,prompt,providerId,credits,units,fingerprint:fingerprint({kind,prompt,providerId,voice:kind==="TTS"?configuration.voice:null,voiceProfileId:configuration.voiceProfileId,ratio:configuration.ratio,style:configuration.styleBible})});
  };
  if(configuration.mediaMode==="MULTIMEDIA"){
    if(configuration.narration && configuration.voiceProfileId)add("CLONE",null,configuration.voiceProfileId,policy.creditsPerClone!);
    if(configuration.transcriptionAssetId)add("TRANSCRIPTION",null,configuration.transcriptionAssetId,policy.creditsPerTranscription!);
    edit.shots.forEach((shot,index)=>{
      const prompt=`${shot.visualPrompt}\nStyle and continuity: ${configuration.styleBible}\nVisual revision: ${shot.revision || 0}\nCharacter reference: ${manifest.characters.map(c=>`${c.name}: ${c.description}`).join("; ")}`;
      const code=["TITLE","CHART","MAP"].includes(shot.motion);
      if(!shot.assetId && !code && kinds[index]==="IMAGE")add("IMAGE",shot.id,prompt,policy.creditsPerImage!);
      if(!shot.assetId && !code && kinds[index]==="VIDEO")add("VIDEO",shot.id,prompt,policy.creditsPerVideoSecond!*4,4);
      const spoken=configuration.pronunciation.reduce((text,entry)=>text.split(entry.word).join(entry.replacement),shot.narration);
      if(configuration.narration && spoken.trim()){
        add("TTS",shot.id,spoken,policy.creditsPerVoice!);
        if(configuration.forcedAlignment)add("ALIGNMENT",shot.id,spoken,policy.creditsPerAlignment!);
      }
      if(shot.sfxPrompt)add("SFX",shot.id,shot.sfxPrompt,policy.creditsPerSfx!,Math.min(22,shot.durationFrames/24));
    });
    if(configuration.music)add("MUSIC",null,configuration.musicPrompt,policy.creditsPerMusicMinute!*Math.min(5,Math.ceil(configuration.durationSeconds/60)),Math.min(5,Math.ceil(configuration.durationSeconds/60)));
  }
  return {configuration,policy,tasks,rendered:{},assetIds:{}};
}
