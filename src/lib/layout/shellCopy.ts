import type { Lang } from "@/lib/i18n/server";
import en from "@/lib/i18n/en";
import fa from "@/lib/i18n/fa";
import de from "@/lib/i18n/de";
import tr from "@/lib/i18n/tr";
import { SUPPORT_WIDGET_COPY } from "@/lib/orchestrator/support/widgetCopy";
import { SUPPORT_COLOR, SUPPORT_TINT, supportAssistantInitial } from "@/lib/orchestrator/support/identity";

/**
 * The app frame's wording for the new design: the classic frame's own strings
 * (Sidebar, MobileNavShell, TrialBanner, SubscriptionGate, PendingPaymentNotice,
 * SessionWatchdog, WorkspaceHeader/Guide/Home, CommandPalette), copied
 * verbatim. shellCopy.test.ts fails if any of them stops matching the classic
 * source, so the two designs cannot drift apart. "{n}" marks a number.
 */
type Four = readonly [string, string, string, string];

const COPY = {
  newChat: ["گفتگوی جدید", "New Chat", "Neuer Chat", "Yeni Sohbet"],
  home: ["خانه", "Home", "Startseite", "Ana Sayfa"],
  fit: ["فیتنس آی‌فکر", "AIFekr FIT", "AIFekr FIT", "AIFekr FIT"],
  payments: ["پرداخت‌ها و فعال‌سازی", "Payments & activation", "Zahlungen und Aktivierung", "Ödemeler ve etkinleştirme"],
  myBusiness: ["کسب‌وکار من", "My Business", "Mein Unternehmen", "İşletmem"],
  businessDoctorSub: ["تحلیل رایگان کسب‌وکار", "Free business check-up", "Gratis Business-Check", "Ücretsiz işletme kontrolü"],
  seoIntelSub: ["داده‌های واقعی، رتبه و بک‌لینک", "Real data, rankings and backlinks", "Echte Daten, Rankings und Backlinks", "Gerçek veriler, sıralama ve geri bağlantılar"],
  growBusiness: ["رشد کسب‌وکارت", "Grow Your Business", "Ihr Geschäft ausbauen", "İşletmenizi Büyütün"],
  agentPacks: ["بسته‌های ایجنت AI", "AI Agent Packs", "KI-Agenten-Pakete", "Yapay Zeka Ajan Paketleri"],
  create: ["ساخت محتوا", "Create", "Erstellen", "Oluştur"],
  myAgents: ["ایجنت‌های من", "My Agents", "Meine Agenten", "Ajanlarım"],
  videoFactory: ["کارخانه ویدیو", "Video Factory", "Video Factory", "Video Fabrikası"],
  voiceStudio: ["استودیوی صدا", "Voice Studio", "Sprachstudio", "Ses Stüdyosu"],
  play: ["بازی‌های آی‌فکر", "AIFekr PLAY", "AIFekr PLAY", "AIFekr PLAY"],
  more: ["بیشتر", "More", "Mehr", "Daha Fazla"],
  projects: ["پروژه‌ها", "Projects", "Projekte", "Projeler"],
  newProject: ["پروژه جدید", "New project", "Neues Projekt", "Yeni proje"],
  projectName: ["نام پروژه...", "Project name…", "Projektname…", "Proje adı…"],
  delete: ["حذف", "Delete", "Löschen", "Sil"],
  rename: ["تغییر نام", "Rename", "Umbenennen", "Yeniden Adlandır"],
  newName: ["نام جدید:", "New name:", "Neuer Name:", "Yeni ad:"],
  newChatInProject: ["چت جدید در پروژه", "New chat in project", "Neuer Chat im Projekt", "Projede yeni sohbet"],
  untitled: ["بی‌نام", "Untitled", "Ohne Titel", "Başlıksız"],
  removeFromProject: ["خارج از پروژه", "Remove from project", "Aus Projekt entfernen", "Projeden çıkar"],
  deleteChat: ["حذف گفتگو", "Delete chat", "Chat löschen", "Sohbeti sil"],
  noChatsYet: ["هنوز چتی ندارد", "No chats yet", "Noch keine Chats", "Henüz sohbet yok"],
  untitledChat: ["گفتگوی بی‌نام", "Untitled Chat", "Chat ohne Titel", "Başlıksız Sohbet"],
  moveToProject: ["انتقال به پروژه", "Move to project", "In Projekt verschieben", "Projeye taşı"],
  noProjects: ["پروژه‌ای ندارید", "No projects yet", "Noch keine Projekte", "Henüz proje yok"],
  cancel: ["لغو", "Cancel", "Abbrechen", "İptal"],
  deleteChatConfirm: ["این گفتگو برای همیشه حذف بشه؟ این عمل قابل بازگشت نیست.", "Delete this chat permanently? This can't be undone.", "Diesen Chat dauerhaft löschen? Das kann nicht rückgängig gemacht werden.", "Bu sohbet kalıcı olarak silinsin mi? Bu işlem geri alınamaz."],
  credits: ["اعتبار", "credits", "Credits", "kredi"],
  businessPlans: ["بسته‌های کسب‌وکار", "Business Plans", "Business-Pakete", "İşletme Planları"],
  invite: ["دعوت کن، اعتبار بگیر", "Invite & Earn", "Einladen & verdienen", "Davet Et, Kredi Kazan"],
  // Mobile frame
  mobileChat: ["چت", "Chat", "Chat", "Sohbet"],
  mobileHome: ["خانه", "Home", "Start", "Ana sayfa"],
  mobileAgents: ["ایجنت‌ها", "Agents", "Agenten", "Ajanlar"],
  mobileGallery: ["ساخته‌های من", "My creations", "Meine Werke", "Eserlerim"],
  mobileSettings: ["تنظیمات", "Settings", "Einstellungen", "Ayarlar"],
  openMenu: ["باز کردن منو", "Open menu", "Menü öffnen", "Menüyü aç"],
  closeMenu: ["بستن منو", "Close menu", "Menü schließen", "Menüyü kapat"],
  workspaceMenu: ["منوی پلتفرم", "Workspace menu", "Arbeitsbereich-Menü", "Çalışma alanı menüsü"],
  skip: ["رفتن به محتوا", "Skip to content", "Zum Inhalt", "İçeriğe geç"],
  // Header, command palette, page guide
  breadcrumb: ["مسیر فعلی", "Breadcrumb", "Navigationspfad", "Gezinti yolu"],
  checkout: ["پرداخت", "Checkout", "Zahlung", "Ödeme"],
  searchPlatform: ["جستجوی بخش‌های پلتفرم", "Search platform", "Plattform durchsuchen", "Platformda ara"],
  searchShort: ["جستجو…", "Search…", "Suchen…", "Ara…"],
  searchField: ["نام بخش یا ابزار", "Section or tool name", "Bereich oder Werkzeug", "Bölüm veya araç adı"],
  searchPlaceholder: ["چه کاری می‌خواهید انجام دهید؟ مثلاً «ساخت ریلز» یا «آزمون از جزوه»", "What do you want to do? e.g. “make a Reel” or “quiz from my PDF”", "Was möchten Sie tun? z. B. „Reel erstellen“", "Ne yapmak istiyorsunuz? örn. “Reel yap”"],
  noMatches: ["چیزی یافت نشد.", "No matches.", "Keine Treffer.", "Eşleşme yok."],
  pageGuide: ["راهنمای این بخش", "Guide for this page", "Hilfe zu dieser Seite", "Bu sayfa için rehber"],
  relatedTools: ["ابزارهای مرتبط", "Related tools", "Passende Tools", "İlgili araçlar"],
  // Banners
  pendingPayments: ["{n} سفارش در انتظار؛ پیگیری پرداخت و فعال‌سازی", "{n} pending orders · track payment & activation", "{n} offene Bestellungen · Zahlung und Aktivierung verfolgen", "{n} bekleyen sipariş · ödeme ve onayı takip et"],
  trialExpired: ["این یک اکانت آزمایشی است و مدت آن به پایان رسیده — اطلاعات کسب‌وکار شما ذخیره شده و در صورت ارتقا به حساب حرفه‌ای بازگردانده می‌شود.", "This is a trial account and it has expired — your business data has been saved and will be restored if you upgrade to a paid plan.", "Dies ist ein Testkonto und die Testphase ist abgelaufen — Ihre Geschäftsdaten wurden gespeichert und werden bei einem Upgrade auf einen bezahlten Plan wiederhergestellt.", "Bu bir deneme hesabıdır ve süresi doldu — işletme bilgileriniz kaydedildi ve ücretli bir plana yükselttiğinizde geri yüklenecek."],
  trialLeftLimited: ["این یک اکانت آزمایشی است — {n} روز باقی‌مانده (ساخت ویدیو و طراحی وبسایت در این پکیج غیرفعال است)", "This is a trial account — {n} days left (Video Generator and Website Designer are disabled in this package)", "Dies ist ein Testkonto — noch {n} Tage (Video-Generator und Website-Designer sind in diesem Paket deaktiviert)", "Bu bir deneme hesabıdır — {n} gün kaldı (bu pakette Video Oluşturucu ve Web Sitesi Tasarımcısı devre dışı)"],
  trialLeft: ["این یک اکانت آزمایشی است — {n} روز باقی‌مانده", "This is a trial account — {n} days left", "Dies ist ein Testkonto — noch {n} Tage", "Bu bir deneme hesabıdır — {n} gün kaldı"],
  upgrade: ["ارتقا", "Upgrade", "Upgraden", "Yükselt"],
  expiredTitle: ["اشتراک شما منقضی شده است", "Your subscription has expired", "Ihr Abonnement ist abgelaufen", "Aboneliğiniz sona erdi"],
  expiredBody: ["چت و سایر امکانات تا تمدید پکیج غیرفعال هستند. اطلاعات و کریدت باقی‌ماندهٔ شما محفوظ است.", "Chat and other features are paused until renewal. Your data and remaining credits are retained.", "Chat und Funktionen sind bis zur Verlängerung pausiert. Daten und Credits bleiben erhalten.", "Sohbet ve özellikler yenilemeye kadar duraklatıldı. Verileriniz ve krediniz korunur."],
  renew: ["تمدید پکیج", "Renew package", "Paket verlängern", "Paketi yenile"],
  trackPayment: ["پیگیری پرداخت قبلی", "Track existing payment", "Bestehende Zahlung verfolgen", "Mevcut ödemeyi takip et"],
  // Organization switcher ("{name}" is the business)
  orgHeader: ["سازمان و کسب‌وکار", "ORGANIZATION & BUSINESS", "ORGANISATION & UNTERNEHMEN", "ORGANİZASYON VE İŞLETME"],
  deleteBusiness: ["حذف کسب‌وکار", "Delete business", "Unternehmen löschen", "İşletmeyi sil"],
  deleteBusinessWarning: ["این عمل غیرقابل بازگشت است. تمام اطلاعات «{name}» شامل مخاطبین، معاملات، حسابداری، تاریخچهٔ چت، شبکه‌های اجتماعی و سئو برای همیشه حذف می‌شود. برای تأیید، نام کسب‌وکار را دقیقاً وارد کنید.", "This cannot be undone. All data for \"{name}\" -- contacts, deals, accounting, chat history, social media and SEO -- will be permanently deleted. Type the business name exactly to confirm.", "Dies kann nicht rückgängig gemacht werden. Alle Daten für \"{name}\" -- Kontakte, Deals, Buchhaltung, Chatverlauf, Social Media und SEO -- werden dauerhaft gelöscht. Geben Sie den Namen zur Bestätigung genau ein.", "Bu geri alınamaz. \"{name}\" için tüm veriler -- kişiler, anlaşmalar, muhasebe, sohbet geçmişi, sosyal medya ve SEO -- kalıcı olarak silinecek. Onaylamak için işletme adını tam olarak yazın."],
  deleteFailed: ["حذف انجام نشد", "Deletion failed", "Löschen fehlgeschlagen", "Silme başarısız"],
  networkError: ["خطا در ارتباط با سرور", "Network error", "Netzwerkfehler", "Ağ hatası"],
  dismiss: ["انصراف", "Cancel", "Abbrechen", "İptal"],
  deletePermanently: ["حذف همیشگی", "Delete permanently", "Endgültig löschen", "Kalıcı olarak sil"],
  addBusiness: ["افزودن کسب‌وکار", "Add business", "Unternehmen hinzufügen", "İşletme ekle"],
  // Student study timer
  timerLabel: ["زمان‌سنج مطالعهٔ فعال", "Active study timer", "Aktiver Lerntimer", "Etkin çalışma sayacı"],
  timerPaused: ["مطالعه متوقف موقت", "Study paused", "Lernen pausiert", "Çalışma duraklatıldı"],
  timerRunning: ["در حال مطالعه", "Studying", "Lernen läuft", "Çalışılıyor"],
  timerResumeLabel: ["ادامهٔ مطالعه", "Resume studying", "Lernen fortsetzen", "Çalışmaya devam et"],
  timerPauseLabel: ["توقف موقت مطالعه", "Pause studying", "Lernen pausieren", "Çalışmayı duraklat"],
  timerResume: ["ادامه", "Resume", "Fortsetzen", "Devam"],
  timerPause: ["مکث", "Pause", "Pause", "Duraklat"],
  timerStopLabel: ["پایان جلسهٔ مطالعه", "End study session", "Lernsitzung beenden", "Çalışma oturumunu bitir"],
  timerStop: ["پایان", "Finish", "Beenden", "Bitir"],
  // Pull to refresh
  refreshing: ["در حال تازه‌سازی…", "Refreshing…", "Wird aktualisiert…", "Yenileniyor…"],
  releaseToRefresh: ["برای تازه‌سازی رها کن", "Release to refresh", "Zum Aktualisieren loslassen", "Yenilemek için bırak"],
  // Page that failed to load (components/layout/WorkspaceError)
  loadErrorTitle: ["این بخش بارگذاری نشد", "This section couldn't load", "Dieser Bereich konnte nicht geladen werden", "Bu bölüm yüklenemedi"],
  loadErrorBody: ["دوباره تلاش کنید یا به خانه برگردید.", "Try again or return to your workspace home.", "Versuchen Sie es erneut oder kehren Sie zur Startseite zurück.", "Tekrar deneyin veya ana sayfaya dönün."],
  tryAgain: ["تلاش مجدد", "Try again", "Erneut versuchen", "Tekrar dene"],
  loadErrorHome: ["خانه", "Home", "Startseite", "Ana sayfa"],
  sessionExpired: ["نشست شما منقضی شده است. در حال انتقال به صفحهٔ ورود...", "Your session has expired. Redirecting you to sign in...", "Ihre Sitzung ist abgelaufen. Sie werden zur Anmeldung weitergeleitet...", "Your session has expired. Redirecting you to sign in..."],
} as const satisfies Record<string, Four>;

