import { destinations } from "./destinations";

/**
 * Adaptive workspaces: a presentation layer over the existing destinations.
 * A workspace only decides what is shown first -- it never grants access,
 * changes billing or hides a route (every page keeps its own server checks,
 * and everything stays reachable through search and "All tools").
 */
export type WorkspaceId = "business" | "real_estate" | "creator" | "student" | "fitness" | "general";
type Copy = [fa: string, en: string];
export type WorkspaceGroup = { title: Copy; hrefs: string[] };
export type Workspace = { id: WorkspaceId; name: Copy; tagline: Copy; groups: WorkspaceGroup[]; start: { href: string; label: Copy } };

export const WORKSPACES: Workspace[] = [
  { id: "business", name: ["کسب‌وکار", "Business"], tagline: ["مشتری بیشتر، فروش بیشتر، کار کمتر", "More customers, more sales, less busywork"],
    start: { href: "/crm", label: ["اولین مشتری را ثبت کنید", "Add your first customer"] },
    groups: [
      { title: ["رشد کسب‌وکار", "Grow my business"], hrefs: ["/lead-gen", "/social", "/seo", "/website-designer"] },
      { title: ["مدیریت مشتریان", "Manage my customers"], hrefs: ["/crm", "/sales", "/voice-agent"] },
      { title: ["خودکارسازی کارها", "Automate my work"], hrefs: ["/agents", "/ceo/orchestrator", "/accounting/automation"] },
      { title: ["ساخت محتوا", "Create content"], hrefs: ["/image/generate", "/video-factory", "/voice-studio"] },
      { title: ["تحلیل کسب‌وکار", "Analyze my business"], hrefs: ["/business-doctor", "/accounting", "/meeting"] },
    ] },
  { id: "real_estate", name: ["املاک", "Real estate"], tagline: ["ملک، مشتری و بازاریابی در یک جا", "Properties, clients and marketing in one place"],
    start: { href: "/crm", label: ["اولین ملک یا مشتری را ثبت کنید", "Add your first property or client"] },
    groups: [
      { title: ["املاک و مشتریان", "Properties & clients"], hrefs: ["/crm", "/lead-gen", "/industry"] },
      { title: ["بازاریابی ملک", "Property marketing"], hrefs: ["/social", "/video-factory", "/image/generate", "/voice-studio"] },
      { title: ["مالی", "Finance"], hrefs: ["/accounting/owner-statements", "/accounting"] },
    ] },
  { id: "creator", name: ["تولید محتوا", "Creator"], tagline: ["تصویر، ویدیو، صدا و انتشار", "Images, video, voice and publishing"],
    start: { href: "/image/generate", label: ["اولین تصویر را بسازید", "Create your first image"] },
    groups: [
      { title: ["ساختن", "Create"], hrefs: ["/image/generate", "/video/generate", "/video-factory", "/voice-studio", "/music/generate"] },
      { title: ["انتشار و رشد", "Publish & grow"], hrefs: ["/social", "/seo/agent-pipeline"] },
      { title: ["آرشیو", "Library"], hrefs: ["/image/gallery"] },
    ] },
  { id: "student", name: ["دانشجو", "Student"], tagline: ["خلاصه، آزمون، فلش‌کارت و برنامهٔ مطالعه", "Summaries, quizzes, flashcards and study plans"],
    start: { href: "/student?view=courses&tool=upload", label: ["اولین جزوه را بارگذاری کنید", "Upload your first notes"] },
    groups: [
      { title: ["مطالعه", "Study"], hrefs: ["/student", "/student?view=courses&tool=upload", "/student?view=courses&tool=practice", "/student?view=courses&tool=review", "/student/chat"] },
      { title: ["برنامه و پیشرفت", "Plan & progress"], hrefs: ["/student?view=planner", "/student?view=reports", "/student?view=groups"] },
      { title: ["یادگیری بیشتر", "Learn more"], hrefs: ["/learn", "/assistants/teacher", "/tools/math"] },
    ] },
  { id: "fitness", name: ["تناسب اندام", "Fitness"], tagline: ["برنامهٔ تمرین، تغذیه و پیشرفت", "Workouts, nutrition and progress"],
    start: { href: "/fitness", label: ["برنامهٔ تمرینی خود را بسازید", "Build your workout plan"] },
    groups: [
      { title: ["فیت", "FIT"], hrefs: ["/fitness", "/assistants/fitness-coach", "/tools/healthy-diet"] },
    ] },
  { id: "general", name: ["همه‌کاره", "General AI"], tagline: ["گفتگو و ابزارهای روزمره", "Chat and everyday tools"],
    start: { href: "/chat", label: ["یک سؤال بپرسید", "Ask a question"] },
    groups: [
      { title: ["گفتگو و دستیارها", "Chat & assistants"], hrefs: ["/chat", "/agents", "/assistants/translator", "/assistants/teacher", "/assistants/code-expert"] },
      { title: ["ساختن", "Create"], hrefs: ["/image/generate", "/voice-studio", "/video/generate"] },
      { title: ["ابزارها", "Tools"], hrefs: ["/tools/business-ideas", "/tools/math", "/tools/healthy-diet", "/assistants/travel-agent"] },
    ] },
];

export const WORKSPACE_IDS = WORKSPACES.map(w => w.id);
export const workspaceById = (id: string | null | undefined) => WORKSPACES.find(w => w.id === id) ?? null;

