import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getPolicy } from "./config";
import { chapterCount, configurationSchema, FactoryError, manifestSchema, policySchema, timeline, type Manifest } from "./domain";
import { approvedProvider, generateChapter,generateIdeas,prepareCreativeRoles } from "./providers";
import { assemble, renderShot } from "./render";
import { hash, settleJob } from "./service";
import { isFeatureEnabled } from "@/lib/utils/featureToggles";
import { featureAccessExpired, teamFeatureExpiry } from "@/lib/subscriptions/access";
import { buildProductionPlan, productionPlanSchema } from "./production";
import { produceMedia } from "./mediaWorker";
import { agentSettings,enforceRole } from "./resources";
import {accountJobStorage} from "./assets";
import {checkContinuity,inspectRenderedShot} from "./quality";
import {reviewSemanticShot} from "./semanticWorker";
import {requireVoiceConsent} from "./voiceConsent";

/** Sweep uncertain leases without ever repeating an ambiguous paid provider request. */
export async function sweepJobs() {
  const stale = await prisma.videoFactoryJob.findMany({ where: { status: { in: ["RUNNING", "PAUSING", "CANCELLING"] }, leaseUntil: { lt: new Date() } }, take: 50 });
  for (const job of stale) await prisma.$transaction(async tx => {
    const changed = await tx.videoFactoryJob.updateMany({ where: { id: job.id, leaseToken: job.leaseToken, leaseUntil: { lt: new Date() } }, data: { leaseToken: null, leaseUntil: null } });
    if (!changed.count) return;
    if (job.status === "CANCELLING") await settleJob(tx, job.id, "CANCELLED");
    else if (["PLANNING","SCRIPTING"].includes(job.stage) || (["ASSET_GENERATION","SEMANTIC_QC"].includes(job.stage) && await tx.videoFactoryStep.count({where:{jobId:job.id,status:"SUBMITTED",providerJobId:null}}))) await settleJob(tx, job.id, "FAILED", "PROVIDER_OUTCOME_UNCERTAIN");
    else await tx.videoFactoryJob.update({ where: { id: job.id }, data: { status: job.status === "PAUSING" ? "PAUSED" : "QUEUED" } });
  });
}
/** One bounded checkpoint per tick. No hour-long production runs in an HTTP request. */
export async function processFactoryTick() {
  await sweepJobs();
  const livePolicy=await getPolicy();
  if(livePolicy.commercial.mode==="DURATION_RETAIL" && livePolicy.commercial.status!=="APPROVED")return null;
  if (process.env.VIDEO_FACTORY_SALES_APPROVED!=="true" || !livePolicy.enabled || !await isFeatureEnabled("video")) return null;
  const queued = await prisma.videoFactoryJob.findFirst({ where: { status: "QUEUED", OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:new Date()}}] }, orderBy: [{priority:"desc"},{createdAt:"asc"}], include: { project: true } });
  if (!queued) return null;
  const token = randomUUID(), leaseUntil = new Date(Date.now() + 180000);
  const claimed = await prisma.$transaction(async tx=>{
    await tx.videoFactoryResource.upsert({where:{id:"scheduler-global"},create:{id:"scheduler-global",kind:"INTERNAL",name:"Worker slot lock",configuration:"{}"},update:{version:{increment:1}}});
    if(await tx.videoFactoryJob.count({where:{status:{in:["RUNNING","PAUSING","CANCELLING"]},leaseUntil:{gt:new Date()}}})>=livePolicy.maxWorkers)return {count:0};
    return tx.videoFactoryJob.updateMany({ where: { id: queued.id, status: "QUEUED", leaseToken: null }, data: { status: "RUNNING", leaseToken: token, leaseUntil } });
  });
  if (!claimed.count) return null;
  const owner = await prisma.user.findUnique({ where: { id: queued.userId }, include: { teamMembership: { include: { team: { include: { owner: { select: { planExpiry: true } } } } } } } });
  const packageUsage=policySchema.parse(JSON.parse(queued.policy)).packageUsage;
  const paidPackage=packageUsage?await prisma.payment.findFirst({where:{id:packageUsage.paymentId,userId:queued.userId,status:"SUCCESS"},select:{id:true}}):null;
  if (!owner || owner.isBlocked || owner.trialLimited || (!paidPackage && featureAccessExpired(owner, teamFeatureExpiry(owner.teamMembership?.team))) || (packageUsage && !paidPackage)) {
    await prisma.$transaction(tx => settleJob(tx, queued.id, "FAILED", "ACCOUNT_ACCESS_REVOKED"));
    return queued.id;
  }
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 120000);
  let polling = false;
  const monitor = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const current = await prisma.videoFactoryJob.findUnique({ where: { id: queued.id }, select: { status: true, leaseToken: true } });
      if (current?.leaseToken !== token || current.status !== "RUNNING") controller.abort();
    } catch { controller.abort(); } finally { polling = false; }
  }, 1500);
  try {
    const configuration = configurationSchema.parse(JSON.parse(queued.project.configuration)), policy = policySchema.parse(JSON.parse(queued.policy));
    if(configuration.voiceProfileId)await requireVoiceConsent(queued.userId,configuration.voiceProfileId,queued.projectId);
    await enforceRole("producer","plan",await prisma.videoFactoryStep.count({where:{jobId:queued.id}}),queued.credits);
    let manifest: Manifest = ["SCRIPTING","PLANNING"].includes(queued.stage) ? { chapters: [], characters: [] } : manifestSchema.parse(JSON.parse(queued.checkpoint));
    if(queued.stage === "PLANNING"){
      const researcher=await enforceRole("researcher","research",0,policy.creditsPerResearch!);
      const researchId=policy.commercial.mode==="DURATION_RETAIL"?policy.commercial.textModels.researcher:policy.approvedModelId;
      if(![livePolicy.approvedModelId,...livePolicy.approvedTextModelIds].includes(researchId))throw new FactoryError("AGENT_MODEL_NOT_APPROVED",403);
      const researchProvider=await approvedProvider(researchId);
      if(researcher?.modelId && ![researchProvider.id,researchProvider.model].includes(researcher.modelId))throw new FactoryError("ROLE_MODEL_NOT_APPROVED",403);
      const slice=policy.creditsPerResearch!;
      await prisma.$transaction(async tx=>{const lock=await tx.videoFactoryJob.updateMany({where:{id:queued.id,leaseToken:token,status:"RUNNING",spentCredits:{lte:queued.credits-slice}},data:{spentCredits:{increment:slice}}});if(!lock.count)throw new FactoryError("BUDGET_OR_LEASE_EXCEEDED");await tx.videoFactoryStep.create({data:{jobId:queued.id,key:"idea-lab",status:"SUBMITTED",inputHash:hash(queued.project.brief),credits:slice,provider:researchId}});});
      const ideas=await generateIdeas(researchId,{brief:queued.project.brief,language:configuration.language,sources:JSON.parse(queued.project.research)},controller.signal,researchProvider);
      await prisma.$transaction(async tx=>{const current=await tx.videoFactoryJob.findUniqueOrThrow({where:{id:queued.id}});if(current.leaseToken!==token)throw new FactoryError("STALE_WORKER");await tx.videoFactoryProject.update({where:{id:queued.projectId},data:{planning:JSON.stringify(ideas.value)}});await tx.videoFactoryStep.update({where:{jobId_key:{jobId:queued.id,key:"idea-lab"}},data:{status:"COMPLETED",output:JSON.stringify(ideas.value),usage:JSON.stringify(ideas.usage),model:ideas.model,completedAt:new Date()}});const status=current.status==="CANCELLING"?"CANCELLED":current.status==="PAUSING"?"PAUSED":"QUEUED";await tx.videoFactoryJob.update({where:{id:queued.id},data:{stage:"SCRIPTING",status,leaseToken:null,leaseUntil:null}});if(status==="CANCELLED")await settleJob(tx,queued.id,status);});
    } else if (queued.stage === "SCRIPTING") {
      const saved = JSON.parse(queued.checkpoint) as Partial<Manifest>;
      manifest = { chapters: saved.chapters || [], characters: saved.characters || [] };
      const stepKey = `chapter-${queued.cursor}`, slice = policy.creditsPerChapter!;
      const agent=await agentSettings("writer");
      if(agent && (!agent.allowedTools.includes("write") || queued.cursor>=agent.maxSteps || slice>agent.budgetCap))throw new FactoryError("AGENT_POLICY_DENIED",403);
      const modelId=agent?.modelId || (policy.commercial.mode==="DURATION_RETAIL"?policy.commercial.textModels.writer:policy.approvedModelId);
      if(![livePolicy.approvedModelId,...livePolicy.approvedTextModelIds].includes(modelId))throw new FactoryError("AGENT_MODEL_NOT_APPROVED",403);
      const provider = await approvedProvider(modelId);
      const creativeInstructions=await prepareCreativeRoles(provider);
      // Debit the authorized slice BEFORE submission. An uncertain paid call is never retried automatically.
      await prisma.$transaction(async tx => {
        const lock = await tx.videoFactoryJob.updateMany({ where: { id: queued.id, leaseToken: token, status: "RUNNING", spentCredits: { lte: queued.credits - slice } }, data: { spentCredits: { increment: slice } } });
        if (!lock.count) throw new FactoryError("JOB_NO_LONGER_ACTIVE");
        await tx.videoFactoryStep.create({ data: { jobId: queued.id, key: stepKey, status: "SUBMITTED", credits: slice, inputHash: hash({ version: queued.projectVersion, cursor: queued.cursor, brief: queued.project.brief,creativeInstructions }), promptVersion:agent?.version,provider: modelId } });
      });
      const generated = await generateChapter(policy.approvedModelId, { brief: queued.project.brief, title: queued.project.title, configuration,approvedPlan:JSON.parse(queued.project.planning),sources:JSON.parse(queued.project.research),chapterIndex: queued.cursor, chapterCount: chapterCount(configuration.durationSeconds), chapterIdPrefix: `c${queued.cursor}-`, priorContinuity: manifest.chapters.map(c => c.continuity) }, agent?AbortSignal.any([controller.signal,AbortSignal.timeout(agent.timeoutSeconds*1000)]):controller.signal, provider,creativeInstructions);
      if(generated.chapter.shots.length>configuration.shotsPerChapter)throw new FactoryError("SHOT_BUDGET_EXCEEDED",502);
      // Canonical IDs are internally assigned, independent of model-controlled identifiers.
      generated.chapter.shots = generated.chapter.shots.map((s, i) => ({ ...s, id: `c${queued.cursor}-s${i}` }));
      manifest.chapters.push(generated.chapter);
      const complete = manifest.chapters.length === chapterCount(configuration.durationSeconds);
      await prisma.$transaction(async tx => {
        const current = await tx.videoFactoryJob.findUniqueOrThrow({ where: { id: queued.id } });
        if (current.leaseToken !== token || !current.leaseUntil || current.leaseUntil < new Date()) throw new FactoryError("STALE_WORKER");
        await tx.videoFactoryStep.update({ where: { jobId_key: { jobId: queued.id, key: stepKey } }, data: { status: "COMPLETED", output: JSON.stringify({ chapter: generated.chapter, usage: generated.usage }), model: generated.model, completedAt: new Date() } });
        if (complete) await tx.videoFactoryProject.update({ where: { id: queued.projectId }, data: { manifest: JSON.stringify(manifest) } });
        if(complete){const findings=checkContinuity(manifest,configuration);await tx.videoFactoryQualityReport.create({data:{jobId:queued.id,kind:"CONTINUITY",status:findings.length?"WARNING":"PASSED",findings:JSON.stringify(findings)}});}
        const status = current.status === "CANCELLING" ? "CANCELLED" : current.status === "PAUSING" ? "PAUSED" : complete && configuration.mode !== "AUTOPILOT" ? "AWAITING_APPROVAL" : "QUEUED";
        const plan=complete?buildProductionPlan(manifest,configuration,policy):null;
        const nextStage=configuration.mediaMode==="MULTIMEDIA"?(status==="AWAITING_APPROVAL"?"SCRIPT_REVIEW":"ASSET_GENERATION"):"SHOT_RENDERING";
        await tx.videoFactoryJob.update({ where: { id: queued.id }, data: { status, stage: complete ? nextStage : "SCRIPTING", cursor: complete ? 0 : queued.cursor + 1, checkpoint: JSON.stringify(manifest),...(plan?{plan:JSON.stringify(plan)}:{}), leaseToken: null, leaseUntil: null } });
        if (status === "CANCELLED") await settleJob(tx, queued.id, status);
      });
    } else if(queued.stage === "ASSET_GENERATION") {
      const savedPlan=productionPlanSchema.parse(JSON.parse(queued.plan));
      const result=savedPlan.tasks.length?await produceMedia({...queued,leaseToken:token},controller.signal):{pending:false,plan:savedPlan,retryable:false};
      await prisma.$transaction(async tx=>{
        const current=await tx.videoFactoryJob.findUniqueOrThrow({where:{id:queued.id}});if(current.leaseToken!==token || !current.leaseUntil || current.leaseUntil<new Date())throw new FactoryError("STALE_WORKER");
        const next=result.pending?queued.cursor:queued.cursor+1,complete=next>=result.plan.tasks.length;
        if(result.retryable && current.attempts>=policy.maxRetries)throw new FactoryError("PROVIDER_RETRY_LIMIT");
        const status=current.status==="CANCELLING"?"CANCELLED":current.status==="PAUSING"?"PAUSED":"QUEUED";
        await tx.videoFactoryJob.update({where:{id:queued.id},data:{plan:JSON.stringify(result.plan),cursor:complete?0:next,stage:complete?"SHOT_RENDERING":"ASSET_GENERATION",status,leaseToken:null,leaseUntil:null,nextAttemptAt:result.pending?new Date(Date.now()+(result.retryable?Math.min(60000,1000*2**current.attempts)+Math.floor(Math.random()*500):10000)):null,attempts:result.retryable?{increment:1}:0}});
        if(status==="CANCELLED")await settleJob(tx,queued.id,status);
      });
    } else if(queued.stage==="SEMANTIC_QC"){
      const result=await reviewSemanticShot({...queued,leaseToken:token},manifest,configuration,policy,JSON.parse(queued.project.research),controller.signal);
      if(result.findings.some(f=>f.severity==="ERROR"))throw new FactoryError("SEMANTIC_REPAIR_REQUIRED",422);
      await prisma.$transaction(async tx=>{const current=await tx.videoFactoryJob.findUniqueOrThrow({where:{id:queued.id}});if(current.leaseToken!==token)throw new FactoryError("STALE_WORKER");const complete=queued.cursor+1>=timeline(manifest,configuration.durationSeconds).shots.length,status=current.status==="CANCELLING"?"CANCELLED":current.status==="PAUSING"?"PAUSED":"QUEUED";await tx.videoFactoryJob.update({where:{id:queued.id},data:{cursor:complete?0:queued.cursor+1,stage:complete?"ASSEMBLY":"SEMANTIC_QC",status,leaseToken:null,leaseUntil:null}});if(status==="CANCELLED")await settleJob(tx,queued.id,status);});
    } else {
      const edit = timeline(manifest, configuration.durationSeconds);
      const rendered = queued.stage === "SHOT_RENDERING";
      await enforceRole(rendered?"motion":"editor","render",rendered?queued.cursor:0,Math.ceil(configuration.durationSeconds/60)*policy.creditsPerRenderMinute!);
      await enforceRole("critic","qc",rendered?queued.cursor:0,0);
      const parsedPlan=productionPlanSchema.safeParse(JSON.parse(queued.plan));
      const renderResult=rendered?await renderShot(queued.id,queued.cursor,manifest,configuration,controller.signal,parsedPlan.success?parsedPlan.data:undefined,queued.userId):null;
      const artifacts = rendered ? null : await assemble(queued.id, manifest, configuration, controller.signal,parsedPlan.success?parsedPlan.data:undefined,queued.userId);
      await accountJobStorage(queued.id,queued.userId,policy.maxStorageBytesPerUser);
      if(rendered)await inspectRenderedShot(queued.id,queued.cursor,manifest,configuration,controller.signal);
      await prisma.$transaction(async tx => {
        const current = await tx.videoFactoryJob.findUniqueOrThrow({ where: { id: queued.id } });
        if (current.leaseToken !== token || !current.leaseUntil || current.leaseUntil < new Date()) throw new FactoryError("STALE_WORKER");
        const next = queued.cursor + 1;
        await tx.videoFactoryStep.upsert({ where: { jobId_key: { jobId: queued.id, key: rendered ? `shot-${queued.cursor}` : "assembly_qc" } }, create: { jobId: queued.id, key: rendered ? `shot-${queued.cursor}` : "assembly_qc", status: "COMPLETED", inputHash: renderResult?.signature || hash(edit),output:rendered?JSON.stringify({fileName:`shot-${queued.cursor}.mp4`,reused:renderResult?.reused || false}):null, completedAt: new Date() }, update: { status: "COMPLETED", completedAt: new Date() } });
        const renderCost = rendered && !renderResult?.reused ? Math.floor(next * Math.ceil(configuration.durationSeconds / 60) * policy.creditsPerRenderMinute! / edit.shots.length) - Math.floor(queued.cursor * Math.ceil(configuration.durationSeconds / 60) * policy.creditsPerRenderMinute! / edit.shots.length) : 0;
        const status = current.status === "CANCELLING" ? "CANCELLED" : current.status === "PAUSING" ? "PAUSED" : artifacts ? "DELIVERED" : "QUEUED";
        const semantic=rendered && next===edit.shots.length && configuration.semanticReview;
        await tx.videoFactoryJob.update({ where: { id: queued.id }, data: { status, cursor: semantic?0:rendered ? next : queued.cursor, stage: rendered && next === edit.shots.length ? semantic?"SEMANTIC_QC":"ASSEMBLY" : queued.stage, spentCredits: { increment: renderCost }, leaseToken: null, leaseUntil: null,attempts:0 } });
        if (artifacts) for (const artifact of artifacts) await tx.videoFactoryArtifact.upsert({ where: { jobId_kind: { jobId: queued.id, kind: artifact.kind } }, create: { jobId: queued.id, ...artifact }, update: artifact });
        if (["DELIVERED", "CANCELLED"].includes(status)) await settleJob(tx, queued.id, status);
      });
    }
  } catch (error) {
    await prisma.$transaction(async tx => {
      const current = await tx.videoFactoryJob.findUniqueOrThrow({ where: { id: queued.id } });
      if (current.leaseToken !== token) return;
      if (current.status === "CANCELLING") await settleJob(tx, queued.id, "CANCELLED");
      else if (current.status === "PAUSING" && queued.stage !== "SCRIPTING") await tx.videoFactoryJob.update({ where: { id: queued.id }, data: { status: "PAUSED", leaseToken: null, leaseUntil: null } });
      else if(error instanceof FactoryError && ["TEXT_PROVIDER_BUSY","TEXT_PROVIDER_RATE_LIMIT"].includes(error.code))await tx.videoFactoryJob.update({where:{id:queued.id},data:{status:"QUEUED",nextAttemptAt:new Date(Date.now()+60000),leaseToken:null,leaseUntil:null}});
      else if(["SHOT_RENDERING","ASSEMBLY"].includes(queued.stage) && current.attempts<policySchema.parse(JSON.parse(current.policy)).maxRetries && !controller.signal.aborted){await tx.videoFactoryJob.update({where:{id:queued.id},data:{status:"QUEUED",attempts:{increment:1},nextAttemptAt:new Date(Date.now()+1000*2**current.attempts),leaseToken:null,leaseUntil:null,errorCode:error instanceof FactoryError?error.code:"LOCAL_RENDER_RETRY"}});}
      else await settleJob(tx, queued.id, "FAILED", error instanceof FactoryError ? error.code : "PRODUCTION_STEP_FAILED");
    });
  } finally { clearInterval(monitor); clearTimeout(timeout); }
  return queued.id;
}


