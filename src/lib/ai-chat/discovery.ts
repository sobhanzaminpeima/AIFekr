import { features, text, type Copy } from "@/lib/marketing/catalog";
import { localizedPublicPath } from "@/lib/seo/locales";
import type { Lang } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/prisma";
import { chatPolicy } from "./policy";
type Module = { id: string; feature: string; pattern: RegExp };
export const discoveryModules: Module[] = [
  {
    id: "student",
    feature: "education",
    pattern:
      /(lecture notes|exam revision|flashcards|جزوه|امتحان|فلش.?کارت|Vorlesungsnotizen|Prüfungsvorbereitung|ders not|sınav)/i,
  },
  {
    id: "property",
    feature: "property",
    pattern:
      /(property lead|real estate client|estate listing|مشتری املاک|فایل ملک|Immobilienkunde|Immobilienangebot|emlak müşteri|emlak ilan)/i,
  },
  {
    id: "crm",
    feature: "crm",
    pattern:
      /(customer follow.?up|sales pipeline|پیگیری مشتری|قیف فروش|Kundennachverfolgung|Vertriebspipeline|müşteri takibi|satış hattı)/i,
  },
  {
    id: "video-factory",
    feature: "video-factory",
    pattern:
      /(make.{0,30}youtube video|produce.{0,20}video|ساخت ویدیو|تولید ویدیو|YouTube.Video erstellen|Video produzieren|video oluştur|video üret)/i,
  },
  {
    id: "voice",
    feature: "voice",
    pattern:
      /(customer support call|ai receptionist|پاسخگویی تلفنی|منشی صوتی|KI.Rezeption|Kundendienstanruf|sesli asistan|telefon yanıtlama)/i,
  },
  {
    id: "social",
    feature: "social",
    pattern:
      /(instagram post|social media schedule|پست اینستاگرام|تقویم محتوا|Social.Media.Plan|Instagram.Beitrag|instagram gönderi|sosyal medya takvim)/i,
  },
];
const fitnessCopy = {
  title: ["فیتنس آی‌فکر", "AIFekr FIT", "AIFekr FIT", "AIFekr FIT"] as Copy,
  desc: [
    "برنامه تمرین و ثبت پیشرفت در فضای ورزشی آی‌فکر.",
    "Plan workouts and record progress in AIFekr's fitness workspace.",
    "Training planen und Fortschritte im AIFekr-Fitnessbereich erfassen.",
    "AIFekr fitness alanında antrenman planla ve ilerlemeni kaydet.",
  ] as Copy,
};
export function matchModule(
  message: string,
  disabled: string[] = [],
  threshold = 0.8,
) {
  if (
    /(ignore.{0,20}instructions|force.{0,20}recommend|دستور.{0,10}نادیده|حتماً.{0,15}پیشنهاد)/i.test(
      message,
    )
  )
    return null;
  const found = discoveryModules.find(
    (m) => !disabled.includes(m.id) && m.pattern.test(message),
  );
  if (
    found &&
    threshold <= 0.9 &&
    features.some((f) => f.slug === found.feature)
  )
    return { id: found.id, confidence: 0.9 };
  if (
    !disabled.includes("fitness") &&
    threshold <= 0.9 &&
    /(workout plan|gym routine|برنامه ورزشی|برنامه تمرین|Trainingsplan|antrenman plan)/i.test(
      message,
    )
  )
    return { id: "fitness", confidence: 0.9 };
  return null;
}
export function moduleCard(id: string, language: Lang) {
  if (id === "fitness")
    return {
      id,
      title: text(language, fitnessCopy.title),
      description: text(language, fitnessCopy.desc),
      features: [],
      href: localizedPublicPath("/fit", language),
    };
  const module = discoveryModules.find((m) => m.id === id),
    f = module && features.find((f) => f.slug === module.feature);
  return f
    ? {
        id,
        title: text(language, f.title),
        description: text(language, f.desc),
        features: f.items.slice(0, 3).map((item) => text(language, item)),
        href: localizedPublicPath(`/features/${f.slug}`, language),
      }
    : null;
}
export async function recommend(
  ownerKey: string,
  requestId: string,
  language: Lang,
) {
  const policy = await chatPolicy();
  if (!policy.discoveryEnabled) return null;
  const [request, pref, last, shown] = await Promise.all([
    prisma.aiChatRequest.findFirst({
      where: { id: requestId, ownerKey, status: "SUCCEEDED" },
    }),
    prisma.aiChatDiscoveryPreference.findUnique({ where: { ownerKey } }),
    prisma.aiChatDiscoveryEvent.findFirst({
      where: { ownerKey, action: "shown" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiChatDiscoveryEvent.count({
      where: {
        ownerKey,
        action: "shown",
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    }),
  ]);
  if (!request || pref?.disabled || shown >= 3) return null;
  if (
    last &&
    (await prisma.aiChatRequest.count({
      where: {
        ownerKey,
        status: "SUCCEEDED",
        createdAt: { gt: last.createdAt },
      },
    })) < policy.discoveryFrequency
  )
    return null;
  const match = matchModule(
    request.input,
    policy.disabledModules,
    policy.discoveryThreshold,
  );
  if (
    !match ||
    (JSON.parse(pref?.dismissed || "[]") as string[]).includes(match.id)
  )
    return null;
  const card = moduleCard(match.id, language);
  if (!card) return null;
  await prisma.aiChatDiscoveryEvent.upsert({
    where: { id: `${requestId}:${match.id}:eligible` },
    create: {
      id: `${requestId}:${match.id}:eligible`,
      ownerKey,
      requestId,
      moduleId: match.id,
      action: "eligible",
    },
    update: {},
  });
  return card;
}
