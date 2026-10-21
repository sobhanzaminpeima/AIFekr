import { prisma } from "@/lib/db/prisma";
import { policySchema } from "./domain";
export const POLICY_KEY = "videoFactoryPolicy";
export async function getPolicy() {
  const row = await prisma.siteSetting.findUnique({ where: { key: POLICY_KEY } });
  const policy=policySchema.parse(row ? JSON.parse(row.value) : {});
  const plan=policy.commercial.mode==="DURATION_RETAIL"?await prisma.package.findFirst({where:{planCode:policy.commercial.referencePlanCode,isActive:true},select:{planCode:true,priceUsd:true,credits:true}}):null;
  policy.commercial.creditRate=plan?.priceUsd && plan.credits>0?{planCode:plan.planCode,usdCents:plan.priceUsd,credits:plan.credits}:null;
  return policy;
}
export async function savePolicy(actorId: string, input: unknown) {
  const policy = policySchema.parse(input);
  delete policy.packageUsage;
  // This release has explicit owner authorization to prepare drafts only.
  // Runtime deployment approval is a separate operator-controlled gate.
  if(policy.enabled && process.env.VIDEO_FACTORY_SALES_APPROVED!=="true")throw new (await import("./domain")).FactoryError("OWNER_SALES_APPROVAL_REQUIRED",403);
  if(policy.enabled && policy.commercial.mode==="DURATION_RETAIL" && policy.commercial.status!=="APPROVED")throw new (await import("./domain")).FactoryError("TARIFF_NOT_APPROVED",403);
  policy.commercial.creditRate=null; // derived live from AIFekr; never trust a client-supplied FX rate
  await prisma.$transaction(async tx => {
    await tx.siteSetting.upsert({ where: { key: POLICY_KEY }, create: { key: POLICY_KEY, value: JSON.stringify(policy) }, update: { value: JSON.stringify(policy) } });
    await tx.auditLog.create({ data: { actorId, action: "video_factory.policy", metadata: JSON.stringify(policy) } });
  });
  return policy;
}
