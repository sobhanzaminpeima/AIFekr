import type { Lang } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/prisma";
import { CHAT_STARTER } from "@/lib/billing/chatStarter";
import { priceForPeriod } from "@/lib/billing/plans";
import { copy, features, text, type Copy } from "@/lib/marketing/catalog";
import { AI_TEAM_DESCRIPTION, AI_TEAM_TITLE, aiTeamCopy } from "@/lib/marketing/aiTeamCopy";
import type { Metadata } from "next";
import { pageJsonLd, pageMetadata } from "@/lib/seo/site";

/** Content of the public pages that are plain copy in the new design. Same wording as the classic pages. */
export type PublicBlock = { heading?: string; body?: string; ordered?: string[]; cards?: { title: string; desc: string }[]; links?: { href: string; label: string }[] };
export type PublicContent = {
  eyebrow: string;
  title: string;
  intro: string;
  actions: { href: string; label: string; primary?: boolean }[];
  blocks: PublicBlock[];
  starter?: { plan: string; available: boolean; minor: number | null; currency: string | null; days: number; credits: number };
};
type Text4 = { fa: string; en: string; de: string; tr: string };

export const AI_CHAT_TITLE: Text4 = { fa: "چت هوش مصنوعی فارسی با مدل‌های GPT | AIFekr", en: "AI Chat for Writing, Learning & Ideas | AIFekr", de: "KI-Chat zum Schreiben und Lernen | AIFekr", tr: "Yazma ve öğrenme için AI sohbet | AIFekr" };
export const AI_CHAT_DESCRIPTION: Text4 = {
  fa: "با چت هوش مصنوعی AIFekr فارسی و انگلیسی گفتگو کنید، متن بنویسید و یاد بگیرید. محیط را قبل از ثبت‌نام ببینید و پلن رایگان یا پکیج مناسب را انتخاب کنید.",
  en: "Chat with AIFekr in English or Persian to write, learn and develop ideas. Preview the workspace before signing up, then choose the free option or a package.",
  de: "Chatten Sie mit AIFekr, um zu schreiben, zu lernen und Ideen zu entwickeln. Sehen Sie sich den Bereich vor der Anmeldung an und wählen Sie die passende Option.",
  tr: "AIFekr ile yazmak, öğrenmek ve fikir geliştirmek için sohbet edin. Kayıt olmadan önce alanı inceleyin, ardından ücretsiz seçeneği veya bir paketi seçin.",
};

const t = text as (lang: Lang, value: Copy) => string;

