import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { formatNumber } from "@/lib/utils/jalali";
import { compactAmount } from "@/lib/utils/compactAmount";
import { TEAMMATES, teammateInitial, departmentOf, type TeammateKey } from "@/lib/team/identity";
import type { homePayload } from "./homePayload";

/**
 * The classic home page ((dashboard)/home/page.tsx) as display data for the
 * new design: the same sections, order, figures, formatting and wording.
 * homeView.test.ts checks the wording against the classic page.
 */
type Payload = Awaited<ReturnType<typeof homePayload>>;
type StatKey = "activeDeals" | "pipelineValue" | "newLeadsThisWeek" | "overdueInvoiceCount" | "monthRevenue" | "upcomingViewings";
type Severity = "critical" | "warning" | "info";

export function homeView(data: Payload, lang: Lang) {
  const nf = (n: number) => formatNumber(Math.round(n), lang);
  const stats = data.stats as Record<StatKey, number>;
  const statMeta: Record<StatKey, { icon: string; label: string; value: string; exact?: string; href: string; alarm?: boolean }> = {
    activeDeals: { icon: "Briefcase", label: tri(lang, "معاملهٔ باز", "Open deals", "Offene Deals", "Açık anlaşmalar"), value: nf(stats.activeDeals), href: "/crm" },
    pipelineValue: { icon: "TrendingUp", label: tri(lang, "ارزش پایپلاین", "Pipeline value", "Pipeline-Wert", "Satış hattı değeri"), value: compactAmount(stats.pipelineValue, lang), exact: nf(stats.pipelineValue), href: "/crm" },
    newLeadsThisWeek: { icon: "Users", label: tri(lang, "لید جدید این هفته", "New leads this week", "Neue Leads diese Woche", "Bu haftaki yeni potansiyel müşteriler"), value: nf(stats.newLeadsThisWeek), href: "/crm" },
    overdueInvoiceCount: { icon: "Receipt", label: tri(lang, "فاکتور معوق", "Overdue invoices", "Überfällige Rechnungen", "Vadesi geçmiş faturalar"), value: nf(stats.overdueInvoiceCount), href: "/crm?tab=invoices", alarm: true },
    monthRevenue: { icon: "Wallet", label: tri(lang, "درآمد این ماه", "Revenue this month", "Umsatz diesen Monat", "Bu ayki gelir"), value: compactAmount(stats.monthRevenue, lang), exact: nf(stats.monthRevenue), href: "/accounting" },
    upcomingViewings: { icon: "CalendarDays", label: tri(lang, "بازدید پیش رو", "Upcoming viewings", "Anstehende Besichtigungen", "Yaklaşan görüntülemeler"), value: nf(stats.upcomingViewings), href: "/crm" },
  };
  const severityLabel = (s: Severity) => s === "critical" ? tri(lang, "فوری", "Urgent", "Dringend", "Acil") : s === "warning" ? tri(lang, "نیاز به تأیید", "Needs approval", "Freigabe nötig", "Onay gerekiyor") : tri(lang, "برنامه‌ریزی‌شده", "Scheduled", "Geplant", "Zamanlandı");
  const pack = data.industryPack;
  const student = data.studentWorkspace;
  // WorkspaceHome's own helper: Persian, else English.
  const t2 = (a: string, b: string) => tri(lang, a, b, b, b);
  return {
    workspaceCopy: {
      pickLabel: t2("انتخاب فضای کار", "Choose a workspace"),
      pickTitle: t2("برای چه کاری از AIFekr استفاده می‌کنید؟", "What do you use AIFekr for?"),
      pickBody: t2("یکی را انتخاب کنید تا منو و این صفحه فقط ابزارهای مرتبط را اول نشان دهند. هر زمان قابل تغییر است و روی پلن و کردیت اثری ندارد.", "Pick one so the menu and this page show the relevant tools first. You can change it any time; it does not affect your plan or credits."),
      eyebrow: t2("فضای کار", "Workspace"),
      credits: t2("کردیت", "credits"),
      suggested: t2("پیشنهاد برای شروع", "Suggested next step"),
      search: t2("دنبال کار دیگری هستید؟ بنویسید چه می‌خواهید…", "Looking for something else? Type what you want to do…"),
    },
    copy: {
      moduleUnavailable: tri(lang, "این بخش در حال حاضر در دسترس نیست.", "This section is currently unavailable.", "Dieser Bereich ist derzeit nicht verfügbar.", "Bu bölüm şu anda kullanılamıyor."),
      moduleMaintenance: tri(lang, "این بخش موقتاً در حال به‌روزرسانی است. کمی بعد دوباره امتحان کنید.", "This section is being updated. Please try again shortly.", "Dieser Bereich wird gerade aktualisiert. Bitte versuchen Sie es gleich noch einmal.", "Bu bölüm güncelleniyor. Lütfen birazdan tekrar deneyin."),
      title: tri(lang, "اتاق فرمان", "Command centre", "Kommandozentrale", "Komuta merkezi"),
      subtitle: tri(lang, "وضعیت کسب‌وکار شما و کارهایی که امروز نیاز به توجه دارند", "Where your business stands, and what needs you today", "Wie Ihr Geschäft steht und was heute Ihre Aufmerksamkeit braucht", "İşletmenizin durumu ve bugün sizi bekleyenler"),
      emptyTitle: tri(lang, "هنوز داده‌ای برای نمایش نیست", "Nothing to report yet", "Noch nichts zu berichten", "Henüz raporlanacak bir şey yok"),
      emptyBody: student.enabled && !data.businessAccess
        ? tri(lang, "این حساب فضای دانشجویی دارد. ابزارهای CRM و بیزنس تا زمان فعال‌سازی پلن تجاری از منو پنهان می‌مانند.", "This account has the Student Workspace. CRM and business tools stay hidden until a business plan is activated.", "Dieses Konto hat den Lernbereich. CRM- und Business-Tools bleiben bis zur Aktivierung eines Business-Tarifs verborgen.", "Bu hesapta Öğrenci Alanı var. İşletme planı etkinleşene kadar CRM ve işletme araçları gizli kalır.")
        : tri(lang, "با افزودن اولین مخاطب یا ملک، این صفحه شروع به کار می‌کند.", "Add your first contact or property and this page starts working.", "Fügen Sie Ihren ersten Kontakt oder Ihre erste Immobilie hinzu, dann füllt sich diese Seite.", "İlk kişinizi veya mülkünüzü ekleyin, bu sayfa çalışmaya başlasın."),
      emptyAction: data.businessAccess
        ? { href: "/crm", label: tri(lang, "شروع از CRM", "Start in CRM", "Mit dem CRM starten", "CRM'de başla") }
        : student.enabled ? { href: "/student#business-upgrade", label: tri(lang, "رفتن به فضای دانشجویی", "Go to Student Workspace", "Zum Lernbereich", "Öğrenci alanına git") } : null,
      statsTitle: tri(lang, "وضعیت کسب‌وکار", "Business at a glance", "Geschäft auf einen Blick", "Bir bakışta işletme"),
      attentionTitle: data.attention.length > 0
        ? tri(lang, `${formatNumber(data.attention.length, lang)} کار منتظر شماست`, `${data.attention.length} things need you`, `${data.attention.length} Dinge brauchen Sie`, `${data.attention.length} konu sizi bekliyor`)
        : tri(lang, "نیاز به توجه شما", "Needs your attention", "Braucht Ihre Aufmerksamkeit", "Dikkatinizi gerektiriyor"),
      allClear: tri(lang, "همه‌چیز مرتب است — کاری معوق نمانده.", "All clear — nothing is overdue.", "Alles erledigt — nichts ist überfällig.", "Her şey yolunda — vadesi geçen bir şey yok."),
      teamTitle: tri(lang, "تیم شما این هفته", "Your team this week", "Ihr Team diese Woche", "Bu hafta ekibiniz"),
      teamSubtitle: tri(lang, "کارهایی که بدون دخالت شما انجام شد", "Work done without you having to ask", "Arbeit, die ohne Ihr Zutun erledigt wurde", "Siz istemeden yapılan işler"),
      coreJobs: tri(lang, "سه کار اصلی روزانه", "Your three core daily jobs", "Ihre drei Kernaufgaben am Tag", "Günlük üç temel işiniz"),
    },
    packChip: pack ? { emoji: pack.emoji, label: student.enabled ? tri(lang, "دانشجویی فعال", "Student workspace active", "Lernbereich aktiv", "Öğrenci alanı etkin") : tri(lang, `${pack.name} فعال`, `${pack.nameEn || pack.name} active`, `${pack.nameEn || pack.name} aktiv`, `${pack.nameEn || pack.name} etkin`) } : null,
    empty: data.isEmptyWorkspace && data.teamActivity.length === 0,
    stats: (data.meaningfulStats as StatKey[]).map((key) => ({ key, ...statMeta[key] })),
    attention: data.attention.map((item) => ({ ...item, severityLabel: severityLabel(item.severity as Severity) })),
    team: data.teamActivity.map((item) => {
      const key = item.agent as TeammateKey, dept = departmentOf(key);
      return { id: item.id, href: item.href, title: item.title, detail: item.detail, name: TEAMMATES[key].name(lang), initial: teammateInitial(key, lang), department: dept.label(lang), color: dept.color, tint: dept.tint };
    }),
    coreJobs: pack?.slug === "real-estate" ? [
      { href: "/crm?tab=properties", icon: "Briefcase", label: tri(lang, "ثبت یا به‌روزرسانی ملک", "Add or update a property", "Immobilie anlegen oder aktualisieren", "Bir mülk ekle veya güncelle") },
      { href: "/crm?tab=viewings", icon: "CalendarDays", label: tri(lang, "زمان‌بندی بازدید", "Schedule a viewing", "Besichtigung planen", "Bir görüntüleme planla") },
      { href: "/accounting/owner-statements", icon: "Wallet", label: tri(lang, "صورت‌حساب مالک", "Owner statement", "Eigentümerabrechnung", "Mal sahibi ekstresi") },
    ] : [],
    seoCard: data.businessAccess ? {
      eyebrow: tri(lang, "ایجنت سئو", "SEO Agent", "SEO-Agent", "SEO ajanı"),
      body: tri(lang, "فرصت‌های رشد سایتت را با داده‌های واقعی کلمات کلیدی، رتبه و بک‌لینک پیدا کن.", "Find growth opportunities with real keyword, ranking and backlink data.", "Finde Wachstumschancen mit echten Keyword-, Ranking- und Backlink-Daten.", "Gerçek anahtar kelime, sıralama ve geri bağlantı verileriyle büyüme fırsatlarını bulun."),
      action: tri(lang, "شروع بررسی سایت", "Explore your website", "Website untersuchen", "Sitenizi inceleyin"),
    } : null,
    fitnessCard: data.fitnessWorkspace?.enabled ? { body: tri(lang, "ایجنت ورزش شما فعال است؛ برنامه، مربی و گزارش پیشرفت", "Your Fitness Agent is active · programs, coach and progress reports", "Ihr Fitness-Agent ist aktiv · Programme und Fortschritt", "Fitness ajanınız etkin · programlar, eğitmen ve ilerleme") } : null,
    studentCard: student.enabled ? {
      title: tri(lang, "ایجنت دانشجویی شما فعال است", "Your Student Agent is active", "Ihr Studierenden-Agent ist aktiv", "Öğrenci ajanınız etkin"),
      body: tri(lang, `${student.courseCount} درس · ${student.pendingTaskCount} کار باز · ${student.upcomingExamCount} امتحان پیش‌رو`, `${student.courseCount} courses · ${student.pendingTaskCount} open tasks · ${student.upcomingExamCount} upcoming exams`, `${student.courseCount} Kurse · ${student.pendingTaskCount} offene Aufgaben · ${student.upcomingExamCount} Prüfungen`, `${student.courseCount} ders · ${student.pendingTaskCount} açık görev · ${student.upcomingExamCount} yaklaşan sınav`),
      action: tri(lang, "ورود به فضای دانشجویی ←", "Open Student Workspace →", "Lernbereich öffnen →", "Öğrenci alanını aç →"),
    } : null,
  };
}
