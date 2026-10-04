import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { reserveVoiceCall, settleVoiceCall, callCredits } from "./billing";
import { POST } from "@/app/api/webhooks/vapi/route";
import { registrationPhone, dialCodeFor } from "@/lib/constants/countries";
import { accountTypeFor } from "@/lib/auth/accountAudience";
import { scenarioPrompt } from "./scenarios";
import { eventDuration } from "./eventDuration";
vi.mock("@/lib/voice/settings",()=>({voiceSettings:async()=>({webhookSecret:"test-webhook-secret-123456789012345",creditsPerMinute:10,maxDurationSeconds:300})}));
vi.mock("@/lib/notifications/create",()=>({notify:async()=>{}}));

describe("registration audience and phone handling",()=>{
  it("classifies student and business intent without granting a plan",()=>{expect(accountTypeFor("STUDENT_FIRST_THREE_MONTHS","BUSINESS")).toBe("STUDENT");expect(accountTypeFor("TEAM_BUSINESS_GROW",null)).toBe("BUSINESS");expect(accountTypeFor(null,"STUDENT")).toBe("STUDENT");expect(accountTypeFor(null,"ADMIN")).toBe("PERSONAL");});
  it("normalizes local, international and Persian Iranian digits consistently",()=>{for(const n of ["09123456789","+989123456789","00989123456789","۹۱۲۳۴۵۶۷۸۹"]) expect(registrationPhone(n,"IR")).toBe("09123456789");expect(dialCodeFor("IR")).toBe("+98");expect(()=>registrationPhone("123","IR")).toThrow();});
  it("supports Northern Cyprus without double prefix",()=>{expect(dialCodeFor("CY-NORTH")).toBe("+90");expect(registrationPhone("05331234567","CY-NORTH")).toBe("+905331234567");expect(registrationPhone("+905331234567","CY-NORTH")).toBe("+905331234567");expect(()=>registrationPhone("+35799123456","CY-NORTH")).toThrow();});
  it("provides cautious clinic, receptionist and property scenarios",()=>{expect(scenarioPrompt("clinic","Clinic","fa")).toContain("not medical diagnosis");expect(scenarioPrompt("reception","Office","tr")).toContain("awaiting staff confirmation");expect(scenarioPrompt("real_estate","Agency","en")).toContain("check_property_status");});
  it("charges seconds rather than rounding every call to a full minute",()=>{expect(callCredits(1,10)).toBe(1);expect(callCredits(61,10)).toBe(11);expect(callCredits(0,10)).toBe(0);expect(()=>callCredits(NaN,10)).toThrow();});
  it("handles unanswered calls without inventing a duration",()=>{expect(eventDuration({endedReason:"customer-did-not-answer"})).toBe(0);expect(()=>eventDuration({})).toThrow();expect(eventDuration({call:{startedAt:"2026-10-04T10:00:00Z",endedAt:"2026-10-04T10:01:00Z"}})).toBe(60);});
});

