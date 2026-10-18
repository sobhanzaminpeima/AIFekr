import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
vi.hoisted(() => {
  process.env.VIDEO_FACTORY_SALES_APPROVED="true";
  process.env.DATABASE_URL = `file:${process.cwd().replace(/\\/g, "/")}/tmp/video-factory-integration-${process.pid}.db`;
  process.env.JWT_SECRET ||= "video-factory-isolated-test-secret-32-characters";
  process.env.VIDEO_FACTORY_STORAGE_DIR=`${process.cwd().replace(/\\/g,"/")}/tmp/vf-integration-storage-${process.pid}`;
});
vi.mock("./render",async original => ({...await original<typeof import("./render")>(), rendererReady: vi.fn(async () => true), renderShot: vi.fn(async () => {}), assemble: vi.fn(async () => [{ kind: "manifest", fileName: "manifest.json", bytes: 100 }]) }));
vi.mock("./assets",async original=>({...await original<typeof import("./assets")>(),accountJobStorage:vi.fn(async()=>0)}));
vi.mock("./quality",async original=>({...await original<typeof import("./quality")>(),inspectRenderedShot:vi.fn(async()=>({status:"PASSED",findings:[]}))}));
vi.mock("./providers", () => ({ prepareCreativeRoles:vi.fn(async()=>"TEST ONLY"), approvedProvider: vi.fn(async () => ({ id: "test-only", model: "test-only" })),generateIdeas:vi.fn(async()=>({value:{titles:["TEST A","TEST B"],hooks:["TEST A","TEST B"],outline:["Synthetic outline"],audienceStrategy:"Test only",evidence:[],uncertainties:["Synthetic test"]},provider:"test-only",model:"test-only",usage:null})), generateChapter: vi.fn(async () => ({ chapter: { title: "Synthetic chapter", continuity: "test-only", shots: [{ id: "s1", title: "Synthetic shot", narration: "روایت", visualPrompt: "TEST ONLY" }] }, provider: "test-only", model: "test-only", usage: null })) }));
import { prisma } from "@/lib/db/prisma";
import { createProject, getProject, startProject, controlJob, settleJob, editManifest } from "./service";
import { savePolicy } from "./config";
import { processFactoryTick, sweepJobs } from "./worker";
import { generateChapter } from "./providers";
import { configurationSchema } from "./domain";
import { POST as projectAction, GET as projectDetail } from "@/app/api/video-factory/projects/[id]/route";
import { GET as adminGet } from "@/app/api/admin/video-factory/route";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/auth/jwt";
import {saveMediaProvider,getMediaProvider} from "./registry";
import {saveResource,rollbackResource} from "./resources";
import {acceptFactoryWebhook} from "./webhooks";
import {createHmac} from "node:crypto";
import {quote,manifestSchema} from "./domain";
import {uploadAsset,ownedAsset} from "./assets";
import {restoreProjectVersion} from "./versions";
import {schedulePublish,cancelPublishing} from "./publishing";
import {POST as adminControl} from "@/app/api/admin/video-factory/control/route";
import {saveAsset} from "./assets";
import {createVoiceConsent,revokeVoiceConsent,requireVoiceConsent} from "./voiceConsent";
import {renderShot} from "./render";

