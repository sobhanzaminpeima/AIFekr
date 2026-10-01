import { prisma } from "@/lib/db/prisma";

export const DEFAULT_THESIS_ASSIST_CREDIT_COST = 20;
const THESIS_COST_KEY = "student_thesis_assist_credit_cost";

export async function getThesisAssistCreditCost(): Promise<number> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: THESIS_COST_KEY }, select: { value: true } });
  const value = Number(setting?.value);
  return Number.isInteger(value) && value >= 5 && value <= 100 ? value : DEFAULT_THESIS_ASSIST_CREDIT_COST;
}

export async function setThesisAssistCreditCost(cost: number): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: THESIS_COST_KEY },
    create: { key: THESIS_COST_KEY, value: String(cost) },
    update: { value: String(cost) },
  });
}
