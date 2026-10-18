import { z } from "zod";
import {commercialSchema,commercialEstimate} from "./economics";

import {FactoryError} from "./errors";
export {FactoryError} from "./errors";
export const configurationSchema = z.object({
  durationSeconds: z.number().int().min(15).max(3600),
  language: z.enum(["fa", "en", "de", "tr"]),
  ratio: z.enum(["16:9", "9:16", "1:1"]),
  mode: z.enum(["AUTOPILOT", "REVIEW_GATES", "PRO_STUDIO"]),
  quality: z.enum(["SMART", "CINEMATIC_HYBRID", "FILM_STUDIO"]),
  budgetCap: z.number().int().min(1).max(1_000_000),
  audience: z.string().max(500).default(""),
  genre: z.string().max(100).default("educational"),
  styleBible: z.string().max(6000).default(""),
  mediaMode: z.enum(["ANIMATIC", "MULTIMEDIA"]).default("ANIMATIC"),
  shotsPerChapter: z.number().int().min(1).max(30).default(8),
  narration: z.boolean().default(false),
  music: z.boolean().default(false),
  musicPrompt: z.string().max(2000).default("Instrumental background, no vocals"),
  voice: z.enum(["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse", "marin", "cedar"]).default("alloy"),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  captions: z.boolean().default(true),
  captionStyle:z.enum(["CLEAN","BOXED","LARGE"]).default("CLEAN"),
  transition:z.enum(["CUT","FADE"]).default("FADE"),
  ideaLab: z.boolean().default(false),
  voiceProfileId:z.string().max(100).default(""),
  forcedAlignment:z.boolean().default(false),
  semanticReview:z.boolean().default(false),
  exportStems:z.boolean().default(false),
  transcriptionAssetId:z.string().max(100).default(""),
  pronunciation:z.array(z.object({word:z.string().min(1).max(100),replacement:z.string().min(1).max(200)}).strict()).max(100).default([]),
  audioTracks:z.array(z.object({assetId:z.string().max(100),startSeconds:z.number().min(0).max(3600),offsetSeconds:z.number().min(0).max(3600).default(0),durationSeconds:z.number().min(.1).max(3600),gainDb:z.number().min(-60).max(6).default(-12),fadeSeconds:z.number().min(0).max(5).default(.2),kind:z.enum(["SFX","MUSIC","VOICE"])}).strict()).max(20).default([]),
}).strict();
export type Configuration = z.infer<typeof configurationSchema>;
export const projectSchema = z.object({ title: z.string().trim().min(3).max(180), brief: z.string().trim().min(10).max(30000), configuration: configurationSchema }).strict();
export const shotSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  title: z.string().min(1).max(180),
  narration: z.string().max(3000),
  visualPrompt: z.string().max(2000),
  durationSeconds: z.number().finite().min(0.5).max(600).optional(),
  assetId: z.string().max(100).optional(),
  motion: z.enum(["STATIC", "PUSH_IN", "PAN", "TITLE", "CHART","MAP"]).default("PUSH_IN"),
  chart:z.object({labels:z.array(z.string().max(60)).min(1).max(10),values:z.array(z.number().finite().min(0).max(1000000000)).min(1).max(10),unit:z.string().max(40).default("")}).strict().refine(v=>v.labels.length===v.values.length,"Chart labels and values must match").optional(),
  map:z.object({locations:z.array(z.object({label:z.string().max(60),latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)}).strict()).min(1).max(10)}).strict().optional(),
  notes: z.string().max(2000).default(""),
  revision: z.number().int().min(0).max(1000).default(0),
  sfxPrompt:z.string().max(1000).default(""),
}).strict();
export const chapterSchema = z.object({ title: z.string().min(1).max(180), continuity: z.string().max(3000), shots: z.array(shotSchema).min(1).max(30) }).strict();
export const manifestSchema = z.object({ chapters: z.array(chapterSchema).min(1).max(12), characters: z.array(z.object({ name: z.string().max(100), description: z.string().max(2000) }).strict()).max(30).default([]) }).strict().superRefine((v, ctx) => {
  const ids = v.chapters.flatMap(c => c.shots.map(s => s.id));
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Shot IDs must be unique" });
});
export type Manifest = z.infer<typeof manifestSchema>;
export const policySchema = z.object({
  packageUsage:z.object({paymentId:z.string(),seconds:z.number().int().positive().max(480)}).optional(),
  packageRequired:z.boolean().default(false),
  commercial:commercialSchema.default(commercialSchema.parse({})),
  enabled: z.boolean().default(false),
  longFormEnabled: z.boolean().default(false),
  approvedModelId: z.string().max(100).default(""),
  approvedTextModelIds: z.array(z.string().max(100)).max(30).default([]),
  creditsPerChapter: z.number().int().min(1).max(100000).nullable().default(null),
  creditsPerRenderMinute: z.number().int().min(1).max(10000).nullable().default(null),
  maxProjectCredits: z.number().int().min(1).max(1000000).default(10000),
  maxActivePerUser: z.number().int().min(1).max(10).default(2),
  maxQueuedJobs: z.number().int().min(1).max(1000).default(100),
  maxWorkers:z.number().int().min(1).max(8).default(2),
  providers: z.object({ image: z.string().max(100).default(""), video: z.string().max(100).default(""), tts: z.string().max(100).default(""), music: z.string().max(100).default("") }).default({ image: "", video: "", tts: "", music: "" }),
  fallbackProviders: z.array(z.string().max(100)).max(10).default([]),
  creditsPerImage: z.number().int().min(1).max(100000).nullable().default(null),
  creditsPerVoice: z.number().int().min(1).max(100000).nullable().default(null),
  creditsPerVideoSecond: z.number().int().min(1).max(100000).nullable().default(null),
  creditsPerMusicMinute: z.number().int().min(1).max(100000).nullable().default(null),
  creditsPerResearch: z.number().int().min(1).max(100000).nullable().default(null),
  advancedProviders:z.object({clone:z.string().max(100).default(""),alignment:z.string().max(100).default(""),transcription:z.string().max(100).default(""),vision:z.string().max(100).default(""),sfx:z.string().max(100).default("")}).default({clone:"",alignment:"",transcription:"",vision:"",sfx:""}),
  creditsPerClone:z.number().int().positive().max(100000).nullable().default(null),
  creditsPerAlignment:z.number().int().positive().max(100000).nullable().default(null),
  creditsPerTranscription:z.number().int().positive().max(100000).nullable().default(null),
  creditsPerSemanticReview:z.number().int().positive().max(100000).nullable().default(null),
  creditsPerSfx:z.number().int().positive().max(100000).nullable().default(null),
  maxStorageBytesPerUser: z.number().int().min(10000000).max(100000000000).default(2000000000),
  retentionDays: z.number().int().min(1).max(3650).default(30),
  maxRetries: z.number().int().min(0).max(5).default(2),
  publishingEnabled: z.boolean().default(false),
  presets: z.object({
    SMART: z.object({ videoPercent: z.number().int().min(0).max(100), imagePercent: z.number().int().min(0).max(100) }).default({videoPercent:0,imagePercent:80}),
    CINEMATIC_HYBRID: z.object({ videoPercent: z.number().int().min(0).max(100), imagePercent: z.number().int().min(0).max(100) }).default({videoPercent:40,imagePercent:50}),
    FILM_STUDIO: z.object({ videoPercent: z.number().int().min(0).max(100), imagePercent: z.number().int().min(0).max(100) }).default({videoPercent:80,imagePercent:20}),
  }).default({SMART:{videoPercent:0,imagePercent:80},CINEMATIC_HYBRID:{videoPercent:40,imagePercent:50},FILM_STUDIO:{videoPercent:80,imagePercent:20}}),
}).strict();
export type Policy = z.infer<typeof policySchema>;
export function chapterCount(seconds: number) { return Math.max(1, Math.ceil(seconds / 300)); }
export function quote(configuration: Configuration, policy: Policy) {
  if(configuration.mediaMode!=="MULTIMEDIA" && (configuration.exportStems || configuration.forcedAlignment || configuration.semanticReview || configuration.voiceProfileId || configuration.transcriptionAssetId || configuration.audioTracks.length))throw new FactoryError("ADVANCED_FEATURES_REQUIRE_MULTIMEDIA",400);
  if(configuration.forcedAlignment && !configuration.narration)throw new FactoryError("ALIGNMENT_REQUIRES_NARRATION",400);
  if (!policy.enabled) throw new FactoryError("FACTORY_DISABLED", 503);
  if (configuration.durationSeconds > 60 && !policy.longFormEnabled) throw new FactoryError("LONG_FORM_DISABLED", 403);
  if (!policy.creditsPerChapter || !policy.creditsPerRenderMinute) throw new FactoryError("PRICING_NOT_CONFIGURED", 503);
  if (configuration.mediaMode === "ANIMATIC" && configuration.quality !== "SMART") throw new FactoryError("QUALITY_ADAPTER_NOT_CONFIGURED", 503);
  const items = [
    { action: "script_storyboard", quantity: chapterCount(configuration.durationSeconds), credits: chapterCount(configuration.durationSeconds) * policy.creditsPerChapter },
    { action: "silent_animatic_render", quantity: Math.ceil(configuration.durationSeconds / 60), credits: Math.ceil(configuration.durationSeconds / 60) * policy.creditsPerRenderMinute },
  ];
  if(configuration.ideaLab){if(!policy.creditsPerResearch)throw new FactoryError("RESEARCH_PRICING_NOT_CONFIGURED",503);items.push({action:"idea_lab",quantity:1,credits:policy.creditsPerResearch});}
  if (configuration.mediaMode === "MULTIMEDIA") {
    const shots = chapterCount(configuration.durationSeconds) * configuration.shotsPerChapter;
    const mix = policy.presets[configuration.quality];
    if (mix.imagePercent + mix.videoPercent > 100) throw new FactoryError("INVALID_PRESET", 503);
    const video = Math.ceil(shots * mix.videoPercent / 100), images = Math.min(shots - video, Math.ceil(shots * mix.imagePercent / 100));
    const add = (action: string, quantity: number, rate: number | null) => {
      if (!quantity) return;
      if (!rate) throw new FactoryError("MEDIA_PRICING_NOT_CONFIGURED", 503);
      items.push({ action, quantity, credits: quantity * rate });
    };
    add("images", images, policy.creditsPerImage);
    // Clips are independently generated in four-second units and fitted to the edit.
    add("video_seconds", video * 4, policy.creditsPerVideoSecond);
    add("voice_shots", configuration.narration ? shots : 0, policy.creditsPerVoice);
    add("music_minutes", configuration.music ? Math.min(10, Math.ceil(configuration.durationSeconds / 60)) : 0, policy.creditsPerMusicMinute);
    add("voice_clone",configuration.narration && configuration.voiceProfileId?1:0,policy.creditsPerClone);
    add("alignment_shots",configuration.narration && configuration.forcedAlignment?shots:0,policy.creditsPerAlignment);
    add("transcription",configuration.transcriptionAssetId?1:0,policy.creditsPerTranscription);
    add("semantic_shots",configuration.semanticReview?shots:0,policy.creditsPerSemanticReview);
    add("sound_effects",policy.advancedProviders.sfx?shots:0,policy.creditsPerSfx);
  }
  let credits = items.reduce((n, item) => n + item.credits, 0);
  const commercial=policy.commercial.mode==="DURATION_RETAIL"?commercialEstimate(policy.commercial,configuration.durationSeconds):null;
  if(commercial){if(!commercial.credits)throw new FactoryError("PLATFORM_CREDIT_RATE_UNAVAILABLE",503);if(credits>commercial.credits)throw new FactoryError("ACTION_BUDGET_EXCEEDS_RETAIL",503);items.push({action:"completed_film_package",quantity:1,credits:commercial.credits-credits});credits=commercial.credits;}
  if (credits > Math.min(configuration.budgetCap, policy.maxProjectCredits)) throw new FactoryError("BUDGET_EXCEEDED", 402);
  return { items, credits,commercial, kind: "estimate" as const, output: configuration.mediaMode === "MULTIMEDIA" ? "multimedia_film" : "silent_storyboard_film", unavailable: [] as string[] };
}
export type TimelineShot = z.infer<typeof shotSchema> & {chapter:number;startFrame:number;durationFrames:number};
/** Allocate integer frames without gaps or rounding drift, including 60-minute projects. */
export function timeline(manifest: Manifest, seconds: number): { fps: number; totalFrames: number; shots: TimelineShot[] } {
  const source = manifest.chapters.flatMap((c, chapter) => c.shots.map(s => ({ ...s, chapter })));
  const totalFrames = seconds * 24;
  let cursor = 0;
  const weight = source.reduce((n,s)=>n+(s.durationSeconds || 1),0);
  let elapsedWeight = 0;
  const shots = source.map((shot) => {
    elapsedWeight += shot.durationSeconds || 1;
    const end = Math.round(elapsedWeight * totalFrames / weight);
    const result = { ...shot, startFrame: cursor, durationFrames: end - cursor };
    cursor = end;
    return result;
  });
  return { fps: 24, totalFrames, shots };
}
function timestamp(frames: number, separator: string) {
  const ms = Math.round(frames / 24 * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`;
}
export function subtitles(edit: ReturnType<typeof timeline>, format: "srt" | "vtt", language: string,cues=captionCues(edit)) {
  return (format === "vtt" ? "WEBVTT\n\n" : "") + cues.map((s, i) => {
    const text = s.text.replace(/\r?\n\s*\r?\n/g, "\n").replace(/-->/g, "→").replace(/[<>]/g, "");
    return `${i + 1}\n${timestamp(s.startFrame, format === "srt" ? "," : ".")} --> ${timestamp(s.endFrame, format === "srt" ? "," : ".")}\n${language === "fa" ? "\u202b" : ""}${text}${language === "fa" ? "\u202c" : ""}\n`;
  }).join("\n");
}
/** Estimated phrase timestamps; never represented as forced-aligned word timing. */
export function captionCues(edit:ReturnType<typeof timeline>){return edit.shots.flatMap(shot=>{
  const words=shot.narration.trim().split(/\s+/).filter(Boolean);if(!words.length)return [];
  const count=Math.max(1,Math.min(Math.ceil(words.length/12),Math.floor(shot.durationFrames/24)));
  return Array.from({length:count},(_,i)=>({startFrame:shot.startFrame+Math.round(i*shot.durationFrames/count),endFrame:shot.startFrame+Math.round((i+1)*shot.durationFrames/count),text:words.slice(Math.floor(i*words.length/count),Math.floor((i+1)*words.length/count)).join(" ")}));
});}

