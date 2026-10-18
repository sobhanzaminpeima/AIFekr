import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { reserveLoggedCredits, refundLoggedReservation } from "@/lib/utils/teamCredits";
import { getPolicy } from "./config";
import { chapterSchema, configurationSchema, FactoryError, manifestSchema, policySchema, projectSchema, quote, type Manifest } from "./domain";
import { approvedProvider } from "./providers";
import { rendererReady } from "./render";
import { getLimitsForPlan } from "@/lib/utils/planLimits";
import { buildProductionPlan } from "./production";
import { enforceUserPolicy, getUserPolicy } from "./resources";
import { getMediaProvider } from "./registry";
import {preserveProjectVersion} from "./versions";
import {ownedAsset} from "./assets";
import {requireVoiceConsent} from "./voiceConsent";
import {claimPackage,settlementCredits} from "./packages";
async function validateAdvancedReferences(userId:string,projectId:string,configuration:ReturnType<typeof configurationSchema.parse>){
 if(configuration.voiceProfileId)await requireVoiceConsent(userId,configuration.voiceProfileId,projectId);
 for(const id of [configuration.transcriptionAssetId,...configuration.audioTracks.map(t=>t.assetId)].filter(Boolean)){const asset=await ownedAsset(userId,id);if(!asset.mimeType.startsWith("audio/"))throw new FactoryError("INVALID_AUDIO_ASSET",400);}
 if(configuration.audioTracks.some(t=>t.startSeconds+t.durationSeconds>configuration.durationSeconds))throw new FactoryError("AUDIO_TRACK_OUTSIDE_TIMELINE",400);
}
export async function updateProjectConfiguration(userId:string,id:string,expectedVersion:number,input:unknown){
 const configuration=configurationSchema.parse(input);await validateAdvancedReferences(userId,id,configuration);
 return prisma.$transaction(async tx=>{const project=await tx.videoFactoryProject.findFirst({where:{id,userId,deletedAt:null}});if(!project)throw new FactoryError("PROJECT_NOT_FOUND",404);if(project.activeJobId)throw new FactoryError("PROJECT_BUSY");const changed=await tx.videoFactoryProject.updateMany({where:{id,userId,version:expectedVersion,activeJobId:null},data:{configuration:JSON.stringify(configuration),version:{increment:1}}});if(!changed.count)throw new FactoryError("VERSION_CONFLICT");await preserveProjectVersion(tx,project,userId);return {version:expectedVersion+1};});
}