function aiChat(lang: Lang): PublicContent {
  return {
    eyebrow: "AIFekr AI Chat",
    title: t(lang, ["چت هوش مصنوعی برای نوشتن، یادگیری و ایده‌پردازی", "AI chat for writing, learning and ideas", "KI-Chat für Texte, Lernen und Ideen", "Yazma, öğrenme ve fikirler için AI sohbet"]),
    intro: AI_CHAT_DESCRIPTION[lang],
    actions: [
      { href: "/explore", label: t(lang, ["شروع چت", "Start chatting", "Chat starten", "Sohbete başlayın"]), primary: true },
      { href: "/pricing", label: t(lang, ["قیمت پکیج‌های چت", "Compare chat plans", "Chat-Tarife vergleichen", "Sohbet paketlerini karşılaştırın"]) },
    ],
    blocks: [
      { heading: t(lang, ["چه کارهایی می‌توانید با دستیار متنی انجام دهید؟", "What can you do with an AI writing assistant?", "Was kann ein KI-Textassistent?", "AI yazı asistanıyla neler yapabilirsiniz?"]), body: t(lang, ["پیش‌نویس ایمیل و کپشن بسازید، متن فارسی و انگلیسی را بازنویسی کنید، برای یک موضوع ایده بگیرید یا یک مفهوم درسی را مرحله‌به‌مرحله یاد بگیرید. برای پاسخ دقیق‌تر، هدف، مخاطب و نمونهٔ موردنظرتان را در پیام بنویسید.", "Draft emails and captions, rewrite English or Persian text, brainstorm a project or learn a concept step by step. Include your goal, audience and an example so the assistant can tailor its answer.", "E-Mails entwerfen, Texte überarbeiten, Projektideen sammeln oder ein Thema Schritt für Schritt lernen. Nennen Sie Ziel, Zielgruppe und Beispiele.", "E-posta ve açıklama taslakları oluşturun, metinleri düzenleyin, fikir geliştirin veya bir konuyu adım adım öğrenin. Hedefinizi ve örnekleri belirtin."]) },
      { heading: t(lang, ["شروع بدون سردرگمی", "A clear path to your first conversation", "Ein klarer Start ins Gespräch", "İlk sohbetinize kolay başlangıç"]), ordered: [t(lang, ["محیط پلتفرم را بدون ثبت‌نام ببینید.", "Preview the platform without signing up.", "Plattform ohne Anmeldung ansehen.", "Platformu kayıt olmadan inceleyin."]), t(lang, ["برای ارسال اولین پیام وارد حساب شوید؛ پیش‌نویس شما حفظ می‌شود.", "Sign in to send your first message; your draft is preserved.", "Zum Senden anmelden; Ihr Entwurf bleibt erhalten.", "İlk mesaj için giriş yapın; taslağınız korunur."]), t(lang, ["گزینهٔ رایگان یا پکیج چت را انتخاب و میزان کردیت هر پاسخ را بررسی کنید.", "Choose the free option or a chat package and check credits per response.", "Kostenlose Option oder Chat-Paket wählen und Credits je Antwort prüfen.", "Ücretsiz seçenek veya sohbet paketi seçip yanıt kredisini kontrol edin."])] },
      { heading: t(lang, ["آیا AIFekr همان اشتراک ChatGPT است؟", "Is AIFekr a ChatGPT subscription?", "Ist AIFekr ein ChatGPT-Abonnement?", "AIFekr bir ChatGPT aboneliği mi?"]), body: t(lang, ["خیر. AIFekr یک پلتفرم مستقل است که از API مدل‌های هوش مصنوعی استفاده می‌کند؛ خرید پکیج آن، اشتراک رسمی ChatGPT Plus یا Pro نیست. نام مدل فعال در محیط گفتگو نمایش داده می‌شود. پاسخ‌ها را، به‌ویژه دربارهٔ اطلاعات حساس، بررسی کنید.", "No. AIFekr is an independent platform using AI model APIs. Its packages are not official ChatGPT Plus or Pro subscriptions. The active model is shown in the chat workspace. Check answers, especially for sensitive decisions.", "Nein. AIFekr ist eine unabhängige Plattform mit KI-Modell-APIs, kein offizielles ChatGPT-Plus- oder Pro-Abo. Das aktive Modell steht im Chat. Antworten prüfen.", "Hayır. AIFekr, AI model API'lerini kullanan bağımsız bir platformdur; resmi ChatGPT Plus veya Pro aboneliği değildir. Aktif model sohbette gösterilir. Yanıtları doğrulayın."]) },
      { heading: t(lang, ["از چت تا فضای تخصصی", "Go from chat to a dedicated workspace", "Vom Chat zum Fachbereich", "Sohbetten uzman çalışma alanına"]), links: [
        { href: "/solutions/students", label: t(lang, ["ابزار هوش مصنوعی برای دانشجویان", "AI tools for students", "KI-Tools fürs Studium", "Öğrenciler için AI araçları"]) },
        { href: "/solutions/business", label: t(lang, ["هوش مصنوعی برای کسب‌وکار", "AI for business", "KI fürs Unternehmen", "İşletmeler için AI"]) },
        { href: "/fit", label: t(lang, ["مربی هوش مصنوعی فیتنس", "AI fitness coach", "KI-Fitness-Coach", "AI fitness koçu"]) },
      ] },
    ],
  };
}

