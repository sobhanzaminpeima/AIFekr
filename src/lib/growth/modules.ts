/**
 * Module activation registry for the growth engine. Client-safe (no DB).
 * `firstValue` names the authoritative evidence the engine reads in facts.ts
 * -- a row that only exists after a real success, never a click.
 * `registryKey` links to ModuleRegistry / MODULE_ROUTE_PREFIXES so a module
 * an admin disabled is never recommended.
 */
export type Copy2 = [fa: string, en: string];
export type GrowthModule = {
  id: string;
  registryKey: string | null;
  name: Copy2;
  paths: string[];
  /** The page that opens the module when its first path is only a prefix (/image has no page). */
  entry?: string;
  /** What the module does for the user, in plain words (shown instead of a bare module name). */
  benefit: Copy2;
  /** Public landing page used by campaigns. */
  landingPath: string;
  firstValue: Copy2;
  exampleTask: Copy2;
  nextStep: Copy2;
  objectives: string[];
};

export const GROWTH_MODULES: GrowthModule[] = [
  { id: "voice-studio", benefit: ["متن را به صدای طبیعی و حرفه‌ای تبدیل کنید", "Turn any text into natural, professional speech"], registryKey: "voice-studio", name: ["استودیوی صدا", "Voice Studio"], paths: ["/voice-studio"], landingPath: "/features/voice-studio",
    firstValue: ["اولین فایل صوتی آماده", "First ready audio file"], exampleTask: ["یک جملهٔ معرفی کسب‌وکارتان را به صدای طبیعی تبدیل کنید", "Turn one sentence about your business into natural speech"],
    nextStep: ["همان متن را با صدای دیگری بسازید یا متن بلندتری بنویسید", "Try another voice or a longer script"], objectives: ["media", "content", "business"] },
  { id: "image", benefit: ["تصویر تبلیغاتی و محتوای بصری را در چند ثانیه بسازید", "Create ad images and visuals in seconds"], registryKey: "image", name: ["تولید تصویر", "Image creation"], paths: ["/image"], entry: "/image/generate", landingPath: "/features/images",
    firstValue: ["اولین تصویر ساخته‌شده", "First generated image"], exampleTask: ["یک تصویر تبلیغاتی برای محصولتان بسازید", "Create an ad image for your product"],
    nextStep: ["همان ایده را در سبک دیگری بسازید", "Recreate the idea in another style"], objectives: ["media", "content"] },
  { id: "video", benefit: ["از یک ایده یا تصویر، ویدئوی کوتاه بسازید", "Turn an idea or an image into a short video"], registryKey: "video", name: ["تولید ویدئو", "Video creation"], paths: ["/video"], entry: "/video/generate", landingPath: "/features/video",
    firstValue: ["اولین ویدئوی ساخته‌شده", "First generated video"], exampleTask: ["یک ویدئوی کوتاه پنج‌ثانیه‌ای از یک تصویر بسازید", "Make a five-second clip from an image"],
    nextStep: ["برای ویدئو موسیقی یا صدا بسازید", "Add music or a voiceover"], objectives: ["media", "content", "youtube"] },
  { id: "video-factory", benefit: ["از یک ایده تا ویدئوی کامل، با استوری‌بورد", "Go from an idea to a finished video, storyboard first"], registryKey: "video", name: ["کارخانهٔ ویدئو", "Video Factory"], paths: ["/video-factory"], landingPath: "/features/video-factory",
    firstValue: ["اولین پروژهٔ ویدئو", "First video project"], exampleTask: ["ایدهٔ یک ویدئوی آموزشی را بنویسید تا استوری‌بورد ساخته شود", "Write a video idea and get a storyboard"],
    nextStep: ["استوری‌بورد را تأیید و تولید کنید", "Approve the storyboard and produce it"], objectives: ["youtube", "content"] },
  { id: "music", benefit: ["برای محتوایتان موسیقی پس‌زمینهٔ اختصاصی بسازید", "Create original background music for your content"], registryKey: "music", name: ["تولید موسیقی", "Music creation"], paths: ["/music"], entry: "/music/generate", landingPath: "/features/video",
    firstValue: ["اولین قطعهٔ موسیقی", "First music track"], exampleTask: ["یک موسیقی پس‌زمینه برای ویدئوی محصول بسازید", "Create background music for a product video"],
    nextStep: ["آن را روی ویدئو بگذارید", "Use it in a video"], objectives: ["media"] },
  { id: "chat", benefit: ["هر سؤالی دارید بپرسید؛ نوشتن، ترجمه و ایده‌پردازی", "Ask anything: writing, translation and ideas"], registryKey: "chat", name: ["دستیار هوشمند", "AI assistant"], paths: ["/chat"], landingPath: "/features/assistant",
    firstValue: ["اولین گفتگوی کامل", "First completed conversation"], exampleTask: ["از دستیار بخواهید یک ایمیل رسمی بنویسد", "Ask the assistant to draft a formal email"],
    nextStep: ["یک ابزار تخصصی را امتحان کنید", "Try a specialised tool"], objectives: ["general", "business", "automation"] },
  { id: "crm", benefit: ["مشتریان را منظم کنید و فرصت‌های فروش را پیگیری کنید", "Organize customers and follow up on sales opportunities"], registryKey: "crm", name: ["CRM و فروش", "CRM & sales"], paths: ["/crm"], landingPath: "/features/crm",
    firstValue: ["اولین مشتری ثبت‌شده در CRM", "First contact added to the CRM"], exampleTask: ["سه مشتری فعلی‌تان را وارد کنید", "Add three of your current customers"],
    nextStep: ["یک پیگیری برای مشتری تعریف کنید", "Schedule a follow-up for a contact"], objectives: ["crm", "sales", "real_estate", "business"] },
  { id: "seo", benefit: ["سایتتان را تحلیل کنید و در گوگل بهتر دیده شوید", "Analyze your website and get found on Google"], registryKey: "seo", name: ["محتوا و سئو", "Content & SEO"], paths: ["/seo"], landingPath: "/features/content",
    firstValue: ["اولین تحلیل سئو", "First SEO analysis"], exampleTask: ["آدرس سایتتان را برای تحلیل وارد کنید", "Enter your website address for an analysis"],
    nextStep: ["برای یک کلمهٔ کلیدی محتوا بسازید", "Create content for one keyword"], objectives: ["seo", "content"] },
  { id: "social", benefit: ["پست‌ها و برنامهٔ انتشار شبکه‌های اجتماعی را آماده کنید", "Prepare social posts and a publishing plan"], registryKey: "social", name: ["شبکه‌های اجتماعی", "Social media"], paths: ["/social"], landingPath: "/features/social",
    firstValue: ["اولین پست ساخته‌شده", "First generated post"], exampleTask: ["یک پست اینستاگرام برای کسب‌وکارتان بسازید", "Create an Instagram post for your business"],
    nextStep: ["برنامهٔ انتشار هفته را بچینید", "Plan a week of posts"], objectives: ["content", "media", "business"] },
  { id: "website-designer", benefit: ["بدون کدنویسی برای کسب‌وکارتان وبسایت بسازید", "Build a website for your business without code"], registryKey: "website-designer", name: ["طراحی وبسایت", "Website designer"], paths: ["/website-designer"], landingPath: "/features/websites",
    firstValue: ["اولین وبسایت ساخته‌شده", "First generated website"], exampleTask: ["یک صفحهٔ معرفی ساده برای کسب‌وکارتان بسازید", "Build a simple landing page for your business"],
    nextStep: ["متن و تصاویر سایت را شخصی کنید", "Personalise the site copy and images"], objectives: ["business", "seo"] },
  { id: "student", benefit: ["جزوه‌ها را خلاصه کنید و با آزمون و فلش‌کارت تمرین کنید", "Summarize notes and practice with quizzes and flashcards"], registryKey: null, name: ["فضای دانشجویی", "Student workspace"], paths: ["/student"], landingPath: "/features/education",
    firstValue: ["اولین جزوه یا منبع پردازش‌شده", "First processed study material"], exampleTask: ["یک جزوه را برای خلاصه‌سازی بارگذاری کنید", "Upload a document to summarise"],
    nextStep: ["از آن فلش‌کارت یا آزمون بسازید", "Turn it into flashcards or a quiz"], objectives: ["education"] },
  { id: "fitness", benefit: ["برنامهٔ تمرین و تغذیهٔ شخصی بگیرید و پیشرفت را ثبت کنید", "Get a personal workout and nutrition plan and track progress"], registryKey: null, name: ["فیت", "Fitness"], paths: ["/fitness", "/fit"], landingPath: "/fit",
    firstValue: ["اولین پروفایل و برنامهٔ شخصی", "First personal fitness profile"], exampleTask: ["پروفایل بدنی‌تان را کامل کنید تا برنامه ساخته شود", "Complete your profile to get a plan"],
    nextStep: ["اولین تمرین را ثبت کنید", "Log your first workout"], objectives: ["fitness"] },
];

