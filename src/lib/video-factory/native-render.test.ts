import { describe, it, expect, beforeAll, afterAll,vi } from "vitest";
import { existsSync } from "node:fs";
import { mkdir,rm,stat,writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
const fixtures=vi.hoisted(()=>({assets:[] as {id:string;userId:string;storageKey:string;mimeType:string;status:string}[]}));
vi.mock("@/lib/db/prisma",()=>({prisma:{videoFactoryStep:{findFirst:async()=>null},videoFactoryAsset:{findFirst:async({where}:{where:{id:string;userId:string}})=>fixtures.assets.find(a=>a.id===where.id&&a.userId===where.userId&&a.status==="READY") || null}}}));
import { configurationSchema,manifestSchema,policySchema } from "./domain";
import { buildProductionPlan } from "./production";
import { renderShot,assemble,mediaCommand,artifactDirectory } from "./render";
const ffmpeg=process.env.VIDEO_FACTORY_FFMPEG || path.resolve("tmp/video-factory/tools/node_modules/ffmpeg-static/ffmpeg.exe");
const ffprobe=process.env.VIDEO_FACTORY_FFPROBE || path.resolve("tmp/video-factory/tools/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe");
describe.runIf(existsSync(ffmpeg) && existsSync(ffprobe))("real native FFmpeg production without provider fees",()=>{
  const root=path.resolve("tmp",`vf-native-${randomUUID()}`),jobId=randomUUID();let oldRoot:string|undefined,oldFfmpeg:string|undefined,oldFfprobe:string|undefined;
  beforeAll(async()=>{oldRoot=process.env.VIDEO_FACTORY_STORAGE_DIR;oldFfmpeg=process.env.VIDEO_FACTORY_FFMPEG;oldFfprobe=process.env.VIDEO_FACTORY_FFPROBE;process.env.VIDEO_FACTORY_STORAGE_DIR=root;process.env.VIDEO_FACTORY_FFMPEG=ffmpeg;process.env.VIDEO_FACTORY_FFPROBE=ffprobe;await mkdir(root,{recursive:true});});
  afterAll(async()=>{if(!root.startsWith(path.resolve("tmp")+path.sep))throw Error("Unexpected test path");await rm(root,{recursive:true,force:true});for(const [key,value] of [["VIDEO_FACTORY_STORAGE_DIR",oldRoot],["VIDEO_FACTORY_FFMPEG",oldFfmpeg],["VIDEO_FACTORY_FFPROBE",oldFfprobe]]){if(value===undefined)delete process.env[key!];else process.env[key!]=value;}});
  it("encodes Persian shots, assembles a real MP4, checks duration and exports captions/thumbnail/chapters",async()=>{
    const config=configurationSchema.parse({durationSeconds:15,language:"fa",ratio:"16:9",mode:"AUTOPILOT",quality:"SMART",budgetCap:100,mediaMode:"MULTIMEDIA"});
    const manifest=manifestSchema.parse({chapters:[{title:"فصل آزمایشی",continuity:"Synthetic test only",shots:[{id:"test-1",title:"سلام دنیا",narration:"روایت آزمایشی",visualPrompt:"TEST ONLY"},{id:"test-2",title:"پایان آزمایش",narration:"متن فارسی",visualPrompt:"TEST ONLY"}]}]});
    const policy=policySchema.parse({presets:{SMART:{videoPercent:0,imagePercent:0}}}),plan=buildProductionPlan(manifest,config,policy);
    await renderShot(jobId,0,manifest,config,AbortSignal.timeout(60000),plan,"test-only-user");
    await renderShot(jobId,1,manifest,config,AbortSignal.timeout(60000),plan,"test-only-user");
    const files=await assemble(jobId,manifest,config,AbortSignal.timeout(60000),plan,"test-only-user");
    expect(files.map(f=>f.kind)).toEqual(expect.arrayContaining(["video","thumbnail","srt","vtt","chapters","manifest"]));
    const info=JSON.parse(await mediaCommand("ffprobe",["-v","error","-show_entries","format=duration:stream=codec_type","-of","json",path.join(artifactDirectory(jobId),"film.mp4")]));
    expect(Math.abs(Number(info.format.duration)-15)).toBeLessThan(.1);expect(info.streams.some((s:{codec_type:string})=>s.codec_type==="audio")).toBe(true);
    expect((await stat(path.join(artifactDirectory(jobId),"thumbnail.png"))).size).toBeGreaterThan(1000);
  },120000);
  it("renders actual image/video inputs with fitted narration, ducked music and RTL burned-in captions",async()=>{
    const media=path.join(root,"assets");await mkdir(media,{recursive:true});
    const imageId=randomUUID(),videoId=randomUUID(),voiceId=randomUUID(),musicId=randomUUID();
    const sharp=(await import("sharp")).default;await writeFile(path.join(media,`${imageId}.png`),await sharp({create:{width:640,height:480,channels:3,background:"#285766"}}).png().toBuffer());
    await mediaCommand("ffmpeg",["-y","-f","lavfi","-i","color=c=orange:s=320x240:r=24","-t","2","-c:v","libx264","-pix_fmt","yuv420p",path.join(media,`${videoId}.mp4`)]);
    for(const [id,frequency] of [[voiceId,440],[musicId,220]])await mediaCommand("ffmpeg",["-y","-f","lavfi","-i",`sine=frequency=${frequency}:sample_rate=48000`,"-t","4","-c:a","libmp3lame",path.join(media,`${id}.mp3`)]);
    fixtures.assets=[{id:imageId,storageKey:`assets/${imageId}.png`,mimeType:"image/png",userId:"native-user",status:"READY"},{id:videoId,storageKey:`assets/${videoId}.mp4`,mimeType:"video/mp4",userId:"native-user",status:"READY"},...[[voiceId,"mp3"],[musicId,"mp3"]].map(([id,extension])=>({id,storageKey:`assets/${id}.${extension}`,mimeType:"audio/mpeg",userId:"native-user",status:"READY"}))];
    const alignmentId=randomUUID();await writeFile(path.join(media,`${alignmentId}.json`),JSON.stringify({words:[{text:"سلام",start:0,end:1},{text:"آزمون",start:1.1,end:2}]}));fixtures.assets.push({id:alignmentId,storageKey:`assets/${alignmentId}.json`,mimeType:"application/json",userId:"native-user",status:"READY"});
    const config=configurationSchema.parse({durationSeconds:15,language:"fa",ratio:"16:9",mode:"AUTOPILOT",quality:"SMART",budgetCap:100,mediaMode:"MULTIMEDIA",narration:true,music:true,captionStyle:"BOXED",forcedAlignment:true,exportStems:true,audioTracks:[{assetId:musicId,startSeconds:2,offsetSeconds:1,durationSeconds:2,gainDb:-20,fadeSeconds:.3,kind:"SFX"}]});
    const manifest=manifestSchema.parse({chapters:[{title:"آزمون چندرسانه‌ای",continuity:"TEST ONLY synthetic tones, no generated speech",shots:[{id:"image",title:"تصویر آزمایشی",narration:"این زیرنویس فارسی برای آزمون است",visualPrompt:"TEST ONLY",assetId:imageId},{id:"video",title:"کلیپ آزمایشی",narration:"این هم کلیپ آزمایشی است",visualPrompt:"TEST ONLY",assetId:videoId}]}]});
    const plan=buildProductionPlan(manifest,config,policySchema.parse({}));plan.assetIds={"tts-image":voiceId,"tts-video":voiceId,"music-bed":musicId,"alignment-image":alignmentId,"alignment-video":alignmentId,"sfx-image":musicId};const id=randomUUID();
    await renderShot(id,0,manifest,config,AbortSignal.timeout(60000),plan,"native-user");await renderShot(id,1,manifest,config,AbortSignal.timeout(60000),plan,"native-user");const files=await assemble(id,manifest,config,AbortSignal.timeout(60000),plan,"native-user");expect(files.map(f=>f.kind)).toEqual(expect.arrayContaining(["stem_narration","stem_music","stem_layers"]));expect(files.find(f=>f.kind==="archive")!.bytes).toBeGreaterThan(10000);
    const audio=await mediaCommand("ffmpeg",["-hide_banner","-i",path.join(artifactDirectory(id),"film.mp4"),"-vn","-af","volumedetect","-f","null","-"],AbortSignal.timeout(60000),true);expect(audio).not.toContain("max_volume: -inf");expect(audio).toMatch(/max_volume:\s*-?\d/);
  },120000);
});

