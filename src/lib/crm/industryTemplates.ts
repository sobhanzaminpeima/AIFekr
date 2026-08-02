/**
 * CRM pipeline/stage/custom-field templates, keyed by IndustryPack.slug.
 * Applied once at CRM setup time (see /api/crm/pipelines POST) to seed a
 * ready-to-use pipeline instead of an empty Kanban board — the same idea as
 * IndustryPack itself, one JSON-driven definition per industry instead of a
 * table (or code path) per vertical.
 */

export interface CrmDealCustomField {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
}

export interface CrmStageTemplate {
  name: string;
  isWon?: boolean;
  isLost?: boolean;
}

export interface CrmIndustryTemplate {
  pipelineName: string;
  stages: CrmStageTemplate[];
  dealCustomFields: CrmDealCustomField[];
}

export const crmIndustryTemplates: Record<string, CrmIndustryTemplate> = {
  "real-estate": {
    pipelineName: "فروش/اجاره املاک",
    stages: [
      { name: "لید جدید" },
      { name: "بازدید" },
      { name: "مذاکره" },
      { name: "قرارداد" },
      { name: "تحویل", isWon: true },
      { name: "منصرف شد", isLost: true },
    ],
    dealCustomFields: [
      { key: "propertyType", label: "نوع ملک", type: "select", options: ["آپارتمان", "ویلا", "زمین", "تجاری"] },
      { key: "area", label: "متراژ", type: "number" },
      { key: "dealType", label: "نوع معامله", type: "select", options: ["رهن", "اجاره", "فروش"] },
      { key: "address", label: "آدرس", type: "text" },
    ],
  },

  "ecommerce": {
    pipelineName: "فروش عمومی",
    stages: [
      { name: "تماس اولیه" },
      { name: "پیش‌فاکتور" },
      { name: "فروش", isWon: true },
      { name: "از دست رفت", isLost: true },
    ],
    dealCustomFields: [
      { key: "orderValue", label: "ارزش سبد خرید", type: "number" },
      { key: "channel", label: "کانال فروش", type: "select", options: ["حضوری", "اینستاگرام", "تلفنی", "وبسایت"] },
    ],
  },

  "restaurant": {
    pipelineName: "رزرو و سفارش‌های ویژه",
    stages: [
      { name: "درخواست جدید" },
      { name: "در حال هماهنگی" },
      { name: "تأیید نهایی" },
      { name: "برگزار شد", isWon: true },
      { name: "لغو شد", isLost: true },
    ],
    dealCustomFields: [
      { key: "eventType", label: "نوع رویداد", type: "select", options: ["رزرو میز", "جشن/مراسم", "سفارش سازمانی"] },
      { key: "guestCount", label: "تعداد نفرات", type: "number" },
      { key: "eventDate", label: "تاریخ", type: "text" },
    ],
  },

  "clinic": {
    pipelineName: "پذیرش و پیگیری بیماران",
    stages: [
      { name: "تماس اولیه" },
      { name: "نوبت‌دهی" },
      { name: "ویزیت انجام شد" },
      { name: "پیگیری/جلسه بعد", isWon: true },
      { name: "انصراف", isLost: true },
    ],
    dealCustomFields: [
      { key: "serviceType", label: "نوع خدمت", type: "text" },
      { key: "insurance", label: "بیمه", type: "select", options: ["دارد", "ندارد"] },
    ],
  },

  "law-firm": {
    pipelineName: "پرونده‌های حقوقی",
    stages: [
      { name: "مشاوره اولیه" },
      { name: "بررسی مدارک" },
      { name: "قبول پرونده" },
      { name: "در حال رسیدگی" },
      { name: "مختومه", isWon: true },
      { name: "رد شد", isLost: true },
    ],
    dealCustomFields: [
      { key: "caseType", label: "نوع پرونده", type: "select", options: ["حقوقی", "کیفری", "خانواده", "ملکی", "قراردادی"] },
      { key: "estimatedValue", label: "ارزش تقریبی پرونده", type: "number" },
    ],
  },

  "hotel": {
    pipelineName: "رزرو اقامت و رویداد",
    stages: [
      { name: "استعلام" },
      { name: "پیشنهاد قیمت" },
      { name: "رزرو قطعی", isWon: true },
      { name: "لغو شد", isLost: true },
    ],
    dealCustomFields: [
      { key: "roomType", label: "نوع اتاق/سالن", type: "text" },
      { key: "checkIn", label: "تاریخ ورود", type: "text" },
      { key: "nights", label: "تعداد شب", type: "number" },
    ],
  },

  "construction": {
    pipelineName: "پروژه‌های ساخت‌وساز",
    stages: [
      { name: "استعلام قیمت" },
      { name: "بازدید و برآورد" },
      { name: "پیشنهاد قرارداد" },
      { name: "قرارداد نهایی", isWon: true },
      { name: "منصرف شد", isLost: true },
    ],
    dealCustomFields: [
      { key: "projectType", label: "نوع پروژه", type: "select", options: ["نوسازی", "ساخت از صفر", "بازسازی داخلی"] },
      { key: "area", label: "متراژ", type: "number" },
      { key: "budget", label: "بودجه تقریبی", type: "number" },
    ],
  },

  "university": {
    pipelineName: "پذیرش دانشجو/آموزش‌گیرنده",
    stages: [
      { name: "درخواست اطلاعات" },
      { name: "مشاوره ثبت‌نام" },
      { name: "ثبت‌نام قطعی", isWon: true },
      { name: "انصراف", isLost: true },
    ],
    dealCustomFields: [
      { key: "program", label: "دوره/رشته", type: "text" },
      { key: "term", label: "ترم/دوره", type: "text" },
    ],
  },
};

/** Falls back to a generic sales pipeline for users without a matching industry pack. */
export const defaultCrmTemplate: CrmIndustryTemplate = {
  pipelineName: "فروش عمومی",
  stages: [
    { name: "لید جدید" },
    { name: "در تماس" },
    { name: "پیشنهاد ارسال شد" },
    { name: "برنده شد", isWon: true },
    { name: "از دست رفت", isLost: true },
  ],
  dealCustomFields: [],
};

export function getCrmTemplate(industrySlug: string | null | undefined): CrmIndustryTemplate {
  if (!industrySlug) return defaultCrmTemplate;
  return crmIndustryTemplates[industrySlug] || defaultCrmTemplate;
}
