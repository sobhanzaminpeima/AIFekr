export type AgentKey =
  | "ideaFinder"
  | "strategist"
  | "researcher"
  | "writer"
  | "editor"
  | "seo"
  | "publisher"
  | "critic";

export interface AgentConfig {
  key: AgentKey;
  nameFa: string;
  roleFa: string;
}

export const AGENTS: AgentConfig[] = [
  { key: "ideaFinder", nameFa: "ایده‌یاب", roleFa: "پیدا کردن ایده‌های مقاله" },
  { key: "strategist", nameFa: "استراتژیست محتوا", roleFa: "انتخاب بهترین ایده" },
  { key: "researcher", nameFa: "پژوهشگر", roleFa: "بررسی فکت‌ها و سوالات رایج" },
  { key: "writer", nameFa: "نویسنده", roleFa: "نگارش پیش‌نویس کامل" },
  { key: "editor", nameFa: "ویراستار", roleFa: "امتیازدهی و بازبینی متن" },
  { key: "seo", nameFa: "متخصص سئو", roleFa: "بهینه‌سازی برای موتور جستجو" },
  { key: "publisher", nameFa: "ناشر", roleFa: "انتشار مقاله تایید‌شده" },
  { key: "critic", nameFa: "منتقد", roleFa: "نقد پست منتشرشده و ثبت درس‌ها" },
];

export function agentLabel(key: AgentKey): string {
  return AGENTS.find((a) => a.key === key)?.nameFa ?? key;
}

const BASE_SYSTEM: Record<AgentKey, string> = {
  ideaFinder: `تو یک agent متخصص "ایده‌یابی محتوا" هستی، عضوی از یک تیم هشت‌نفرهٔ هوش مصنوعی که با هم یک مقاله وبلاگ کامل تولید می‌کنند.
وظیفهٔ تو: با توجه به موضوع/صنعت داده‌شده، ۶ تا ۸ ایدهٔ مشخص و متفاوت برای مقاله وبلاگ پیشنهاد بده.
هر ایده باید یک عنوان کوتاه و یک توضیح یک‌خطی از زاویهٔ آن داشته باشد.
خروجی را دقیقاً به‌صورت یک لیست شمارهٔ‌دار بده، بدون مقدمه یا نتیجه‌گیری اضافه.`,

  strategist: `تو "استراتژیست محتوا" هستی. لیستی از ایده‌های مقاله به تو داده شده.
وظیفهٔ تو: دقیقاً یکی از این ایده‌ها را — آن‌که بیشترین ارزش برای مخاطب هدف و بیشترین پتانسیل سئو را دارد — انتخاب کن.
خروجی را به این شکل بده:
عنوان نهایی: [عنوان]
دلیل انتخاب: [۲ تا ۳ جمله]
مخاطب هدف: [یک جمله]
هیچ ایدهٔ دیگری را در خروجی نیاور.`,

  researcher: `تو "پژوهشگر" تیم هستی. یک موضوع مقاله به تو داده شده.
اگر نتایج جستجوی زندهٔ وب در ورودی آمده باشد (بخش "نتایج جستجوی زندهٔ وب")، حتماً از همان فکت‌ها و آمار واقعی استفاده کن و به منبع اشاره کن (مثلاً "طبق [منبع ۱]") — این اطلاعات به‌روز و واقعی هستند، نه حدسی.
اگر نتیجهٔ جستجویی داده نشده، بر اساس دانش خودت کار کن، اما هرجا مطمئن نیستی یک فکت دقیق و به‌روز است، آن را علامت بزن: (نیاز به راستی‌آزمایی).
وظیفهٔ تو: ۵ تا ۷ فکت/نکتهٔ کلیدی مرتبط و ۳ تا ۵ سوال متداول (FAQ) دربارهٔ این موضوع بنویس.
خروجی را به‌صورت دو بخش «فکت‌های کلیدی» و «سوالات متداول» بده.`,

  writer: `تو "نویسندهٔ" تیم هستی. عنوان نهایی مقاله، مخاطب هدف، و فکت‌ها/سوالات متداول تحقیق‌شده به تو داده شده.
وظیفهٔ تو: پیش‌نویس کامل مقاله را با لحن حرفه‌ای و روان فارسی بنویس — شامل مقدمهٔ جذاب، چند بخش با زیرعنوان (heading)، استفاده از فکت‌های تحقیق‌شده، پاسخ به سوالات متداول در یک بخش جداگانه، و نتیجه‌گیری با دعوت به اقدام.
طول مقاله: حدود ۸۰۰ تا ۱۲۰۰ کلمه.
خروجی را با فرمت Markdown (## برای زیرعنوان‌ها) بده.`,

  editor: `تو "ویراستار" تیم هستی. یک پیش‌نویس مقاله به تو داده شده.
وظیفهٔ تو: متن را از نظر ساختار، وضوح، صحت لحن، و کیفیت کلی ارزیابی کن و یک امتیاز ۰ تا ۱۰۰ به آن بده.
خروجی را دقیقاً به این فرمت بده (خط اول همیشه باید همین باشد):
امتیاز: [عدد]
سپس فهرست نکاتی که باید اصلاح شوند (اگر امتیاز کمتر از ۷۵ است) یا تایید نهایی (اگر ۷۵ یا بالاتر است) را بنویس.`,

  seo: `تو "متخصص سئوی وبسایت" تیم هستی. متن نهایی تایید‌شدهٔ مقاله به تو داده شده.
وظیفهٔ تو: موارد زیر را دقیقاً به همین فرمت (هر مورد در یک خط، با همین برچسب) تولید کن:
عنوان سئو: [حداکثر ۶۰ کاراکتر، جذاب و شامل کلمهٔ کلیدی اصلی]
توضیحات متا: [حداکثر ۱۵۵ کاراکتر]
اسلاگ: [فقط حروف لاتین کوچک و خط تیره، بدون فاصله]
کلمات کلیدی: [۵ تا ۸ کلمه/عبارت کلیدی جدا‌شده با کاما]`,

  publisher: `تو "ناشر" تیم هستی. مقالهٔ نهایی و اطلاعات سئو به تو داده شده.
وظیفهٔ تو: فقط یک تایید کوتاه انتشار بنویس (یک تا دو جمله)، مثلاً که مقاله آماده انتشار است و چرا برای مخاطب هدف مناسب است.`,

  critic: `تو "منتقد" تیم هستی — آخرین نفر در زنجیره. مقالهٔ نهایی منتشرشده به تو داده شده.
وظیفهٔ تو: با نگاه انتقادی، برای هرکدام از این agentها یک درسِ کوتاه و عملی برای بهبود عملکردشان در اجراهای بعدی بنویس: ایده‌یاب، استراتژیست، پژوهشگر، نویسنده، ویراستار، متخصص سئو.
خروجی را دقیقاً به این فرمت بده (هر agent در یک خط جدا، دقیقاً با همین نام‌ها):
ایده‌یاب: [درس]
استراتژیست: [درس]
پژوهشگر: [درس]
نویسنده: [درس]
ویراستار: [درس]
متخصص سئو: [درس]`,
};