describe.runIf(process.env.RUN_VOICE_INTEGRATION==="1")("voice service database and webhook integration",()=>{
  let userId:string,teamId:string;
  let agent:Awaited<ReturnType<typeof prisma.voiceAgent.create>>;
  const suffix=Date.now().toString();
  const request=(message:unknown,secret="test-webhook-secret-123456789012345")=>new NextRequest("http://localhost/api/webhooks/vapi",{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify({message})});
  beforeAll(async()=>{
    if(process.env.DATABASE_URL!=="file:./vitest.db") throw new Error("Isolated voice test DB required");
    userId=(await prisma.user.create({data:{email:`voice-${suffix}@test.invalid`,credits:500,voicePlan:"ACTIVE",voicePlanExpiry:new Date(Date.now()+86400000)}})).id;
    agent=await prisma.voiceAgent.create({data:{userId,name:"Clinic test",vertical:"clinic",systemPrompt:"test",vapiAssistantId:`assistant-${suffix}`,vapiPhoneNumberId:`number-${suffix}`,openingHour:0,closingHour:24}});
  });
  afterAll(async()=>{
    if(!userId)return;
    await prisma.teamMember.deleteMany({where:{userId}});
    if(teamId)await prisma.team.delete({where:{id:teamId}});
    await prisma.user.delete({where:{id:userId}});
  });
  it("rejects unauthenticated webhook requests",async()=>{expect((await POST(request({type:"end-of-call-report"},"wrong"))).status).toBe(401);});
  it("reserves incoming credit once even when admission repeats",async()=>{
    const msg={type:"assistant-request",phoneNumber:{id:agent.vapiPhoneNumberId},call:{id:`inbound-${suffix}`}};
    const before=(await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits;
    expect((await(await POST(request(msg))).json()).assistantId).toBe(agent.vapiAssistantId);
    await POST(request(msg));expect((await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits).toBe(before-50);
  });
  it("settles actual duration and writes usage only once on report replay",async()=>{
    const msg={type:"end-of-call-report",call:{id:`inbound-${suffix}`,assistantId:agent.vapiAssistantId,startedAt:"2026-10-04T09:00:00Z",endedAt:"2026-10-04T09:01:01Z"},artifact:{transcript:"test transcript"},analysis:{summary:"test summary"},cost:0.12};
    expect((await POST(request(msg))).status).toBe(200);await POST(request(msg));
    const c=await prisma.voiceCallLog.findUniqueOrThrow({where:{vapiCallId:`inbound-${suffix}`}});
    expect(c.creditsCharged).toBe(11);expect(c.transcript).toBe("test transcript");expect(c.billingStatus).toBe("settled");expect(await prisma.usageLog.count({where:{userId,type:"voice"}})).toBe(1);
  });
  it("returns a per-tool error instead of granting estate data to clinic",async()=>{
    await reserveVoiceCall(agent,`tool-${suffix}`,10,300);
    const msg={type:"tool-calls",call:{id:`tool-${suffix}`,assistantId:agent.vapiAssistantId},toolCallList:[{id:"estate",function:{name:"search_properties",arguments:{listingType:"buy"}}}]};
    expect((await(await POST(request(msg))).json()).results[0].result).toContain("unavailable");
  });
  it("deduplicates appointment tools and rejects an occupied slot",async()=>{
    const future=new Date(Date.now()+86400000);future.setUTCHours(10,0,0,0);
    const tool={id:"book",function:{name:"book_appointment",arguments:{leadName:"Test caller",leadPhone:"+905331234567",scheduledAtIso:future.toISOString()}}};
    const msg={type:"tool-calls",call:{id:`tool-${suffix}`,assistantId:agent.vapiAssistantId},toolCallList:[tool]};
    await POST(request(msg));await POST(request(msg));expect(await prisma.voiceAppointment.count({where:{agentId:agent.id}})).toBe(1);
    const conflict=await(await POST(request({...msg,toolCallList:[{...tool,id:"another"}]}))).json();expect(conflict.results[0].result).toContain("unavailable");
  });
  it("rejects past and timezone-free appointment dates",async()=>{
    for(const date of ["2020-01-01T10:00:00Z","2030-01-01T10:00:00"]){
      const msg={type:"tool-calls",call:{id:`tool-${suffix}`,assistantId:agent.vapiAssistantId},toolCallList:[{id:date,function:{name:"book_appointment",arguments:{leadName:"Test",leadPhone:"+905331234567",scheduledAtIso:date}}}]};
      await POST(request(msg));
    }expect(await prisma.voiceAppointment.count({where:{agentId:agent.id}})).toBe(1);
  });
  it("rejects insufficient balance and inactive subscriptions before admission",async()=>{
    await prisma.user.update({where:{id:userId},data:{credits:1}});
    const msg={type:"assistant-request",phoneNumber:{id:agent.vapiPhoneNumberId},call:{id:`insufficient-${suffix}`}};
    expect((await(await POST(request(msg))).json()).error).toBeTruthy();expect((await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits).toBe(1);
    await prisma.user.update({where:{id:userId},data:{credits:500,voicePlanExpiry:new Date(0)}});
    expect((await(await POST(request(msg))).json()).error).toContain("Subscription");
    await prisma.user.update({where:{id:userId},data:{voicePlanExpiry:new Date(Date.now()+86400000)}});
  });
  it("refunds failed calls and never settles twice",async()=>{
    const r=await reserveVoiceCall(agent,`failed-${suffix}`,10,300);
    const before=(await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits;
    await settleVoiceCall(r.id,0,{status:"failed"});await settleVoiceCall(r.id,0,{status:"failed"});expect((await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits).toBe(before+50);
  });
  it("cannot overdraw credit when two calls reserve concurrently",async()=>{
    await prisma.user.update({where:{id:userId},data:{credits:50}});
    const outcomes=await Promise.allSettled([reserveVoiceCall(agent,`race-a-${suffix}`,10,300),reserveVoiceCall(agent,`race-b-${suffix}`,10,300)]);
    expect(outcomes.filter(o=>o.status==="fulfilled")).toHaveLength(1);
    expect((await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits).toBe(0);
    await prisma.user.update({where:{id:userId},data:{credits:500}});
  });
  it("records unreserved legacy reports and debits only once",async()=>{
    const msg={type:"end-of-call-report",call:{id:`legacy-${suffix}`,assistantId:agent.vapiAssistantId},durationSeconds:60};
    const before=(await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits;
    expect((await POST(request(msg))).status).toBe(200);await POST(request(msg));
    expect((await prisma.user.findUniqueOrThrow({where:{id:userId}})).credits).toBe(before-10);
  });
  it("refunds to the original team wallet after membership changes",async()=>{
    teamId=(await prisma.team.create({data:{name:"Voice test",ownerId:userId,credits:100}})).id;
    await prisma.teamMember.create({data:{teamId,userId,role:"OWNER"}});
    const r=await reserveVoiceCall(agent,`team-${suffix}`,10,300);
    expect((await prisma.team.findUniqueOrThrow({where:{id:teamId}})).credits).toBe(50);
    await prisma.teamMember.delete({where:{userId}});
    await settleVoiceCall(r.id,60,{status:"completed"});expect((await prisma.team.findUniqueOrThrow({where:{id:teamId}})).credits).toBe(90);
  });
});