async function start(lang: Lang): Promise<PublicContent> {
  const p = await prisma.package.findUnique({ where: { planCode: CHAT_STARTER } });
  const available = !!p?.isActive && p.publicationStatus === "PUBLISHED" && p.publicVisible;
  const price = p ? priceForPeriod(p, "monthly") : null;
  const days = p?.duration ?? 30, credits = p?.credits ?? 100;
  return {
    eyebrow: "AIFekr AI Chat",
    title: t(lang, ["شروعی ساده، با هزینهٔ مشخص", "A simple start, one clear price", "Einfach starten, klarer Preis", "Kolay başlangıç, net fiyat"]),
    intro: t(lang, ["مصرف کردیت هر پاسخ پیش از ارسال در چت مشخص است. مسابقه‌ها رایگان‌اند و خرید، شرط شرکت یا افزایش شانس برنده‌شدن نیست.", "Chat shows credits per response before sending. Competitions are free; buying does not affect eligibility or results.", "Der Chat zeigt die Credits je Antwort vor dem Senden. Wettbewerbe sind kostenlos; ein Kauf beeinflusst weder Teilnahme noch Ergebnis.", "Sohbet, göndermeden önce yanıt başına kredi tutarını gösterir. Yarışmalar ücretsizdir; satın almak katılımı veya sonuçları etkilemez."]),
    actions: [],
    blocks: [],
    starter: { plan: CHAT_STARTER, available, minor: available && price ? price.minor : null, currency: available && price ? price.currency : null, days, credits },
  };
}

function aiTeam(lang: Lang): PublicContent {
  const s = aiTeamCopy(lang);
  return {
    eyebrow: s.heroEyebrow, title: s.heroTitle, intro: s.heroDesc,
    actions: [{ href: "/register", label: s.heroCta, primary: true }, { href: "/ceo", label: t(lang, ["مشاور مدیرعامل", "CEO adviser", "CEO-Berater", "CEO danışmanı"]) }],
    blocks: [
      { heading: t(lang, copy.requirements), body: t(lang, features.find((f) => f.slug === "agents")!.requirement) },
      { heading: s.pipelineTitle, body: s.pipelineDesc, cards: s.agents },
      { heading: s.loopTitle, body: s.loopDesc },
      { heading: s.memoryTitle, body: s.memoryDesc },
      { heading: s.doctorTitle, body: s.doctorDesc, cards: s.doctorFeatures, links: [{ href: "/business-doctor", label: s.doctorTitle }] },
      { heading: s.ceoTitle, body: s.ceoDesc, cards: s.ceoFeatures, links: [{ href: "/ceo", label: s.ceoTitle }] },
      { heading: s.finalCtaTitle, body: s.finalCtaDesc, links: [{ href: "/register", label: s.finalCtaButton }] },
    ],
  };
}

export async function publicContent(lang: Lang, path: string): Promise<PublicContent | null> {
  if (path === "/ai-team") return aiTeam(lang);
  if (path === "/ai-chat") return aiChat(lang);
  if (path === "/start") return start(lang);
  return null;
}

export function publicContentSeo(lang: Lang, path: string): { metadata: Metadata; jsonLd: Record<string, unknown>[] } | null {
  if (path === "/ai-chat") return { metadata: pageMetadata(lang, "/ai-chat", AI_CHAT_TITLE, AI_CHAT_DESCRIPTION), jsonLd: pageJsonLd(lang, "/ai-chat", "WebPage", AI_CHAT_TITLE[lang]) };
  if (path === "/ai-team") return { metadata: pageMetadata(lang, "/ai-team", AI_TEAM_TITLE, AI_TEAM_DESCRIPTION), jsonLd: pageJsonLd(lang, "/ai-team") };
  if (path === "/explore") return { metadata: { title: { absolute: "AIFekr | Platform" }, robots: { index: false, follow: true } }, jsonLd: [] };
  if (path === "/start") return { metadata: { title: "AIFekr Chat Starter", robots: { index: false, follow: true } }, jsonLd: [] };
  if (path === "/owner/login") return { metadata: { title: { absolute: "AIFekr | Owner portal" }, robots: { index: false, follow: false } }, jsonLd: [] };
  if (path.startsWith("/verify-certificate/")) return { metadata: { title: { absolute: "Verify Certificate | AIFekr" }, robots: { index: false, follow: false } }, jsonLd: [] };
  return null;
}
