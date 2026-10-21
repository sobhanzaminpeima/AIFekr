/**
 * CRM pipeline/stage/custom-field templates, keyed by IndustryPack.slug.
 * Applied once at CRM setup time (see /api/crm/pipelines POST) to seed a
 * ready-to-use pipeline instead of an empty Kanban board — the same idea as
 * IndustryPack itself, one JSON-driven definition per industry instead of a
 * table (or code path) per vertical.
 *
 * Pipeline/stage names are trilingual (fa/en/de) because they're rendered
 * to whichever language the viewer's UI is in, not fixed at creation time —
 * unlike a user's own custom-typed pipeline/stage name, which has no
 * translation and stays as typed.
 */

export interface CrmDealCustomField {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
}

export interface CrmStageTemplate {
  name: string;
  nameEn: string;
  nameDe: string;
  isWon?: boolean;
  isLost?: boolean;
}

export interface CrmIndustryTemplate {
  pipelineName: string;
  pipelineNameEn: string;
  pipelineNameDe: string;
  stages: CrmStageTemplate[];
  dealCustomFields: CrmDealCustomField[];
}

export const crmIndustryTemplates: Record<string, CrmIndustryTemplate> = {
  "real-estate": {
    pipelineName: "فروش/اجاره املاک",
    pipelineNameEn: "Property Sales/Rental",
    pipelineNameDe: "Immobilienverkauf/-vermietung",
    stages: [
      { name: "لید جدید", nameEn: "New Lead", nameDe: "Neuer Lead" },
      { name: "بازدید", nameEn: "Viewing", nameDe: "Besichtigung" },
      { name: "مذاکره", nameEn: "Negotiation", nameDe: "Verhandlung" },
      { name: "قرارداد", nameEn: "Contract", nameDe: "Vertrag" },
      { name: "تحویل", nameEn: "Handover", nameDe: "Übergabe", isWon: true },
      { name: "منصرف شد", nameEn: "Withdrew", nameDe: "Zurückgezogen", isLost: true },
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
    pipelineNameEn: "General Sales",
    pipelineNameDe: "Allgemeiner Vertrieb",
    stages: [
      { name: "تماس اولیه", nameEn: "Initial Contact", nameDe: "Erstkontakt" },
      { name: "پیش‌فاکتور", nameEn: "Proforma Invoice", nameDe: "Proforma-Rechnung" },
      { name: "فروش", nameEn: "Sold", nameDe: "Verkauft", isWon: true },
      { name: "از دست رفت", nameEn: "Lost", nameDe: "Verloren", isLost: true },
    ],
    dealCustomFields: [
      { key: "orderValue", label: "ارزش سبد خرید", type: "number" },
      { key: "channel", label: "کانال فروش", type: "select", options: ["حضوری", "اینستاگرام", "تلفنی", "وبسایت"] },
    ],
  },

  "restaurant": {
    pipelineName: "رزرو و سفارش‌های ویژه",
    pipelineNameEn: "Reservations & Special Orders",
    pipelineNameDe: "Reservierungen & Sonderbestellungen",
    stages: [
      { name: "درخواست جدید", nameEn: "New Request", nameDe: "Neue Anfrage" },
      { name: "در حال هماهنگی", nameEn: "Coordinating", nameDe: "In Abstimmung" },
      { name: "تأیید نهایی", nameEn: "Final Confirmation", nameDe: "Endgültige Bestätigung" },
      { name: "برگزار شد", nameEn: "Completed", nameDe: "Durchgeführt", isWon: true },
      { name: "لغو شد", nameEn: "Cancelled", nameDe: "Storniert", isLost: true },
    ],
    dealCustomFields: [
      { key: "eventType", label: "نوع رویداد", type: "select", options: ["رزرو میز", "جشن/مراسم", "سفارش سازمانی"] },
      { key: "guestCount", label: "تعداد نفرات", type: "number" },
      { key: "eventDate", label: "تاریخ", type: "text" },
    ],
  },

  "clinic": {
    pipelineName: "پذیرش و پیگیری بیماران",
    pipelineNameEn: "Patient Intake & Follow-up",
    pipelineNameDe: "Patientenaufnahme & Nachverfolgung",
    stages: [
      { name: "تماس اولیه", nameEn: "Initial Contact", nameDe: "Erstkontakt" },
      { name: "نوبت‌دهی", nameEn: "Appointment Set", nameDe: "Termin vereinbart" },
      { name: "ویزیت انجام شد", nameEn: "Visit Completed", nameDe: "Besuch abgeschlossen" },
      { name: "پیگیری/جلسه بعد", nameEn: "Follow-up/Next Session", nameDe: "Nachsorge/Nächste Sitzung", isWon: true },
      { name: "انصراف", nameEn: "Withdrew", nameDe: "Abgebrochen", isLost: true },
    ],
    dealCustomFields: [
      { key: "serviceType", label: "نوع خدمت", type: "text" },
      { key: "insurance", label: "بیمه", type: "select", options: ["دارد", "ندارد"] },
    ],
  },

  "law-firm": {
    pipelineName: "پرونده‌های حقوقی",
    pipelineNameEn: "Legal Cases",
    pipelineNameDe: "Rechtsfälle",
    stages: [
      { name: "مشاوره اولیه", nameEn: "Initial Consultation", nameDe: "Erstberatung" },
      { name: "بررسی مدارک", nameEn: "Document Review", nameDe: "Dokumentenprüfung" },
      { name: "قبول پرونده", nameEn: "Case Accepted", nameDe: "Fall angenommen" },
      { name: "در حال رسیدگی", nameEn: "In Progress", nameDe: "In Bearbeitung" },
      { name: "مختومه", nameEn: "Closed", nameDe: "Abgeschlossen", isWon: true },
      { name: "رد شد", nameEn: "Rejected", nameDe: "Abgelehnt", isLost: true },
    ],
    dealCustomFields: [
      { key: "caseType", label: "نوع پرونده", type: "select", options: ["حقوقی", "کیفری", "خانواده", "ملکی", "قراردادی"] },
      { key: "estimatedValue", label: "ارزش تقریبی پرونده", type: "number" },
    ],
  },

  "hotel": {
    pipelineName: "رزرو اقامت و رویداد",
    pipelineNameEn: "Stay & Event Bookings",
    pipelineNameDe: "Aufenthalts- & Veranstaltungsbuchungen",
    stages: [
      { name: "استعلام", nameEn: "Inquiry", nameDe: "Anfrage" },
      { name: "پیشنهاد قیمت", nameEn: "Quote Sent", nameDe: "Angebot gesendet" },
      { name: "رزرو قطعی", nameEn: "Confirmed Booking", nameDe: "Bestätigte Buchung", isWon: true },
      { name: "لغو شد", nameEn: "Cancelled", nameDe: "Storniert", isLost: true },
    ],
    dealCustomFields: [
      { key: "roomType", label: "نوع اتاق/سالن", type: "text" },
      { key: "checkIn", label: "تاریخ ورود", type: "text" },
      { key: "nights", label: "تعداد شب", type: "number" },
    ],
  },

  "construction": {
    pipelineName: "پروژه‌های ساخت‌وساز",
    pipelineNameEn: "Construction Projects",
    pipelineNameDe: "Bauprojekte",
    stages: [
      { name: "استعلام قیمت", nameEn: "Price Inquiry", nameDe: "Preisanfrage" },
      { name: "بازدید و برآورد", nameEn: "Site Visit & Estimate", nameDe: "Besichtigung & Kostenvoranschlag" },
      { name: "پیشنهاد قرارداد", nameEn: "Contract Proposal", nameDe: "Vertragsangebot" },
      { name: "قرارداد نهایی", nameEn: "Final Contract", nameDe: "Endgültiger Vertrag", isWon: true },
      { name: "منصرف شد", nameEn: "Withdrew", nameDe: "Zurückgezogen", isLost: true },
    ],
    dealCustomFields: [
      { key: "projectType", label: "نوع پروژه", type: "select", options: ["نوسازی", "ساخت از صفر", "بازسازی داخلی"] },
      { key: "area", label: "متراژ", type: "number" },
      { key: "budget", label: "بودجه تقریبی", type: "number" },
    ],
  },

  "university": {
    pipelineName: "پذیرش دانشجو/آموزش‌گیرنده",
    pipelineNameEn: "Student/Trainee Admissions",
    pipelineNameDe: "Studenten-/Teilnehmerzulassung",
    stages: [
      { name: "درخواست اطلاعات", nameEn: "Information Request", nameDe: "Informationsanfrage" },
      { name: "مشاوره ثبت‌نام", nameEn: "Enrollment Consultation", nameDe: "Anmeldeberatung" },
      { name: "ثبت‌نام قطعی", nameEn: "Confirmed Enrollment", nameDe: "Bestätigte Anmeldung", isWon: true },
      { name: "انصراف", nameEn: "Withdrew", nameDe: "Abgebrochen", isLost: true },
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
  pipelineNameEn: "General Sales",
  pipelineNameDe: "Allgemeiner Vertrieb",
  stages: [
    { name: "لید جدید", nameEn: "New Lead", nameDe: "Neuer Lead" },
    { name: "در تماس", nameEn: "In Contact", nameDe: "In Kontakt" },
    { name: "پیشنهاد ارسال شد", nameEn: "Proposal Sent", nameDe: "Angebot gesendet" },
    { name: "برنده شد", nameEn: "Won", nameDe: "Gewonnen", isWon: true },
    { name: "از دست رفت", nameEn: "Lost", nameDe: "Verloren", isLost: true },
  ],
  dealCustomFields: [],
};

export function getCrmTemplate(industrySlug: string | null | undefined): CrmIndustryTemplate {
  if (!industrySlug) return defaultCrmTemplate;
  return crmIndustryTemplates[industrySlug] || defaultCrmTemplate;
}