describe("Video Factory isolated durable workflow", () => {
  let userId: string, otherId: string;
  const config = configurationSchema.parse({ durationSeconds: 30, language: "fa", ratio: "16:9", mode: "REVIEW_GATES", quality: "SMART", budgetCap: 100 });
  const request = (url: string, id?: string, data?: unknown) => new NextRequest(`http://localhost${url}`, { method: data ? "POST" : "GET", headers: { ...(id ? { cookie: `token=${signToken({ userId: id, role: "USER", plan: "FREE" })}` } : {}), "content-type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}) });
  beforeAll(async () => {
    mkdirSync(path.join(process.cwd(), "tmp"), { recursive: true });
    const sql = execFileSync(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { env: process.env, stdio: "pipe", timeout: 60000 }).toString();
    const database = new Database(process.env.DATABASE_URL!.slice(5)); database.exec(sql);
    // Exercise the actual additive migration, not just the current ORM schema.
    for (const table of ["VideoFactoryAsset","VideoFactoryStorageQuota","VideoFactoryProvider","VideoFactoryResource","VideoFactoryConfigVersion","VideoFactoryApproval","VideoFactoryQualityReport","VideoFactoryPublishJob","VideoFactoryChannel","VideoFactoryWebhookEvent","VideoFactoryArtifact", "VideoFactoryStep", "VideoFactoryJob", "VideoFactoryVersion", "VideoFactoryProject"]) database.exec(`DROP TABLE "${table}"`);
    database.exec(readFileSync("prisma/migrations/20261016090000_video_factory/migration.sql", "utf8"));
    database.exec(readFileSync("prisma/migrations/20261016120000_video_factory_multimedia/migration.sql", "utf8"));database.close();
    userId = (await prisma.user.create({ data: { email: `vf-${Date.now()}@test.invalid`, plan: "PRO", credits: 1000, mediaCredits: 1000 } })).id;
    otherId = (await prisma.user.create({ data: { email: `vf-other-${Date.now()}@test.invalid`, credits: 1000 } })).id;
    await savePolicy(userId, { enabled: true, longFormEnabled: true, approvedModelId: "test-only", creditsPerChapter: 3, creditsPerRenderMinute: 2 });
    await prisma.siteSetting.upsert({where:{key:"planLimits"},create:{key:"planLimits",value:JSON.stringify({PRO:{monthlyVideos:-1}})},update:{value:JSON.stringify({PRO:{monthlyVideos:-1}})}});
  }, 90000);
  beforeEach(async() => { vi.clearAllMocks();vi.unstubAllGlobals();await savePolicy(userId,{enabled:true,longFormEnabled:true,approvedModelId:"test-only",creditsPerChapter:3,creditsPerRenderMinute:2}); });
  afterAll(async () => { await prisma.$disconnect(); const file = process.env.DATABASE_URL!.slice(5); rmSync(file, { force: true }); rmSync(file + "-journal", { force: true });const storage=path.resolve(process.env.VIDEO_FACTORY_STORAGE_DIR!);if(!storage.startsWith(path.resolve("tmp")+path.sep))throw Error("Unexpected test storage path");rmSync(storage,{recursive:true,force:true}); });
  const project = () => createProject(userId, { title: "Test-only film", brief: "Synthetic brief for isolated tests", configuration: config });
  it("settles the retail film price through existing AI Credits and refunds failed work to the same wallet",async()=>{
    await prisma.package.create({data:{planCode:"PRO_USD",name:"TEST ONLY rate",nameEn:"TEST ONLY",price:0,priceUsd:4900,credits:2000,duration:30,features:"",isActive:true}});
    const owner=await prisma.user.create({data:{email:`retail-${Date.now()}@test.invalid`,plan:"PRO",credits:10000,aiCredits:10000,mediaCredits:333}});
    const retail=await savePolicy(userId,{enabled:true,longFormEnabled:true,approvedModelId:"test-only",creditsPerChapter:3,creditsPerRenderMinute:2,commercial:{mode:"DURATION_RETAIL",status:"APPROVED",textModels:{writer:"test-only",researcher:"test-only"}}});
    const c=configurationSchema.parse({...config,durationSeconds:600,mode:"AUTOPILOT",budgetCap:10000,shotsPerChapter:1});
    const p=await createProject(owner.id,{title:"TEST ONLY retail film",brief:"Synthetic retail settlement without real generation",configuration:c});
    const job=await startProject(owner.id,p.id,"retail-test-authorized",2409);for(let i=0;i<5;i++)await processFactoryTick();
    const done=await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});expect(done.status).toBe("DELIVERED");expect(done.spentCredits).toBe(2409);expect(retail.commercial.creditRate).toBeNull();
    let wallet=await prisma.user.findUniqueOrThrow({where:{id:owner.id}});expect(wallet.credits).toBe(7591);expect(wallet.aiCredits).toBe(7591);expect(wallet.mediaCredits).toBe(333);
    const failed=await createProject(owner.id,{title:"TEST ONLY partial retail",brief:"Synthetic cancelled retail settlement",configuration:c});await startProject(owner.id,failed.id,"retail-partial-cancel",2409);await processFactoryTick();await controlJob(owner.id,failed.id,"cancel");wallet=await prisma.user.findUniqueOrThrow({where:{id:owner.id}});expect(wallet.credits).toBe(7588);expect(wallet.aiCredits).toBe(7588);expect(wallet.mediaCredits).toBe(333);
  });
  it("enforces owner approval before sales even when an admin attempts to enable the module",async()=>{
    process.env.VIDEO_FACTORY_SALES_APPROVED="false";try{await expect(savePolicy(userId,{enabled:true})).rejects.toThrow("OWNER_SALES_APPROVAL_REQUIRED");const p=await project();await expect(startProject(userId,p.id,"sales-locked-test",5)).rejects.toThrow("OWNER_SALES_APPROVAL_REQUIRED");expect(await processFactoryTick()).toBeNull();}finally{process.env.VIDEO_FACTORY_SALES_APPROVED="true";}
  });
  it("accepts the actual local Host origin while rejecting cross-site writes",async()=>{
    const p=await project(),body={action:"configuration",expectedVersion:0,configuration:config};
    const local=request(`/api/video-factory/projects/${p.id}`,userId,body);local.headers.set("host","127.0.0.1:3147");local.headers.set("origin","http://127.0.0.1:3147");expect((await projectAction(local,{params:{id:p.id}})).status).toBe(200);
    const cross=request(`/api/video-factory/projects/${p.id}`,userId,{...body,expectedVersion:1});cross.headers.set("host","127.0.0.1:3147");cross.headers.set("origin","https://untrusted.invalid");expect((await projectAction(cross,{params:{id:p.id}})).status).toBe(403);
  });
  it("isolates project reads, action routes and admin access", async () => {
    const p = await project();
    await expect(getProject(otherId, p.id)).rejects.toThrow("PROJECT_NOT_FOUND");
    expect((await projectDetail(request(`/api/video-factory/projects/${p.id}`), { params: { id: p.id } })).status).toBe(401);
    expect((await projectDetail(request(`/api/video-factory/projects/${p.id}`, otherId), { params: { id: p.id } })).status).toBe(404);
    expect((await adminGet(request("/api/admin/video-factory", userId))).status).toBe(401);
    expect((await projectAction(request(`/api/video-factory/projects/${p.id}`, userId, { action: "estimate" }), { params: { id: p.id } })).status).toBe(200);
  });
  it("reserves once on replay and refunds cancellation exactly once", async () => {
    const p = await project(), before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const a = await startProject(userId, p.id, "replay-key-01", 5), b = await startProject(userId, p.id, "replay-key-01", 5);
    expect(a.id).toBe(b.id); expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(before.credits - 5);
    await expect(startProject(userId, p.id, "replay-key-01", 6)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await controlJob(userId, p.id, "cancel"); await prisma.$transaction(tx => settleJob(tx, a.id, "CANCELLED"));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(before.credits);
    expect(await prisma.usageLog.count({ where: { requestId: `${(await prisma.videoFactoryJob.findUniqueOrThrow({ where: { id: a.id } })).usageLogId}:refund` } })).toBe(1);
  });
  it("checkpoints writing, gates approval, resumes local steps and delivers", async () => {
    const p = await project(), job = await startProject(userId, p.id, "complete-key-01", 5);
    await processFactoryTick();
    expect((await getProject(userId, p.id)).jobs[0].status).toBe("AWAITING_APPROVAL");
    expect(vi.mocked(generateChapter)).toHaveBeenCalledTimes(1);
    await controlJob(userId, p.id, "approve"); await controlJob(userId, p.id, "pause");
    expect(await processFactoryTick()).toBe(null);
    await controlJob(userId, p.id, "resume"); await processFactoryTick(); await processFactoryTick();
    const done = await prisma.videoFactoryJob.findUniqueOrThrow({ where: { id: job.id }, include: { artifacts: true } });
    expect(done.status).toBe("DELIVERED"); expect(done.spentCredits).toBe(5); expect(done.artifacts.length).toBe(1);
    const manifest = JSON.parse((await getProject(userId, p.id)).manifest);
    await editManifest(userId, p.id, 0, manifest);
    await expect(editManifest(userId, p.id, 0, manifest)).rejects.toThrow("VERSION_CONFLICT");
  });
  it("does not repeat an ambiguous paid call after a worker restart", async () => {
    const p = await project(), job = await startProject(userId, p.id, "stale-key-01", 5);
    await prisma.videoFactoryJob.update({ where: { id: job.id }, data: { status: "RUNNING", leaseToken: "dead-worker", leaseUntil: new Date(0), spentCredits: 3 } });
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits;
    await sweepJobs(); await sweepJobs();
    const after = await prisma.videoFactoryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("FAILED"); expect(after.errorCode).toBe("PROVIDER_OUTCOME_UNCERTAIN");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(before + 2);
    expect(vi.mocked(generateChapter)).not.toHaveBeenCalled();
  });
  it("recovers an interrupted deterministic render checkpoint", async () => {
    const p = await project(), job = await startProject(userId, p.id, "render-restart-key", 5);
    await processFactoryTick(); await controlJob(userId, p.id, "approve");
    await prisma.videoFactoryJob.update({ where: { id: job.id }, data: { status: "RUNNING", leaseToken: "dead-renderer", leaseUntil: new Date(0) } });
    await sweepJobs(); expect((await getProject(userId, p.id)).jobs[0].status).toBe("QUEUED");
    await processFactoryTick(); await processFactoryTick();
    expect((await getProject(userId, p.id)).jobs[0].status).toBe("DELIVERED"); expect(vi.mocked(generateChapter)).toHaveBeenCalledTimes(1);
  });
  it("assembles a synthetic 60-minute project over independent durable checkpoints without live provider fees", async () => {
    const p = await createProject(userId, { title: "TEST ONLY 60-minute fixture", brief: "Synthetic long-form orchestration without real generation fees", configuration: { ...config, durationSeconds: 3600, budgetCap: 1000, mode: "AUTOPILOT" } });
    const job = await startProject(userId, p.id, "synthetic-sixty-minutes", 156);
    for (let i = 0; i < 12; i++) await processFactoryTick();
    const planned = await prisma.videoFactoryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(planned.stage).toBe("SHOT_RENDERING"); expect(JSON.parse(planned.checkpoint).chapters.length).toBe(12);
    for (let i = 0; i < 13; i++) await processFactoryTick();
    const done = await prisma.videoFactoryJob.findUniqueOrThrow({ where: { id: job.id }, include: { steps: true } });
    expect(done.status).toBe("DELIVERED"); expect(done.spentCredits).toBe(156); expect(done.steps.length).toBe(25);
    expect(vi.mocked(generateChapter)).toHaveBeenCalledTimes(12);
  },15000);
  it("returns unused authorization to the original team after membership changes", async () => {
    const team = await prisma.team.create({ data: { name: "TEST ONLY original payer", ownerId: otherId, credits: 100, mediaCredits: 100 } });
    await prisma.teamMember.create({ data: { userId, teamId: team.id, role: "MEMBER" } });
    const p = await project(), job = await startProject(userId, p.id, "team-payer-snapshot", 5);
    expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).credits).toBe(95);
    await prisma.teamMember.delete({ where: { userId } });
    await controlJob(userId, p.id, "cancel");
    expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).credits).toBe(100);
    expect((await prisma.videoFactoryJob.findUniqueOrThrow({ where: { id: job.id } })).settledAt).not.toBeNull();
  });
  it("encrypts provider secrets, gates commercial approval and supports approved fallback",async()=>{
    const input={id:"test-image",name:"TEST ONLY IMAGE",kind:"IMAGE",adapter:"OPENAI_IMAGE",model:"test-model",enabled:true,secret:"test-only-provider-key",credentialRef:null,settings:{commercialApproved:true,safetyReviewed:true},pricing:{unitUsd:.01,unit:"image",verifiedAt:new Date().toISOString()}};
    const saved=await saveMediaProvider(userId,input);expect("secret" in saved).toBe(false);
    expect((await prisma.videoFactoryProvider.findUniqueOrThrow({where:{id:"test-image"}})).secret).toMatch(/^enc:v1:/);
    expect((await getMediaProvider("missing","IMAGE",["test-image"])).id).toBe("test-image");
    await saveMediaProvider(userId,{...input,id:"credential-scope-test"});
    await saveMediaProvider(userId,{...input,id:"credential-scope-test",kind:"TTS",adapter:"ELEVENLABS_TTS",enabled:false,secret:undefined});
    expect((await prisma.videoFactoryProvider.findUniqueOrThrow({where:{id:"credential-scope-test"}})).secret).toBeNull();
    await expect(saveMediaProvider(userId,{...input,id:"unsafe-provider",settings:{commercialApproved:false,safetyReviewed:true}})).rejects.toThrow();
  });
  it("stores agent versions, restores a previous version and denies nonadmin control",async()=>{
    const configuration={role:"writer",systemPrompt:"Test only writer instructions for structured drafts",modelId:"test-only",allowedTools:["write"],maxSteps:100,budgetCap:1000,timeoutSeconds:120,maxRetries:0};
    await saveResource(userId,{id:"agent_writer",kind:"AGENT",name:"Test writer",enabled:true,expectedVersion:0,configuration});
    await saveResource(userId,{id:"agent_writer",kind:"AGENT",name:"Test writer v2",enabled:true,expectedVersion:1,configuration:{...configuration,systemPrompt:"Second version test only writer instructions"}});
    expect((await rollbackResource(userId,"agent_writer",1,2)).version).toBe(3);
    expect((await adminControl(request("/api/admin/video-factory/control",otherId,{action:"retention.run"}))).status).toBe(401);
    await prisma.videoFactoryResource.delete({where:{id:"agent_writer"}});
  });
  it("executes a budgeted multimedia flow, supports two approval gates and releases unused estimates",async()=>{
    await saveMediaProvider(userId,{id:"test-voice",name:"TEST ONLY VOICE",kind:"TTS",adapter:"OPENAI_TTS",model:"test-model",enabled:true,secret:"test-only-key",settings:{commercialApproved:true,safetyReviewed:true},pricing:{unitUsd:null,unit:"request",verifiedAt:null}});
    const policy=await savePolicy(userId,{enabled:true,longFormEnabled:true,approvedModelId:"test-only",creditsPerChapter:3,creditsPerRenderMinute:2,providers:{image:"test-image",tts:"test-voice"},creditsPerImage:2,creditsPerVoice:1,presets:{SMART:{imagePercent:100,videoPercent:0}}});
    const configMedia=configurationSchema.parse({...config,mediaMode:"MULTIMEDIA",narration:true,shotsPerChapter:1}),p=await createProject(userId,{title:"TEST ONLY multimedia",brief:"Synthetic multimedia production without live provider calls",configuration:configMedia}),estimate=quote(configMedia,policy),balance=(await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits;
    const request=vi.fn<typeof fetch>().mockImplementation(async url=>String(url).includes("images")?Response.json({data:[{b64_json:Buffer.from("TEST ONLY TRANSPORT").toString("base64")}]}):new Response(Buffer.from("TEST ONLY AUDIO TRANSPORT")));vi.stubGlobal("fetch",request);
    const job=await startProject(userId,p.id,"multimedia-two-gates",estimate.credits);await processFactoryTick();expect((await getProject(userId,p.id)).jobs[0].stage).toBe("SCRIPT_REVIEW");await controlJob(userId,p.id,"approve");expect((await getProject(userId,p.id)).jobs[0].stage).toBe("STORYBOARD_REVIEW");await controlJob(userId,p.id,"approve");
    for(let i=0;i<4;i++)await processFactoryTick();
    const done=await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});expect(done.status).toBe("DELIVERED");expect(done.spentCredits).toBe(estimate.credits);expect(request).toHaveBeenCalledTimes(2);expect((await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits).toBe(balance-estimate.credits);expect(await prisma.videoFactoryApproval.count({where:{jobId:job.id}})).toBe(2);
  });
  it("does not debit a known rejected media call and schedules a bounded retry",async()=>{
    const policy=await savePolicy(userId,{enabled:true,longFormEnabled:true,approvedModelId:"test-only",creditsPerChapter:3,creditsPerRenderMinute:2,providers:{image:"test-image"},creditsPerImage:2,presets:{SMART:{imagePercent:100,videoPercent:0}}});
    const c=configurationSchema.parse({...config,mediaMode:"MULTIMEDIA",mode:"AUTOPILOT",shotsPerChapter:1}),p=await createProject(userId,{title:"TEST ONLY rejection",brief:"Synthetic provider rejection test",configuration:c}),job=await startProject(userId,p.id,"rejected-media-test",quote(c,policy).credits);await processFactoryTick();vi.stubGlobal("fetch",vi.fn<typeof fetch>().mockResolvedValue(new Response("",{status:429})));await processFactoryTick();const current=await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});expect(current.status).toBe("QUEUED");expect(current.spentCredits).toBe(3);expect(current.attempts).toBe(1);await controlJob(userId,p.id,"cancel");
  });
  it("refuses a globally approved fallback excluded by the account policy before dispatch",async()=>{
    await saveMediaProvider(userId,{id:"restricted-fallback",name:"TEST ONLY FALLBACK",kind:"IMAGE",adapter:"OPENAI_IMAGE",model:"test-model",enabled:true,secret:"test-only-key",settings:{commercialApproved:true,safetyReviewed:true},pricing:{unitUsd:null,unit:"image",verifiedAt:null}});
    const policy=await savePolicy(userId,{enabled:true,longFormEnabled:true,approvedModelId:"test-only",creditsPerChapter:3,creditsPerRenderMinute:2,providers:{image:"test-image"},fallbackProviders:["restricted-fallback"],creditsPerImage:2,presets:{SMART:{imagePercent:100,videoPercent:0}}});
    const c=configurationSchema.parse({...config,mediaMode:"MULTIMEDIA",mode:"AUTOPILOT",shotsPerChapter:1}),p=await createProject(userId,{title:"TEST ONLY policy",brief:"Synthetic fallback policy enforcement",configuration:c});
    const job=await startProject(userId,p.id,"restricted-fallback-test",quote(c,policy).credits);await processFactoryTick();
    await saveResource(userId,{id:`user_${userId}`,kind:"USER_POLICY",name:"TEST ONLY quota",enabled:true,expectedVersion:0,configuration:{userId,enabled:true,longFormEnabled:true,maxProjectCredits:1000,maxActivePerUser:5,allowedProviders:["test-image"],dailyCredits:1000}});
    await prisma.videoFactoryProvider.update({where:{id:"test-image"},data:{enabled:false}});
    const transport=vi.fn<typeof fetch>();vi.stubGlobal("fetch",transport);
    try{await processFactoryTick();expect(transport).not.toHaveBeenCalled();expect((await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}})).errorCode).toBe("USER_PRODUCTION_POLICY_DENIED");}
    finally{await prisma.videoFactoryProvider.update({where:{id:"test-image"},data:{enabled:true}});await prisma.videoFactoryResource.delete({where:{id:`user_${userId}`}});}
  });
  it("deduplicates signed provider webhook events without changing the ledger",async()=>{
    const body=JSON.stringify({type:"video.completed",data:{id:"video_test"}}),stamp=String(Math.floor(Date.now()/1000)),key=Buffer.from("TEST ONLY WEBHOOK"),id="wh-integration-test",headers=new Headers({"webhook-id":id,"webhook-timestamp":stamp,"webhook-signature":"v1,"+createHmac("sha256",key).update(`${id}.${stamp}.${body}`).digest("base64")});
    const before=await prisma.usageLog.count();expect(await acceptFactoryWebhook(body,headers,"whsec_"+key.toString("base64"))).toMatchObject({duplicate:false});expect(await acceptFactoryWebhook(body,headers,"whsec_"+key.toString("base64"))).toMatchObject({duplicate:true});expect(await prisma.usageLog.count()).toBe(before);
  });
  it("refuses uploads without rights/scanner and refuses foreign asset references before production",async()=>{
    const p=await project();await expect(uploadAsset(userId,p.id,Buffer.from("test"),"image/png","test.png",false)).rejects.toThrow("RIGHTS_CONFIRMATION_REQUIRED");
    const old=process.env.VIDEO_FACTORY_CLAMSCAN;delete process.env.VIDEO_FACTORY_CLAMSCAN;await expect(uploadAsset(userId,p.id,Buffer.from("test"),"image/png","test.png",true)).rejects.toThrow("UPLOAD_SCANNER_NOT_CONFIGURED");if(old)process.env.VIDEO_FACTORY_CLAMSCAN=old;
    await expect(ownedAsset(otherId,"foreign-asset")).rejects.toThrow("ASSET_NOT_FOUND");
    const manifest=manifestSchema.parse({chapters:[{title:"test",continuity:"test",shots:[{id:"test",title:"test",narration:"test",visualPrompt:"test",assetId:"foreign-asset"}]}]});await expect(editManifest(userId,p.id,0,manifest)).rejects.toThrow("ASSET_NOT_FOUND");
  });
  it("restores project versions with ownership and optimistic concurrency",async()=>{
    const p=await project(),manifest=manifestSchema.parse({chapters:[{title:"test",continuity:"test",shots:[{id:"test",title:"test",narration:"test",visualPrompt:"test"}]}]});await editManifest(userId,p.id,0,manifest);expect((await restoreProjectVersion(userId,p.id,0,1)).version).toBe(2);expect((await getProject(userId,p.id)).manifest).toBe("{}");await expect(restoreProjectVersion(otherId,p.id,0,2)).rejects.toThrow("PROJECT_NOT_FOUND");
  });
  it("requires explicit publishing authorization and refuses another user's film",async()=>{
    await expect(schedulePublish(userId,"unknown",{artifactId:"unknown",idempotencyKey:"publish-test",scheduledAt:new Date().toISOString(),metadata:{title:"test",description:"",privacy:"private",madeForKids:false},authorized:false,rightsConfirmed:true})).rejects.toThrow();
    await expect(cancelPublishing(otherId,"unknown")).rejects.toThrow("PUBLISH_JOB_BUSY");
  });
  it("records owner-scoped voice consent and immediately blocks reuse after revocation",async()=>{
    const p=await project(),sample=await saveAsset({userId,projectId:p.id,kind:"AUDIO",name:"TEST ONLY sample",provenance:{source:"TEST_ONLY"}},{bytes:Buffer.from("TEST ONLY AUDIO"),extension:"wav",mimeType:"audio/wav"});
    const input={projectId:p.id,sampleAssetId:sample.id,name:"TEST ONLY VOICE",ownVoice:true,rightsConfirmed:true,processingConsent:true,statement:"I consent to this synthetic test only."};
    await expect(createVoiceConsent(otherId,input)).rejects.toThrow("ASSET_NOT_FOUND");
    const consent=await createVoiceConsent(userId,input);expect((await requireVoiceConsent(userId,consent.id,p.id)).sampleAssetId).toBe(sample.id);await revokeVoiceConsent(userId,consent.id);await expect(requireVoiceConsent(userId,consent.id,p.id)).rejects.toThrow("ASSET_NOT_FOUND");
    await saveMediaProvider(userId,{id:"test-clone",name:"TEST ONLY CLONE",kind:"CLONE",adapter:"ELEVENLABS_CLONE",model:"test-clone",enabled:true,secret:"test-only-key",settings:{commercialApproved:true,safetyReviewed:true},pricing:{unitUsd:null,unit:"request",verifiedAt:null}});
    await saveAsset({userId,projectId:p.id,kind:"CLONE",name:"TEST ONLY profile",provenance:{source:"TEST_ONLY",prompt:consent.id,provider:"test-clone"}},{bytes:Buffer.from(JSON.stringify({voice_id:"test_only_voice",requires_verification:false})),extension:"json",mimeType:"application/json"});
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal("fetch",transport);
    expect((await revokeVoiceConsent(userId,consent.id,true)).remoteDeleted).toBe(1);expect((await revokeVoiceConsent(userId,consent.id,true)).remoteDeleted).toBe(0);expect(transport).toHaveBeenCalledTimes(1);expect(transport.mock.calls[0][1]?.method).toBe("DELETE");
  });
  it("blocks delivery on semantic errors after actual frame extraction and settles the authorized budget",async()=>{
    const oldFfmpeg=process.env.VIDEO_FACTORY_FFMPEG,oldFfprobe=process.env.VIDEO_FACTORY_FFPROBE;
    process.env.VIDEO_FACTORY_FFMPEG=path.resolve("tmp/video-factory/tools/node_modules/ffmpeg-static/ffmpeg.exe");process.env.VIDEO_FACTORY_FFPROBE=path.resolve("tmp/video-factory/tools/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe");
    try{
      await saveMediaProvider(userId,{id:"test-vision",name:"TEST ONLY VISION",kind:"VISION",adapter:"OPENAI_VISION",model:"test-vision",enabled:true,secret:"test-only-key",settings:{commercialApproved:true,safetyReviewed:true},pricing:{unitUsd:null,unit:"request",verifiedAt:null}});
      const policy=await savePolicy(userId,{enabled:true,approvedModelId:"test-only",creditsPerChapter:3,creditsPerRenderMinute:2,creditsPerSemanticReview:1,advancedProviders:{vision:"test-vision"},presets:{SMART:{imagePercent:0,videoPercent:0}}}),c=configurationSchema.parse({...config,mediaMode:"MULTIMEDIA",mode:"AUTOPILOT",semanticReview:true,shotsPerChapter:1});
      const p=await createProject(userId,{title:"TEST ONLY semantic review",brief:"Synthetic semantic quality control",configuration:c}),job=await startProject(userId,p.id,"semantic-block-test",quote(c,policy).credits);
      const actual=await vi.importActual<typeof import("./render")>("./render");vi.mocked(renderShot).mockImplementationOnce(actual.renderShot);
      const transport=vi.fn<typeof fetch>().mockResolvedValue(Response.json({output:[{content:[{type:"output_text",text:JSON.stringify({summary:"Synthetic finding",findings:[{category:"VISUAL_MISMATCH",severity:"ERROR",evidence:"Synthetic test mismatch",repair:"Revise the shot prompt"}],uncertainties:["Sampled frames only"]})}]}]}));vi.stubGlobal("fetch",transport);
      for(let i=0;i<4;i++)await processFactoryTick();const done=await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});expect(done.status).toBe("FAILED");expect(done.errorCode).toBe("SEMANTIC_REPAIR_REQUIRED");expect(done.spentCredits).toBe(6);expect(done.settledAt).not.toBeNull();expect(await prisma.videoFactoryQualityReport.count({where:{jobId:job.id,kind:"SEMANTIC",status:"FAILED"}})).toBe(1);expect(transport).toHaveBeenCalledTimes(1);
    }finally{if(oldFfmpeg===undefined)delete process.env.VIDEO_FACTORY_FFMPEG;else process.env.VIDEO_FACTORY_FFMPEG=oldFfmpeg;if(oldFfprobe===undefined)delete process.env.VIDEO_FACTORY_FFPROBE;else process.env.VIDEO_FACTORY_FFPROBE=oldFfprobe;}
  },60000);
  it("recovers an async video submission after a lease restart without resubmitting or charging again",async()=>{
    await saveMediaProvider(userId,{id:"test-video",name:"TEST ONLY VIDEO",kind:"VIDEO",adapter:"OPENAI_VIDEO",model:"test-video-model",enabled:true,secret:"test-only-key",settings:{commercialApproved:true,safetyReviewed:true},pricing:{unitUsd:null,unit:"second",verifiedAt:null}});
    const policy=await savePolicy(userId,{enabled:true,longFormEnabled:true,approvedModelId:"test-only",creditsPerChapter:3,creditsPerRenderMinute:2,providers:{video:"test-video"},creditsPerVideoSecond:1,presets:{SMART:{imagePercent:0,videoPercent:100}}}),c=configurationSchema.parse({...config,mediaMode:"MULTIMEDIA",mode:"AUTOPILOT",shotsPerChapter:1});
    const p=await createProject(userId,{title:"TEST ONLY async video",brief:"Synthetic durable video submission",configuration:c}),job=await startProject(userId,p.id,"async-video-resume",quote(c,policy).credits);await processFactoryTick();
    const transport=vi.fn<typeof fetch>().mockImplementation(async(url,init)=>init?.method==="POST"?Response.json({id:"video_async_test"}):String(url).endsWith("/content")?new Response(Buffer.from("TEST ONLY VIDEO TRANSPORT")):Response.json({status:"completed"}));vi.stubGlobal("fetch",transport);
    await processFactoryTick();const submitted=await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});expect(submitted.spentCredits).toBe(7);
    await prisma.videoFactoryJob.update({where:{id:job.id},data:{status:"RUNNING",leaseToken:"dead-video-worker",leaseUntil:new Date(0),nextAttemptAt:null}});await sweepJobs();await processFactoryTick();await processFactoryTick();await processFactoryTick();
    const done=await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});expect(done.status).toBe("DELIVERED");expect(done.spentCredits).toBe(9);expect(transport.mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(1);
  });
});