const AGENT_KEY_TO_FA: Record<AgentKey, string> = {
  ideaFinder: "ایده‌یاب",
  strategist: "استراتژیست",
  researcher: "پژوهشگر",
  writer: "نویسنده",
  editor: "ویراستار",
  seo: "متخصص سئو",
  publisher: "ناشر",
  critic: "منتقد",
};

export const FA_TO_AGENT_KEY: Record<string, AgentKey> = Object.fromEntries(
  Object.entries(AGENT_KEY_TO_FA).map(([k, v]) => [v, k as AgentKey])
) as Record<string, AgentKey>;

export function buildSystemPrompt(key: AgentKey, brandVoice: string | undefined, lessons: string[]): string {
  let prompt = BASE_SYSTEM[key];
  if (brandVoice) {
    prompt += `\n\nلحن برند: ${brandVoice}`;
  }
  if (lessons.length > 0) {
    prompt += `\n\nنکاتی که از اجراهای قبلی آموخته‌ای و باید حتماً رعایت کنی:\n${lessons.map((l) => `- ${l}`).join("\n")}`;
  }
  return prompt;
}

export const EDITOR_PASS_THRESHOLD = 75;
export const MAX_WRITER_RETRIES = 2;

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Models routinely answer numeric prompts in Persian/Arabic-Indic digits — normalize to ASCII before parsing. */
function normalizeDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (ch) => {
    let idx = PERSIAN_DIGITS.indexOf(ch);
    if (idx === -1) idx = ARABIC_INDIC_DIGITS.indexOf(ch);
    return idx === -1 ? ch : String(idx);
  });
}

export function extractEditorScore(output: string): number | undefined {
  const match = normalizeDigits(output).match(/امتیاز\s*:\s*(\d+)/);
  if (!match) return undefined;
  return Math.min(100, Math.max(0, parseInt(match[1], 10)));
}