export const terminalStatuses = ["DELIVERED", "FAILED", "CANCELLED"];
export const activeStatuses = ["QUEUED", "RUNNING", "PAUSED", "AWAITING_APPROVAL", "PAUSING", "CANCELLING"];
export function hash(input: unknown) { return createHash("sha256").update(JSON.stringify(input)).digest("hex"); }
export async function listProjects(userId: string, page = 0) {
  return prisma.videoFactoryProject.findMany({ where: { userId,deletedAt:null }, orderBy: { updatedAt: "desc" }, take: 30, skip: page * 30, include: { jobs: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, stage: true, cursor: true, credits: true, spentCredits: true, errorCode: true } } } });
}
export async function createProject(userId: string, input: unknown) {
  const value = projectSchema.parse(input);
  return prisma.videoFactoryProject.create({ data: { userId, title: value.title, brief: value.brief, configuration: JSON.stringify(value.configuration) } });
}
/** Every user-facing object lookup enforces the authenticated owner boundary. */
export async function getProject(userId: string, id: string) {
  const project = await prisma.videoFactoryProject.findFirst({ where: { id, userId,deletedAt:null }, include: { jobs: { take: 10, orderBy: { createdAt: "desc" }, include: { artifacts: true, steps: { select: { key: true, status: true, provider: true, model: true, credits: true, startedAt: true, completedAt: true } } } } } });
  if (!project) throw new FactoryError("PROJECT_NOT_FOUND", 404);
  return project;
}
export async function editManifest(userId: string, id: string, expectedVersion: number, input: unknown,configurationInput?:unknown) {
  const manifest = manifestSchema.parse(input);
  return prisma.$transaction(async tx => {
    const project = await tx.videoFactoryProject.findFirst({ where: { id, userId } });
    if (!project) throw new FactoryError("PROJECT_NOT_FOUND", 404);
    const active=project.activeJobId?await tx.videoFactoryJob.findUnique({where:{id:project.activeJobId}}):null;
    if(active && !(active.status==="AWAITING_APPROVAL" && ["SCRIPT_REVIEW","STORYBOARD_REVIEW"].includes(active.stage)))throw new FactoryError("PROJECT_BUSY");
    const oldConfiguration=configurationSchema.parse(JSON.parse(project.configuration)),configuration=configurationInput===undefined?oldConfiguration:configurationSchema.parse(configurationInput);
    if(active && JSON.stringify({...oldConfiguration,styleBible:""})!==JSON.stringify({...configuration,styleBible:""}))throw new FactoryError("ACTIVE_CONFIGURATION_LOCKED");
    const referenced=[...new Set(manifest.chapters.flatMap(c=>c.shots.map(s=>s.assetId).filter((id):id is string=>!!id)))];
    if(referenced.length){const assets=await tx.videoFactoryAsset.count({where:{id:{in:referenced},userId,status:"READY",mimeType:{in:["image/png","image/jpeg","image/webp","video/mp4"]},OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});if(assets!==referenced.length)throw new FactoryError("ASSET_NOT_FOUND",404);}
    if(manifest.chapters.length>chapterCountForEdit(configuration.durationSeconds) || manifest.chapters.some(c=>c.shots.length>configuration.shotsPerChapter))throw new FactoryError("SHOT_BUDGET_EXCEEDED",400);
    if(active){const plan=buildProductionPlan(manifest,configuration,policySchema.parse(JSON.parse(active.policy)));const render=quote(configuration,plan.policy).items[1].credits;if(plan.tasks.reduce((n,t)=>n+t.credits,0)+render>active.credits-active.spentCredits)throw new FactoryError("BUDGET_EXCEEDED",402);await tx.videoFactoryJob.update({where:{id:active.id},data:{checkpoint:JSON.stringify(manifest),plan:JSON.stringify(plan),projectVersion:expectedVersion+1}});}
    const changed = await tx.videoFactoryProject.updateMany({ where: { id, userId, version: expectedVersion, activeJobId: project.activeJobId }, data: { manifest: JSON.stringify(manifest),configuration:JSON.stringify(configuration), version: { increment: 1 } } });
    if (!changed.count) throw new FactoryError("VERSION_CONFLICT");
    await preserveProjectVersion(tx,project,userId);
    return { version: expectedVersion + 1 };
  });
}
export async function estimateProject(userId: string, id: string) {
  const project = await getProject(userId, id), policy = await getPolicy();
  return quote(configurationSchema.parse(JSON.parse(project.configuration)), policy);
}
export async function startProject(userId: string, id: string, key: string, expectedCredits: number) {
  const fingerprint = hash({ id, expectedCredits });
  const existing = await prisma.videoFactoryJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
  if (existing) {
    if (existing.requestHash !== fingerprint) throw new FactoryError("IDEMPOTENCY_CONFLICT");
    return { id: existing.id, status: existing.status };
  }
  const project = await getProject(userId, id), policy = await getPolicy();
  if(process.env.VIDEO_FACTORY_SALES_APPROVED!=="true")throw new FactoryError("OWNER_SALES_APPROVAL_REQUIRED",403);
  if(policy.commercial.mode==="DURATION_RETAIL" && policy.commercial.status!=="APPROVED")throw new FactoryError("TARIFF_NOT_APPROVED",403);
  const configuration = configurationSchema.parse(JSON.parse(project.configuration)), estimate = quote(configuration, policy);
  await validateAdvancedReferences(userId,id,configuration);
  if (estimate.credits !== expectedCredits) throw new FactoryError("COST_CHANGED");
  await approvedProvider(policy.approvedModelId);
  if(configuration.mediaMode==="MULTIMEDIA"){
    const mix=policy.presets[configuration.quality];
    if(mix.imagePercent)await getMediaProvider(policy.providers.image,"IMAGE",policy.fallbackProviders);
    if(mix.videoPercent)await getMediaProvider(policy.providers.video,"VIDEO",policy.fallbackProviders);
    if(configuration.narration)await getMediaProvider(policy.providers.tts,"TTS",policy.fallbackProviders);
    if(configuration.music)await getMediaProvider(policy.providers.music,"MUSIC",policy.fallbackProviders);
    for(const [needed,key,kind] of [[configuration.voiceProfileId,"clone","CLONE"],[configuration.forcedAlignment,"alignment","ALIGNMENT"],[configuration.transcriptionAssetId,"transcription","TRANSCRIPTION"],[configuration.semanticReview,"vision","VISION"]] as const){if(needed)await getMediaProvider(policy.advancedProviders[key],kind);}
    if(configuration.voiceProfileId && (await getMediaProvider(policy.providers.tts,"TTS")).adapter!=="ELEVENLABS_TTS")throw new FactoryError("CUSTOM_VOICE_REQUIRES_ELEVENLABS",400);
  }
  await enforceUserPolicy(userId,estimate.credits,[policy.approvedModelId,...(configuration.mediaMode==="MULTIMEDIA"?Object.values(policy.providers):[])],configuration.durationSeconds>60);
  const userPolicy=await getUserPolicy(userId);
  if (!await rendererReady()) throw new FactoryError("RENDERER_UNAVAILABLE", 503);
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } });
  const limits = await getLimitsForPlan(owner.plan);
  try {
    return await prisma.$transaction(async tx => {
      // Serialize quota authorizations for this account before establishing the read snapshot.
      await tx.videoFactoryStorageQuota.upsert({where:{userId},create:{userId},update:{usedBytes:{increment:0}}});
      if(policy.packageRequired)policy.packageUsage=await claimPackage(tx,userId,configuration.durationSeconds);
      const current = await tx.videoFactoryProject.findFirst({ where: { id, userId, version: project.version } });
      if (!current) throw new FactoryError("VERSION_CONFLICT");
      const [busy, userActive, globalActive] = await Promise.all([
        tx.videoFactoryJob.count({ where: { projectId: id, status: { in: activeStatuses } } }),
        tx.videoFactoryJob.count({ where: { userId, status: { in: activeStatuses } } }),
        tx.videoFactoryJob.count({ where: { status: { in: activeStatuses } } }),
      ]);
      if (busy || userActive >= Math.min(policy.maxActivePerUser,userPolicy?.maxActivePerUser || policy.maxActivePerUser) || globalActive >= policy.maxQueuedJobs) throw new FactoryError("QUEUE_LIMIT", 429);
      if(userPolicy){const day=new Date();day.setHours(0,0,0,0);const prior=await tx.videoFactoryJob.findMany({where:{userId,createdAt:{gte:day}},select:{credits:true,spentCredits:true,settledAt:true}});if(prior.reduce((n,j)=>n+(j.settledAt?j.spentCredits:j.credits),0)+estimate.credits>userPolicy.dailyCredits)throw new FactoryError("DAILY_CREDIT_CAP",402);}
      if (!policy.packageRequired && limits.monthlyVideos !== -1) {
        const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
        const [shortVideos, factoryJobs] = await Promise.all([
          tx.generatedVideo.count({ where: { userId, createdAt: { gte: month } } }),
          tx.videoFactoryJob.count({ where: { userId, createdAt: { gte: month }, status: { notIn: ["FAILED", "CANCELLED"] } } }),
        ]);
        if (shortVideos + factoryJobs >= limits.monthlyVideos) throw new FactoryError("PLAN_VIDEO_LIMIT", 402);
      }
      const jobId = randomUUID();
      const projectLock = await tx.videoFactoryProject.updateMany({ where: { id, userId, version: current.version, activeJobId: null }, data: { activeJobId: jobId } });
      if (!projectLock.count) throw new FactoryError("PROJECT_BUSY");
      const reservation = await reserveLoggedCredits(tx, userId, estimate.credits, { type: "video_factory", requestId: jobId, metadata: { feature: "video_factory", projectId: id, jobId, status: "RESERVED", estimate } },policy.packageRequired?"VIDEO_PACKAGE":"DEFAULT");
      if (!reservation) throw new FactoryError("INSUFFICIENT_CREDITS", 402);
      const hasManifest = manifestSchema.safeParse(JSON.parse(current.manifest)).success;
      const previous = hasManifest ? null : await tx.videoFactoryJob.findFirst({ where: { projectId: id, userId, projectVersion: current.version, status: { in: ["FAILED", "CANCELLED"] }, stage: "SCRIPTING" }, orderBy: { createdAt: "desc" } });
      const saved = previous ? JSON.parse(previous.checkpoint) as Partial<Manifest> : {};
      const chapters = Array.isArray(saved.chapters) ? saved.chapters.map(c => chapterSchema.parse(c)) : [];
      const plan=hasManifest?buildProductionPlan(manifestSchema.parse(JSON.parse(current.manifest)),configuration,policy):null;
      const job = await tx.videoFactoryJob.create({ data: { id: jobId, projectId: id, userId, projectVersion: current.version, requestHash: fingerprint, idempotencyKey: key, policy: JSON.stringify(policy), credits: estimate.credits, stage: hasManifest ? (configuration.mediaMode==="MULTIMEDIA"?"ASSET_GENERATION":"SHOT_RENDERING") : configuration.ideaLab?"PLANNING":"SCRIPTING", cursor: hasManifest ? 0 : chapters.length, checkpoint: hasManifest ? current.manifest : JSON.stringify({ chapters, characters: [] }),plan:JSON.stringify(plan || {}), ...reservation } });
      await tx.auditLog.create({ data: { actorId: userId, action: "video_factory.start", targetId: jobId, metadata: JSON.stringify({ projectId: id, credits: estimate.credits }) } });
      return { id: job.id, status: job.status };
    });
  } catch (error) {
    const winner = await prisma.videoFactoryJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
    if (winner?.requestHash === fingerprint) return { id: winner.id, status: winner.status };
    throw error;
  }
}
/** Idempotent settlement refunds only unused authorization to the original payer. */
export async function settleJob(tx: Prisma.TransactionClient, id: string, status: string, errorCode: string | null = null) {
  let job = await tx.videoFactoryJob.findUniqueOrThrow({ where: { id } });
  if (job.settledAt) return;
  if(status==="DELIVERED" && policySchema.parse(JSON.parse(job.policy)).commercial.mode==="DURATION_RETAIL"){const balance=job.credits-job.spentCredits;await tx.videoFactoryStep.upsert({where:{jobId_key:{jobId:id,key:"retail-delivery"}},create:{jobId:id,key:"retail-delivery",status:"COMPLETED",inputHash:hash(job.policy),credits:balance,completedAt:new Date()},update:{}});job={...job,spentCredits:job.credits};}
  const claim = await tx.videoFactoryJob.updateMany({ where: { id, settledAt: null }, data: { status, errorCode,spentCredits:job.spentCredits, settledAt: new Date(), leaseToken: null, leaseUntil: null } });
  if (!claim.count) return;
  await tx.videoFactoryProject.updateMany({ where: { id: job.projectId, activeJobId: job.id }, data: { activeJobId: null } });
  const {charged,refund}=settlementCredits(status,job.credits,job.spentCredits);
  if(charged!==job.spentCredits)await tx.videoFactoryJob.update({where:{id},data:{spentCredits:charged}});
  const external=await tx.videoFactoryStep.findMany({where:{jobId:id,provider:{not:null},credits:{gt:0}},select:{costUsd:true}});
  if(external.length && external.every(s=>s.costUsd!==null))await tx.videoFactoryJob.update({where:{id},data:{actualCostUsd:external.reduce((sum,s)=>sum+(s.costUsd || 0),0)}});
  if (refund) await refundLoggedReservation(tx, { ...job, credits: refund, mirroredAi: Math.max(0, job.mirroredAi - charged) }, { feature: "video_factory", jobId: id, spentCredits: charged, refundedCredits: refund }, (await tx.usageLog.findUniqueOrThrow({where:{id:job.usageLogId},select:{type:true}})).type);
  await tx.usageLog.update({ where: { id: job.usageLogId }, data: { metadata: JSON.stringify({ feature: "video_factory", jobId: id, status: "SETTLED", reservedCredits: job.credits, spentCredits: charged, attemptedCredits:job.spentCredits, refundedCredits: refund, providerCostUsd: null }) } });
}
export async function controlJob(actorId: string, projectId: string, action: "pause" | "resume" | "cancel" | "approve", admin = false) {
  return prisma.$transaction(async tx => {
    const job = await tx.videoFactoryJob.findFirst({ where: { projectId, ...(admin ? {} : { userId: actorId }), status: { in: activeStatuses } }, orderBy: { createdAt: "desc" } });
    if (!job) throw new FactoryError("ACTIVE_JOB_NOT_FOUND", 404);
    let status: string;
    if (action === "cancel") status = job.status === "RUNNING" || job.status === "PAUSING" ? "CANCELLING" : "CANCELLED";
    else if (action === "pause" && ["QUEUED", "RUNNING"].includes(job.status)) status = job.status === "RUNNING" ? "PAUSING" : "PAUSED";
    else if (action === "resume" && job.status === "PAUSED") status = "QUEUED";
    else if (action === "approve" && job.status === "AWAITING_APPROVAL") status = job.stage==="SCRIPT_REVIEW"?"AWAITING_APPROVAL":"QUEUED";
    else throw new FactoryError("INVALID_TRANSITION");
    const nextStage=action==="approve" && job.stage==="SCRIPT_REVIEW"?"STORYBOARD_REVIEW":action==="approve" && job.stage==="STORYBOARD_REVIEW"?"ASSET_GENERATION":job.stage;
    await tx.videoFactoryJob.update({ where: { id: job.id }, data: { status,stage:nextStage,nextAttemptAt:null } });
    if(action==="approve")await tx.videoFactoryApproval.create({data:{projectId:job.projectId,jobId:job.id,actorId,stage:job.stage,version:job.projectVersion,decision:"APPROVED"}});
    if (status === "CANCELLED") await settleJob(tx, job.id, status);
    await tx.auditLog.create({ data: { actorId, action: `video_factory.${action}`, targetId: job.id, metadata: JSON.stringify({ previousStatus: job.status, status, admin }) } });
    return { id: job.id, status };
  });
}
export async function adminOverview(page = 0) {
  const [jobs, groups, policy, models] = await Promise.all([
    prisma.videoFactoryJob.findMany({ take: 50, skip: page * 50, orderBy: { createdAt: "desc" }, select: { id: true, projectId: true, userId: true, status: true, stage: true, cursor: true, credits: true, spentCredits: true, errorCode: true, createdAt: true, leaseUntil: true, project: { select: { title: true } } } }),
    prisma.videoFactoryJob.groupBy({ by: ["status"], _count: true, _sum: { spentCredits: true } }),
    getPolicy(),
    import("@/lib/ai/router").then(async ({ getEnabledProviders }) => { await (await import("@/lib/ai/providerConfig")).refreshDisabledProviders(); return getEnabledProviders().map(p => ({ id: p.id, name: p.name, model: p.model })); }),
  ]);
  return { jobs, groups, policy: policySchema.parse(policy), models, rendererReady: await rendererReady(), financialNote: "Credits are actual ledger usage; provider costs/revenue/margin are not measured." };
}
export function checkpointManifest(value: string): Manifest { return manifestSchema.parse(JSON.parse(value)); }
function chapterCountForEdit(seconds:number){return Math.max(1,Math.ceil(seconds/300));}

