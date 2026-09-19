import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { submitLeadForm, ingestExternalLead, channelReport } from "./repository";

/**
 * Lead gen under multiple businesses: a public form, a Meta/Google lead and the
 * channel report must all stay inside the business they belong to, even though
 * both businesses belong to the same owner.
 */
const P = `leadiso${Date.now().toString(36)}`;
const ownerId = `${P}owner`;
const bizA = `${P}A`;
const bizB = `${P}B`;

beforeAll(async () => {
  await prisma.user.create({ data: { id: ownerId, name: "owner" } });
  await prisma.leadForm.create({ data: { userId: ownerId, businessId: bizA, slug: `${P}-a`, title: "Form A", fields: JSON.stringify([{ key: "name", required: true }, { key: "phone", required: false }]) } });
  await prisma.leadForm.create({ data: { userId: ownerId, businessId: bizB, slug: `${P}-b`, title: "Form B", fields: JSON.stringify([{ key: "name", required: true }, { key: "phone", required: false }]) } });
});

afterAll(async () => {
  await prisma.leadFormSubmission.deleteMany({ where: { form: { userId: ownerId } } });
  await prisma.crmActivity.deleteMany({ where: { userId: ownerId } });
  await prisma.crmContact.deleteMany({ where: { userId: ownerId } });
  await prisma.leadForm.deleteMany({ where: { userId: ownerId } });
  await prisma.user.deleteMany({ where: { id: ownerId } });
});

describe("lead forms", () => {
  it("lands a public submission in the business that owns the form", async () => {
    const res = await submitLeadForm(`${P}-a`, { values: { name: "Lead for A", phone: "09120000001" }, utm: {}, ipHash: null });
    expect(res.ok).toBe(true);
    const c = await prisma.crmContact.findFirstOrThrow({ where: { userId: ownerId, name: "Lead for A" } });
    expect(c.businessId).toBe(bizA);
  });

  it("lands an external (Meta/Google) lead in the connector's business", async () => {
    const r = await ingestExternalLead({ userId: ownerId, businessId: bizB, source: "meta_lead_ads", sourceName: "Meta — B page", name: "Lead for B", phone: "09120000002" });
    expect(r.ok).toBe(true);
    const c = await prisma.crmContact.findFirstOrThrow({ where: { userId: ownerId, name: "Lead for B" } });
    expect(c.businessId).toBe(bizB);
  });
});

describe("channel report", () => {
  it("counts only the requested business's leads", async () => {
    const a = await channelReport(ownerId, bizA);
    const b = await channelReport(ownerId, bizB);
    expect(a.reduce((n, r) => n + r.total, 0)).toBe(1);
    expect(a.map((r) => r.source)).toEqual(["lead_form"]);
    expect(b.reduce((n, r) => n + r.total, 0)).toBe(1);
    expect(b.map((r) => r.source)).toEqual(["meta_lead_ads"]);
  });

  it("without a business (legacy caller) still sees everything", async () => {
    expect((await channelReport(ownerId)).reduce((n, r) => n + r.total, 0)).toBe(2);
  });
});