export const growthModule = (id: string | null | undefined) => GROWTH_MODULES.find(m => m.id === id) ?? null;
/** Where a link to the module goes. */
export const moduleEntry = (m: GrowthModule) => m.entry ?? m.paths[0];

export const OBJECTIVES: { id: string; label: Copy2 }[] = [
  { id: "media", label: ["ساخت تصویر، ویدئو و صدا با AI", "AI images, video and voice"] },
  { id: "content", label: ["محتوای شبکه‌های اجتماعی", "Social media content"] },
  { id: "business", label: ["اتوماسیون و بهره‌وری کسب‌وکار", "Business automation & productivity"] },
  { id: "crm", label: ["مدیریت مشتری و CRM", "CRM & customer management"] },
  { id: "sales", label: ["فروش و جذب مشتری", "Sales & lead generation"] },
  { id: "real_estate", label: ["املاک و ساختمان", "Real estate & construction"] },
  { id: "education", label: ["آموزش و درس", "Education & studying"] },
  { id: "fitness", label: ["تناسب اندام و سلامت", "Fitness & wellness"] },
  { id: "seo", label: ["سئوی وبسایت", "Website SEO"] },
  { id: "youtube", label: ["تولید ویدئوی یوتیوب", "YouTube video production"] },
  { id: "general", label: ["دستیار عمومی هوش مصنوعی", "General AI assistance"] },
];