const TOOLS: [string, Four][] = [
  ["/tools/business-ideas", ["ایده کسب‌وکار", "Business Ideas", "Geschäftsideen", "İş Fikirleri"]],
  ["/tools/trading", ["تحلیل بازار", "Market Analysis", "Marktanalyse", "Pazar Analizi"]],
  ["/tools/drop-shipping", ["دراپشیپینگ", "Dropshipping", "Dropshipping", "Stoksuz Satış"]],
  ["/tools/math", ["حل ریاضیات", "Math Solver", "Mathe-Löser", "Matematik Çözücü"]],
  ["/tools/healthy-diet", ["برنامه غذایی", "Diet Plan", "Ernährungsplan", "Diyet Planı"]],
  ["/tools/try-free-ai", ["امتحان AI رایگان (آزمایشی)", "Try Free AI (Experimental)", "Kostenlose KI testen (experimentell)", "Ücretsiz Yapay Zekayı Dene (Deneysel)"]],
];
const ASSISTANTS: [string, Four][] = [
  ["/assistants/teacher", ["معلم", "Teacher", "Lehrer", "Öğretmen"]],
  ["/assistants/doctor", ["پزشک", "Doctor", "Arzt", "Doktor"]],
  ["/assistants/translator", ["مترجم", "Translator", "Übersetzer", "Çevirmen"]],
  ["/assistants/cooking", ["آشپز", "Chef", "Koch", "Şef"]],
  ["/assistants/fitness-coach", ["مربی بدنسازی", "Fitness Coach", "Fitnesstrainer", "Fitness Koçu"]],
  ["/assistants/travel-agent", ["مشاور سفر", "Travel Agent", "Reiseberater", "Seyahat Acentesi"]],
  ["/assistants/code-expert", ["کارشناس کد", "Code Expert", "Code-Experte", "Kod Uzmanı"]],
];
const PLAN_NAMES: Record<string, Four> = {
  FREE: ["رایگان", "Free", "Kostenlos", "Ücretsiz"],
  BASIC: ["پایه", "Basic", "Basis", "Temel"],
  PRO: ["حرفه‌ای", "Pro", "Pro", "Pro"],
  TEAM: ["تیمی", "Team", "Team", "Takım"],
};