/** Onboarding/growth objectives (src/lib/growth/modules.ts) mapped to workspaces. */
export const OBJECTIVE_WORKSPACE: Record<string, WorkspaceId> = {
  media: "creator", content: "creator", youtube: "creator", business: "business", crm: "business", sales: "business", seo: "business",
  real_estate: "real_estate", education: "student", fitness: "fitness", general: "general",
};

/** Plain-language synonyms (fa + en) for search, keyed by destination href. Goals, not just names. */
export const SEARCH_KEYWORDS: Record<string, string> = {
  "/chat": "سوال بپرس گفتگو چت پرسش جواب ask question chat talk assistant",
  "/agents": "ایجنت دستیار خودکار اتوماسیون agent automation bot",
  "/crm": "مشتری مدیریت مشتریان مخاطب ملک املاک پیگیری customer client contact manage customers property follow up",
  "/sales": "فروش فروشنده پیگیری فروش sales sell selling",
  "/voice-agent": "تماس تلفن منشی صوتی پاسخگو call phone receptionist voice agent",
  "/lead-gen": "لید جذب مشتری فرم مشتری جدید leads lead generation new customers form",
  "/seo": "سئو گوگل رتبه سایت seo google ranking website",
  "/seo/agent-pipeline": "مقاله بلاگ محتوا متن article blog content writing",
  "/social": "اینستاگرام ریلز پست استوری شبکه اجتماعی اتصال اینستاگرام دایرکت instagram reel reels post story social connect instagram dm",
  "/website-designer": "وبسایت سایت لندینگ صفحه website site landing page",
  "/business-doctor": "تحلیل کسب‌وکار مشکل مشاوره analyze business problem advice",
  "/ceo": "مشاور مدیرعامل استراتژی ceo strategy advisor",
  "/accounting": "حسابداری هزینه درآمد فاکتور مالیات accounting expense income invoice tax",
  "/student": "دانشجو درس مطالعه student study course",
  "/student?view=courses&tool=upload": "جزوه پی دی اف pdf آپلود خلاصه خلاصه‌سازی summarize summary upload notes document",
  "/student?view=courses&tool=practice": "آزمون کوییز تست سوال امتحان جزوه quiz test exam practice questions from pdf",
  "/student?view=courses&tool=review": "فلش کارت مرور حفظ flashcard review memorize",
  "/student?view=planner": "برنامه مطالعه امتحان زمان‌بندی study plan exam schedule planner",
  "/learn": "دوره آموزش یادگیری course learn class",
  "/image/generate": "عکس تصویر طراحی پوستر لوگو image picture photo poster logo design",
  "/video/generate": "ویدیو کلیپ فیلم video clip movie",
  "/video-factory": "ویدیو بلند یوتیوب ریلز تیزر ساخت ویدیو youtube long video reel teaser",
  "/voice-studio": "صدا گوینده نریشن صداگذاری متن به گفتار voice voiceover narration text to speech tts ai voice",
  "/music/generate": "موسیقی آهنگ music song soundtrack",
  "/image/gallery": "ساخته‌ها پروژه‌ها گالری آرشیو my projects creations gallery history",
  "/fitness": "ورزش تمرین بدنسازی باشگاه برنامه تمرینی تناسب اندام workout fitness gym exercise training plan",
  "/assistants/fitness-coach": "مربی ورزش کوچ coach trainer",
  "/tools/healthy-diet": "رژیم غذایی تغذیه کالری diet nutrition meal calorie",
  "/plans": "پلن اشتراک خرید قیمت ارتقا plan subscription upgrade price pricing",
  "/credits": "کردیت اعتبار شارژ هزینه credit credits top up balance how credits work",
  "/settings": "تنظیمات حساب پروفایل رمز settings account profile password",
  "/payments": "پرداخت فاکتور رسید payment receipt invoice",
};

/** Lightweight Persian/English normalisation for matching (no AI calls). */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[‌ً-ٟ]/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export type SearchHit = { href: string; label: string; score: number };

/**
 * Ranks destinations for a free-text goal ("I want to make a Reel",
 * "از جزوه‌ام آزمون بساز"). Every query word that appears in a destination's
 * name or keywords scores; names weigh more. Returns only real routes.
 */
export function searchDestinations(query: string, lang: "fa" | "en" | "de" | "tr", limit = 8): SearchHit[] {
  const words = normalize(query).split(" ").filter(w => w.length > 1);
  if (!words.length) return [];
  const col = { fa: 1, en: 2, de: 3, tr: 4 }[lang] as 1 | 2 | 3 | 4;
  return destinations.map(d => {
    const name = normalize(d.slice(1).join(" ")).split(" "), keys = normalize(SEARCH_KEYWORDS[d[0]] ?? "").split(" ");
    let score = 0;
    // Whole words score; a prefix ("plan" in "planner") only counts a little, so it cannot outrank an exact goal word.
    for (const w of words) {
      score += name.includes(w) ? 3 : w.length > 3 && name.some(n => n.startsWith(w)) ? 1 : 0;
      score += keys.includes(w) ? 2 : w.length > 3 && keys.some(k => k.startsWith(w)) ? 1 : 0;
    }
    return { href: d[0] as string, label: d[col] as string, score };
  }).filter(h => h.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