export const PERSONAS: { id: string; label: Copy2 }[] = [
  { id: "business_owner", label: ["صاحب کسب‌وکار", "Business owner"] },
  { id: "freelancer", label: ["فریلنسر", "Freelancer"] },
  { id: "creator", label: ["تولیدکنندهٔ محتوا", "Content creator"] },
  { id: "agency", label: ["آژانس بازاریابی", "Marketing agency"] },
  { id: "student", label: ["دانشجو", "Student"] },
  { id: "real_estate", label: ["مشاور املاک", "Real estate professional"] },
  { id: "sales", label: ["فروشنده / کارشناس فروش", "Sales professional"] },
  { id: "personal", label: ["استفادهٔ شخصی", "Personal use"] },
];

export const INTENTS: { id: string; label: Copy2 }[] = [
  { id: "exploring", label: ["آشنایی با توانایی‌های AI", "Exploring AI capabilities"] },
  { id: "project", label: ["انجام یک پروژهٔ مشخص", "Completing a specific project"] },
  { id: "productivity", label: ["افزایش بهره‌وری کسب‌وکار", "Improving business productivity"] },
  { id: "automation", label: ["خودکار کردن کارهای تکراری", "Automating repetitive tasks"] },
  { id: "long_term", label: ["پیدا کردن یک پلتفرم بلندمدت", "Finding a long-term AI platform"] },
  { id: "evaluating_paid", label: ["بررسی اشتراک پولی", "Evaluating a paid subscription"] },
];

/** Recommended module for onboarding answers, restricted to modules currently reachable. */
export function recommendModule(objective: string | null | undefined, available: (m: GrowthModule) => boolean): GrowthModule | null {
  const pool = GROWTH_MODULES.filter(available);
  return pool.find(m => objective && m.objectives[0] === objective) ?? pool.find(m => objective && m.objectives.includes(objective)) ?? pool.find(m => m.id === "chat") ?? pool[0] ?? null;
}

/**
 * Up to `n` modules for several goals, primary goal first: each goal's best
 * module (as recommendModule picks it), then the remaining modules that serve
 * any goal. Never repeats a module; falls back to the assistant.
 */
export function recommendModules(goals: string[], available: (m: GrowthModule) => boolean, n = 3): GrowthModule[] {
  const pool = GROWTH_MODULES.filter(available);
  const out: GrowthModule[] = [];
  const add = (m: GrowthModule | null | undefined) => { if (m && !out.includes(m) && out.length < n) out.push(m); };
  for (const g of goals) add(recommendModule(g, m => pool.includes(m) && !out.includes(m)));
  for (const g of goals) pool.filter(m => m.objectives.includes(g)).forEach(add);
  if (!out.length) add(recommendModule(null, available));
  return out;
}

/** Comma-separated stored goals → known objective ids, in order, without repeats. */
export const parseGoals = (raw: string | null | undefined) => [...new Set((raw ?? "").split(",").filter(id => OBJECTIVES.some(o => o.id === id)))];