const COL: Record<Lang, number> = { fa: 0, en: 1, de: 2, tr: 3 };
const DICTIONARIES = { fa, en, de, tr };

export function shellCopy(lang: Lang) {
  const pick = (v: Four) => v[COL[lang]];
  const copy = Object.fromEntries(Object.entries(COPY).map(([k, v]) => [k, pick(v)])) as { [K in keyof typeof COPY]: string };
  return {
    ...copy,
    // The classic sidebar's FIT label is Persian only in fa.
    fit: lang === "fa" ? COPY.fit[0] : COPY.fit[1],
    nav: DICTIONARIES[lang].nav,
    notifications: DICTIONARIES[lang].notifications,
    support: { ...SUPPORT_WIDGET_COPY[lang], initial: supportAssistantInitial(lang), color: SUPPORT_COLOR, tint: SUPPORT_TINT },
    tools: TOOLS.map(([href, label]) => ({ href, label: pick(label) })),
    assistants: ASSISTANTS.map(([href, label]) => ({ href, label: pick(label) })),
    planNames: Object.fromEntries(Object.entries(PLAN_NAMES).map(([k, v]) => [k, pick(v)])) as Record<string, string>,
  };
}

/** For the drift test. */
export const SHELL_COPY_SOURCE = { COPY, TOOLS, ASSISTANTS, PLAN_NAMES };
