import { spawn } from "node:child_process";
import {createReadStream,createWriteStream} from "node:fs";
import {pipeline} from "node:stream/promises";
import JSZip from "jszip";
import { mkdir, writeFile, stat, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { FactoryError, type Configuration, type Manifest, timeline, subtitles } from "./domain";
import type { ProductionPlan } from "./production";
import { ownedAsset, storagePath } from "./assets";
import { createHash } from "node:crypto";
import {prisma} from "@/lib/db/prisma";
import type {TimelineShot} from "./domain";
import {productionCaptions} from "./alignedCaptions";
import {renderRemotion} from "./remotion";

export function artifactDirectory(jobId: string) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(jobId)) throw new FactoryError("INVALID_JOB_ID", 400);
  return path.join(path.resolve(process.env.VIDEO_FACTORY_STORAGE_DIR || ".video-factory"), jobId);
}
/** Executes a fixed administrator-configured binary with an argument array, never a shell. */
export function mediaCommand(binary: "ffmpeg" | "ffprobe", args: string[], signal = AbortSignal.timeout(120000),captureStderr=false,workingDirectory?:string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env[binary === "ffmpeg" ? "VIDEO_FACTORY_FFMPEG" : "VIDEO_FACTORY_FFPROBE"] || binary, args, { shell: false, windowsHide: true, signal,cwd:workingDirectory, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { if (output.length < 200000) output += chunk.toString(); });
    child.stderr.on("data", chunk => {if(captureStderr && output.length<200000)output+=chunk.toString();});
    child.once("error", () => reject(new FactoryError("RENDERER_UNAVAILABLE", 503)));
    child.once("close", code => code === 0 ? resolve(output) : reject(new FactoryError(signal.aborted ? "RENDER_ABORTED" : "RENDER_FAILED", 503)));
  });
}
export async function rendererReady() {
  try { await Promise.all([mediaCommand("ffmpeg", ["-version"], AbortSignal.timeout(5000)), mediaCommand("ffprobe", ["-version"], AbortSignal.timeout(5000))]); return true; }
  catch { return false; }
}
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
export function dimensions(ratio: Configuration["ratio"],resolution="720p") { const base=ratio === "9:16" ? [720, 1280] : ratio === "1:1" ? [720, 720] : [1280, 720];return resolution==="1080p"?base.map(n=>Math.round(n*1.5)):base; }
export function storyboardSvg(title: string, index: number, ratio: Configuration["ratio"], rtl: boolean,silent=true) {
  const [width, height] = dimensions(ratio);
  const lines = title.match(/.{1,28}(?:\s|$)|.{1,28}/gu)?.slice(0, 5) || [title];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#111318"/><rect x="48" y="80" width="80" height="8" fill="#FF6B00"/><text x="48" y="55" fill="#b5bac5" font-family="sans-serif" font-size="22">AIFekr · ${index + 1}</text>${lines.map((line, i) => `<text x="${width / 2}" y="${height / 2 - 60 + i * 60}" text-anchor="middle" direction="${rtl ? "rtl" : "ltr"}" font-family="sans-serif" font-size="40" fill="#ffffff">${xml(line)}</text>`).join("")}<text x="48" y="${height - 42}" fill="#b5bac5" font-family="sans-serif" font-size="18">${silent?"STORYBOARD · SILENT":"AIFEKR VIDEO FACTORY"}</text></svg>`;
}
function assTime(frames:number){const cs=Math.round(frames/24*100);return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,"0")}:${String(Math.floor(cs/100)%60).padStart(2,"0")}.${String(cs%100).padStart(2,"0")}`;}
async function captionFilter(directory:string,index:number,edit:ReturnType<typeof timeline>,configuration:Configuration,plan?:ProductionPlan,userId?:string){
  if(!configuration.captions)return "";const shot=edit.shots[index],[width,height]=dimensions(configuration.ratio,configuration.resolution);
  const cues=await productionCaptions({...edit,shots:[{...shot,startFrame:0}]},configuration,plan,userId),fontSize=(configuration.captionStyle==="LARGE"?44:32)*(height/720);
  const ass=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,${configuration.captionStyle==="BOXED"?3:1},2,1,2,50,50,${Math.round(height*.08)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`+cues.map(c=>`Dialogue: 0,${assTime(c.startFrame)},${assTime(c.endFrame)},Default,,0,0,0,,${configuration.language==="fa"?"\u202b":""}${c.text.replace(/[{}]/g,"").replace(/\\/g,"＼").replace(/[\r\n]/g," ")}${configuration.language==="fa"?"\u202c":""}`).join("\n");
  const name=`captions-shot-${index}.ass`;await writeFile(path.join(directory,name),ass);return `,subtitles=filename=${name}`;
}
export function motionGraphicSvg(shot:TimelineShot,index:number,configuration:Configuration){
  const [width,height]=dimensions(configuration.ratio,configuration.resolution);
  if(shot.motion!=="CHART" && shot.motion!=="MAP")return storyboardSvg(shot.title,index,configuration.ratio,configuration.language==="fa",false);
  let content="";
  if(shot.motion==="CHART" && shot.chart){const data=shot.chart,maximum=Math.max(...data.values,1),slot=(width-120)/data.values.length;content=data.values.map((value,i)=>{const bar=(height*.5)*value/maximum,x=60+i*slot;return `<rect x="${x}" y="${height*.76-bar}" width="${slot*.65}" height="${bar}" rx="6" fill="#FF6B00"/><text x="${x+slot*.325}" y="${height*.76-bar-14}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="white">${value} ${xml(data.unit)}</text><text x="${x+slot*.325}" y="${height*.82}" text-anchor="middle" font-family="sans-serif" font-size="20" fill="white">${xml(data.labels[i])}</text>`;}).join("");}
  if(shot.motion==="MAP" && shot.map){const top=height*.25,mapHeight=height*.5;content=`<rect x="50" y="${top}" width="${width-100}" height="${mapHeight}" fill="#1b2736" stroke="#526176"/>`+shot.map.locations.map(location=>{const x=50+(location.longitude+180)/360*(width-100),y=top+(90-location.latitude)/180*mapHeight;return `<circle cx="${x}" cy="${y}" r="7" fill="#FF6B00"/><text x="${x}" y="${y-15}" text-anchor="middle" font-family="sans-serif" font-size="20" fill="white">${xml(location.label)}</text>`;}).join("");}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#111318"/><text x="${width/2}" y="${height*.14}" text-anchor="middle" direction="${configuration.language==="fa"?"rtl":"ltr"}" font-family="sans-serif" font-size="34" fill="white">${xml(shot.title)}</text>${content}</svg>`;
}
export async function renderShot(jobId: string, index: number, manifest: Manifest, configuration: Configuration, signal: AbortSignal,plan?:ProductionPlan,userId?:string) {
  const edit = timeline(manifest, configuration.durationSeconds), shot = edit.shots[index];
  const directory = artifactDirectory(jobId);
  await mkdir(directory, { recursive: true });
  const plate = path.join(directory, `plate-${index}.png`), output = path.join(directory, `shot-${index}.mp4`);
  const captions=await captionFilter(directory,index,edit,configuration,plan,userId);
  const localShot={...shot,startFrame:undefined,chapter:undefined};
  const signature=createHash("sha256").update(JSON.stringify({shot:localShot,index,durationFrames:shot.durationFrames,configuration:{ratio:configuration.ratio,resolution:configuration.resolution,mediaMode:configuration.mediaMode,renderer:plan?.policy.commercial.renderer,voice:configuration.voice,narration:configuration.narration,captions:configuration.captions,captionStyle:configuration.captionStyle,language:configuration.language,transition:configuration.transition},assets:plan?Object.entries(plan.assetIds).filter(([key])=>key.endsWith(`-${shot.id}`)).sort():[]})).digest("hex");
  if(userId){
    const previous=await prisma.videoFactoryStep.findFirst({where:{inputHash:signature,status:"COMPLETED",job:{userId,status:"DELIVERED"}},orderBy:{completedAt:"desc"},select:{jobId:true,output:true}});
    if(previous?.output){const saved=JSON.parse(previous.output) as {fileName?:string};if(saved.fileName && /^shot-\d+\.mp4$/.test(saved.fileName))try{await copyFile(path.join(artifactDirectory(previous.jobId),saved.fileName),output);return {reused:true,signature};}catch{/* Expired source media is rendered again. */}}
  }
  if(configuration.mediaMode==="MULTIMEDIA" && plan && userId){
    const [width,height]=dimensions(configuration.ratio,configuration.resolution),seconds=shot.durationFrames/24;
    const visualId=shot.assetId || plan.assetIds[`video-${shot.id}`] || plan.assetIds[`image-${shot.id}`];
    const visual=visualId?await ownedAsset(userId,visualId):null;
    let remotionVideo:string|undefined;
    if((!visual || visual.mimeType.startsWith("image/")) && shot.motion!=="MAP" && plan.policy.commercial.renderer==="REMOTION"){
      if(!plan.policy.commercial.remotionLicenseApproved)throw new FactoryError("REMOTION_LICENSE_APPROVAL_REQUIRED",403);
      if(visual)await sharp(storagePath(visual.storageKey)).resize(width,height,{fit:"cover"}).png().toFile(plate);
      remotionVideo=await renderRemotion(directory,index,shot,width,height,configuration.language==="fa",signal,visual?plate:undefined);
      await mediaCommand("ffmpeg",["-y","-i",remotionVideo,"-frames:v","1",plate],signal);
    }
    const voiceId=plan.assetIds[`tts-${shot.id}`],voice=voiceId?await ownedAsset(userId,voiceId):null;
    let input:string[];
    if(remotionVideo)input=["-i",remotionVideo];
    else if(visual?.mimeType.startsWith("video/"))input=["-stream_loop","-1","-i",storagePath(visual.storageKey)];
    else{
      if(visual){if(!visual.mimeType.startsWith("image/"))throw new FactoryError("INVALID_VISUAL_ASSET",400);await sharp(storagePath(visual.storageKey)).resize(width,height,{fit:"cover"}).png().toFile(plate);}
      else await sharp(Buffer.from(motionGraphicSvg(shot,index,configuration))).resize(width,height).png().toFile(plate);
      input=["-loop","1","-framerate","24","-i",plate];
    }
    let audioFilter="anull";
    if(voice){
      const info=JSON.parse(await mediaCommand("ffprobe",["-v","error","-show_entries","format=duration","-of","json",storagePath(voice.storageKey)],signal));
      const duration=Number(info.format?.duration);if(!Number.isFinite(duration)||duration<=0)throw new FactoryError("INVALID_VOICE_MEDIA");
      const speed=Math.max(0.5,Math.min(2,duration/seconds));if(duration/seconds>2)throw new FactoryError("NARRATION_EXCEEDS_SHOT_DURATION",400);
      audioFilter=`atempo=${speed.toFixed(6)},apad,atrim=duration=${seconds},loudnorm=I=-16:TP=-1.5:LRA=11`;
      input.push("-i",storagePath(voice.storageKey));
    }else input.push("-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000");
    const scale=`scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
    const motion=!remotionVideo && !visual?.mimeType.startsWith("video/") && shot.motion==="PUSH_IN"?`,zoompan=z='min(zoom+0.0005,1.12)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${width}x${height}:fps=24`:!remotionVideo && !visual?.mimeType.startsWith("video/") && shot.motion==="PAN"?`,zoompan=z=1.15:x='min(iw-iw/zoom,on*2)':y='(ih-ih/zoom)/2':d=1:s=${width}x${height}:fps=24`:"";
    const fade=configuration.transition==="FADE"?",fade=t=in:st=0:d=0.2":"";
    await mediaCommand("ffmpeg",["-y","-threads","1",...input,"-vf",`${scale}${motion}${fade}${captions}`,"-map","0:v:0","-map","1:a:0","-af",audioFilter,"-frames:v",String(shot.durationFrames),"-t",String(seconds),"-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p","-r","24","-c:a","aac","-ar","48000","-ac","2","-threads","1",output],signal,false,directory);
    return {reused:false,signature};
  }
  const [width,height]=dimensions(configuration.ratio,configuration.resolution);
  await sharp(Buffer.from(storyboardSvg(shot.title, index, configuration.ratio, configuration.language === "fa"))).resize(width,height).png().toFile(plate);
  await mediaCommand("ffmpeg", ["-y", "-threads", "1", "-loop", "1", "-framerate", "24", "-i", plate, "-vf", `fade=t=in:st=0:d=0.25${captions}`, "-frames:v", String(shot.durationFrames), "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-threads", "1", output], signal,false,directory);
  return {reused:false,signature};
}
export async function assemble(jobId: string, manifest: Manifest, configuration: Configuration, signal: AbortSignal,plan?:ProductionPlan,userId?:string) {
  const directory = artifactDirectory(jobId), edit = timeline(manifest, configuration.durationSeconds);
  // Concat entries are fixed internal names; no user-supplied paths or URLs.
  await writeFile(path.join(directory, "concat.txt"), edit.shots.map((_, i) => `file 'shot-${i}.mp4'`).join("\n"));
  const musicId=plan?.assetIds["music-bed"],music=musicId && userId?await ownedAsset(userId,musicId):null;
  const layers=[...configuration.audioTracks];
  if(plan)for(const shot of edit.shots){const assetId=plan.assetIds[`sfx-${shot.id}`];if(assetId)layers.push({assetId,startSeconds:shot.startFrame/24,offsetSeconds:0,durationSeconds:Math.min(22,shot.durationFrames/24),gainDb:-12,fadeSeconds:.2,kind:"SFX"});}
  const input:string[]=[],filters:string[]=[],mix:string[]=["[voice]"];let next=1;
  const stemFiles:[string,string][]=[];
  if(configuration.exportStems && configuration.mediaMode!=="MULTIMEDIA")throw new FactoryError("STEMS_REQUIRE_MULTIMEDIA",400);
  if(music || layers.length || configuration.exportStems){filters.push(configuration.exportStems?"[0:a]asplit=3[voice][side][narrationStem]":"[0:a]asplit=2[voice][side]");
    if(configuration.exportStems)stemFiles.push(["narrationStem","narration.m4a"]);
    if(music){input.push("-stream_loop","-1","-i",storagePath(music.storageKey));filters.push(`[${next++}:a]volume=0.16${configuration.exportStems?",asplit=2[bed][musicStem]":"[bed]"}`,`[bed][side]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500[ducked]`);mix.push("[ducked]");if(configuration.exportStems)stemFiles.push(["musicStem","music.m4a"]);}else filters.push("[side]anullsink");
    for(let i=0;i<layers.length;i++){if(!userId)throw new FactoryError("AUDIO_OWNER_REQUIRED");const layer=layers[i],asset=await ownedAsset(userId,layer.assetId);if(!asset.mimeType.startsWith("audio/"))throw new FactoryError("INVALID_AUDIO_ASSET");input.push("-i",storagePath(asset.storageKey));const fade=Math.min(layer.fadeSeconds,layer.durationSeconds/2);filters.push(`[${next++}:a]atrim=start=${layer.offsetSeconds}:duration=${layer.durationSeconds},asetpts=PTS-STARTPTS,volume=${layer.gainDb}dB,afade=t=in:d=${fade},afade=t=out:st=${layer.durationSeconds-fade}:d=${fade},adelay=${Math.round(layer.startSeconds*1000)}:all=1[layer${i}]`);mix.push(`[layer${i}]`);}
    if(configuration.exportStems && layers.length){for(let i=0;i<filters.length;i++)for(let j=0;j<layers.length;j++)if(filters[i].endsWith(`[layer${j}]`))filters[i]=filters[i].slice(0,-`[layer${j}]`.length)+`,apad,atrim=duration=${configuration.durationSeconds},asplit=2[layer${j}][stemLayer${j}]`;filters.push(layers.map((_,i)=>`[stemLayer${i}]`).join("")+`amix=inputs=${layers.length}:duration=longest:normalize=0[layersStem]`);stemFiles.push(["layersStem","layers.m4a"]);}
    filters.push(`${mix.join("")}amix=inputs=${mix.length}:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`);
  }
  await mediaCommand("ffmpeg",["-y","-f","concat","-safe","1","-i",path.join(directory,"concat.txt"),...input,...(filters.length?["-filter_complex",filters.join(";"),"-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-t",String(configuration.durationSeconds)]:["-c","copy"]),"-movflags","+faststart",path.join(directory,"film.mp4"),...stemFiles.flatMap(([label,file])=>["-map",`[${label}]`,"-c:a","aac","-t",String(configuration.durationSeconds),path.join(directory,file)])],signal);
  const info = JSON.parse(await mediaCommand("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", path.join(directory, "film.mp4")], signal));
  if (Math.abs(Number(info.format?.duration) - configuration.durationSeconds) > 0.1 || !info.streams?.some((s: { codec_type: string }) => s.codec_type === "video")) throw new FactoryError("QC_DURATION_FAILED", 503);
  const cues=await productionCaptions(edit,configuration,plan,userId);
  await writeFile(path.join(directory, "manifest.json"), JSON.stringify({ output: configuration.mediaMode==="MULTIMEDIA"?"multimedia_film":"silent_storyboard_film", configuration, manifest, timeline: edit, qc: info,captions:cues,captionTiming:configuration.forcedAlignment?"forced-aligned words, adjusted by narration playback speed":"estimated phrase timing; not forced-aligned words" }, null, 2));
  await writeFile(path.join(directory, "captions.srt"), subtitles(edit, "srt", configuration.language,cues));
  await writeFile(path.join(directory, "captions.vtt"), subtitles(edit, "vtt", configuration.language,cues));
  await writeFile(path.join(directory, "transcript.txt"), edit.shots.map(s => s.narration).join("\n\n"));
  await copyFile(path.join(directory,"plate-0.png"),path.join(directory,"thumbnail.png")).catch(async()=>{await sharp(Buffer.from(storyboardSvg(manifest.chapters[0].title,0,configuration.ratio,configuration.language==="fa"))).png().toFile(path.join(directory,"thumbnail.png"));});
  const chapterStarts=manifest.chapters.map((chapter,index)=>{const s=edit.shots.find(shot=>shot.chapter===index)!;const total=Math.floor(s.startFrame/24);return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")} ${chapter.title}`;});
  await writeFile(path.join(directory,"chapters.txt"),chapterStarts.join("\n"));
  const files = [["video", "film.mp4"], ["manifest", "manifest.json"], ["srt", "captions.srt"], ["vtt", "captions.vtt"], ["transcript", "transcript.txt"],["thumbnail","thumbnail.png"],["chapters","chapters.txt"]];
  for(const [,file] of stemFiles)files.push([`stem_${file.split(".")[0]}`,file]);
  const archive=new JSZip();for(const [,fileName] of files)archive.file(fileName,createReadStream(path.join(directory,fileName)));
  await pipeline(archive.generateNodeStream({streamFiles:true,compression:"STORE"}),createWriteStream(path.join(directory,"project.zip")));
  files.push(["archive","project.zip"]);
  return Promise.all(files.map(async ([kind, fileName]) => ({ kind, fileName, bytes: (await stat(path.join(directory, fileName))).size })));
}
export function artifactPath(jobId: string, fileName: string) {
  if (!["film.mp4", "manifest.json", "captions.srt", "captions.vtt", "transcript.txt","thumbnail.png","chapters.txt","project.zip","narration.m4a","music.m4a","layers.m4a"].includes(fileName)) throw new FactoryError("ARTIFACT_NOT_FOUND", 404);
  return path.join(artifactDirectory(jobId), fileName);
}



