"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Blocks,
  Sparkles,
  GraduationCap,
  Gamepad2,
  FileText,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  LogOut,
  ArrowUpRight,
  Shield,
  type LucideIcon,
} from "lucide-react";
import "./admin-workspace.css";
type Copy = [string, string, string, string];
type Item = { href: string; name: Copy };
type Group = { id: string; name: Copy; icon: LucideIcon; items: Item[] };
const item = (href: string, ...name: Copy): Item => ({
  href: "/admin/" + href,
  name,
});
export const adminGroups: Group[] = [
  {
    id: "overview",
    name: ["نمای کلی", "Overview", "Übersicht", "Genel bakış"],
    icon: LayoutDashboard,
    items: [
      item(
        "dashboard",
        "داشبورد مدیریت",
        "Admin dashboard",
        "Admin-Dashboard",
        "Yönetici paneli",
      ),
    ],
  },
  {
    id: "people",
    name: [
      "کاربران و ارتباطات",
      "People & contacts",
      "Personen und Kontakte",
      "Kullanıcılar ve kişiler",
    ],
    icon: Users,
    items: [
      item("users", "کاربران", "Users", "Benutzer", "Kullanıcılar"),
      item(
        "admins",
        "مدیران سیستم",
        "Administrators",
        "Administratoren",
        "Yöneticiler",
      ),
      item(
        "crm",
        "مشتریان و CRM",
        "Contacts & CRM",
        "Kontakte und CRM",
        "Kişiler ve CRM",
      ),
      item("companies", "شرکت‌ها", "Companies", "Unternehmen", "Şirketler"),
    ],
  },
  {
    id: "finance",
    name: [
      "مالی و فروش",
      "Finance & sales",
      "Finanzen und Vertrieb",
      "Finans ve satış",
    ],
    icon: Wallet,
    items: [
      item(
        "financial",
        "خریدها و فاکتورها",
        "Purchases & invoices",
        "Käufe und Rechnungen",
        "Satın almalar ve faturalar",
      ),
      item(
        "packages",
        "پکیج‌ها و قیمت‌گذاری",
        "Packages & pricing",
        "Pakete und Preise",
        "Paketler ve fiyatlar",
      ),
      item(
        "subscriptions",
        "اشتراک‌ها و انقضا",
        "Subscriptions & expiry",
        "Abos und Ablauf",
        "Abonelikler ve süre",
      ),
      item(
        "credit-tiers",
        "تعرفه کردیت",
        "Credit pricing",
        "Credit-Preise",
        "Kredi fiyatları",
      ),
      item(
        "billing/rates",
        "ارز و نرخ تبدیل",
        "Currencies & rates",
        "Währungen und Kurse",
        "Para birimleri ve kurlar",
      ),
      item(
        "billing/promotions",
        "تخفیف‌ها و پیشنهادها",
        "Offers & promotions",
        "Angebote und Aktionen",
        "Teklifler ve kampanyalar",
      ),
      item(
        "referrals",
        "کد دعوت و اینفلوئنسرها",
        "Invitations & influencers",
        "Einladungen und Influencer",
        "Davetler ve influencerlar",
      ),
      item(
        "affiliate",
        "کمیسیون و افیلیت",
        "Commissions & affiliates",
        "Provisionen und Partner",
        "Komisyonlar ve ortaklar",
      ),
    ],
  },
  {
    id: "modules",
    name: [
      "ماژول‌ها و دسترسی",
      "Modules & access",
      "Module und Zugriff",
      "Modüller ve erişim",
    ],
    icon: Blocks,
    items: [
      item(
        "modules",
        "رجیستری ماژول‌ها",
        "Module registry",
        "Modulregister",
        "Modül kayıtları",
      ),
      item(
        "module-access",
        "دسترسی کاربران به ماژول‌ها",
        "User module access",
        "Benutzer-Modulzugriff",
        "Kullanıcı modül erişimi",
      ),
      item(
        "industry-packs",
        "بسته‌های صنعتی",
        "Industry packages",
        "Branchenpakete",
        "Sektör paketleri",
      ),
      item(
        "categories",
        "دسته‌بندی‌ها",
        "Categories",
        "Kategorien",
        "Kategoriler",
      ),
    ],
  },
  {
    id: "ai",
    name: [
      "هوش مصنوعی و تولید",
      "AI & creation",
      "KI und Erstellung",
      "AI ve üretim",
    ],
    icon: Sparkles,
    items: [
      item(
        "ai-chat",
        "مدیریت چت هوش مصنوعی",
        "AI Chat management",
        "KI-Chat-Verwaltung",
        "AI Sohbet yönetimi",
      ),
      item(
        "chats",
        "گفتگوهای پلتفرم",
        "Workspace chats",
        "Arbeitsbereich-Chats",
        "Çalışma alanı sohbetleri",
      ),
      item(
        "llm",
        "مدل‌ها و ارائه‌دهندگان",
        "Models & providers",
        "Modelle und Anbieter",
        "Modeller ve sağlayıcılar",
      ),
      item(
        "video-factory",
        "کارخانه ویدیو",
        "Video Factory",
        "Video Factory",
        "Video Fabrikası",
      ),
      item("voice-studio", "استودیوی صدا", "Voice Studio", "Sprachstudio", "Ses Stüdyosu"),
      item(
        "voice-agent",
        "ایجنت صوتی",
        "Voice agents",
        "Sprachagenten",
        "Sesli ajanlar",
      ),
      item(
        "seo-intelligence",
        "تحلیل سئو",
        "SEO Intelligence",
        "SEO Intelligence",
        "SEO Intelligence",
      ),
      item(
        "cloudflare",
        "Cloudflare",
        "Cloudflare",
        "Cloudflare",
        "Cloudflare",
      ),
      item(
        "usage",
        "مصرف و هزینه AI",
        "AI usage & costs",
        "KI-Nutzung und Kosten",
        "AI kullanımı ve maliyet",
      ),
      item(
        "analytics",
        "تحلیل قابلیت‌ها",
        "Feature analytics",
        "Funktionsanalysen",
        "Özellik analizi",
      ),
      item("tools", "ابزارها", "Tools", "Werkzeuge", "Araçlar"),
    ],
  },
  {
    id: "education",
    name: [
      "آموزش و دانشجویی",
      "Learning & students",
      "Lernen und Studierende",
      "Eğitim ve öğrenciler",
    ],
    icon: GraduationCap,
    items: [
      item(
        "student",
        "فضای دانشجویی",
        "Student workspace",
        "Studierendenbereich",
        "Öğrenci alanı",
      ),
      item(
        "ai-courses",
        "دوره‌ها و تولید AI",
        "Courses & AI generation",
        "Kurse und KI-Erstellung",
        "Kurslar ve AI üretimi",
      ),
      item(
        "academy",
        "آکادمی و گواهی‌ها",
        "Academy & certificates",
        "Akademie und Zertifikate",
        "Akademi ve sertifikalar",
      ),
    ],
  },
  {
    id: "fitness-play",
    name: [
      "فیتنس و بازی‌ها",
      "Fitness & games",
      "Fitness und Spiele",
      "Fitness ve oyunlar",
    ],
    icon: Gamepad2,
    items: [
      item("fitness", "فیتنس آی‌فکر", "AIFekr FIT", "AIFekr FIT", "AIFekr FIT"),
      item("fitness/users", "کاربران فیتنس", "Fitness members", "Fitness-Mitglieder", "Fitness üyeleri"),
      item(
        "fitness/marketplace",
        "مربیان و سفارش‌ها",
        "Trainers & orders",
        "Trainer und Bestellungen",
        "Antrenörler ve siparişler",
      ),
      item(
        "play",
        "مدیریت PLAY",
        "PLAY management",
        "PLAY-Verwaltung",
        "PLAY yönetimi",
      ),
      item(
        "games",
        "بانک بازی‌های دانشی",
        "Knowledge games",
        "Wissensspiele",
        "Bilgi oyunları",
      ),
    ],
  },
  {
    id: "content",
    name: [
      "محتوا و انتشار",
      "Content & publishing",
      "Inhalte und Veröffentlichung",
      "İçerik ve yayın",
    ],
    icon: FileText,
    items: [
      item(
        "generated-websites",
        "سایت‌های ساخته‌شده",
        "Generated websites",
        "Erstellte Websites",
        "Oluşturulan siteler",
      ),
      item(
        "prompts",
        "کتابخانه پرامپت",
        "Prompt library",
        "Prompt-Bibliothek",
        "Prompt kütüphanesi",
      ),
      item(
        "public-share",
        "اشتراک‌گذاری عمومی",
        "Public sharing",
        "Öffentliche Freigaben",
        "Herkese açık paylaşım",
      ),
      item(
        "startup-inquiries",
        "درخواست‌های استارتاپ",
        "Startup inquiries",
        "Startup-Anfragen",
        "Girişim talepleri",
      ),
    ],
  },
  {
    id: "system",
    name: [
      "تنظیمات و عملیات",
      "Settings & operations",
      "Einstellungen und Betrieb",
      "Ayarlar ve işlemler",
    ],
    icon: Settings,
    items: [
      item(
        "settings",
        "تنظیمات سایت",
        "Site settings",
        "Website-Einstellungen",
        "Site ayarları",
      ),
      item(
        "system",
        "مدیریت سیستم",
        "System management",
        "Systemverwaltung",
        "Sistem yönetimi",
      ),
      item(
        "logs",
        "لاگ‌ها و خطاها",
        "Logs & errors",
        "Protokolle und Fehler",
        "Kayıtlar ve hatalar",
      ),
    ],
  },
];
export default function AdminNavigation({
  adminName,
  role,
}: {
  adminName: string;
  role: string;
}) {
  const { lang } = useTranslation(),
    pathname = usePathname(),
    t = (c: Copy) => tri(lang, ...c),
    [search, setSearch] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [open, setOpen] = useState<Record<string, boolean>>({});
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  useEffect(() => {
    setSearch("");
  }, [pathname]);
  const groups = adminGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        (t(g.name) + " " + t(i.name))
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
      ),
    }))
    .filter((g) => g.items.length);
  return (
    <aside className={`admin-navigation ${collapsed ? "is-collapsed" : ""}`}>
      <header>
        <Link href="/admin/dashboard" className="admin-nav-brand">
          <span>
            <Sparkles size={19} />
          </span>
          {!collapsed && (
            <strong>
              AIFekr
              <small>
                {t(["پنل مدیریت", "Administration", "Verwaltung", "Yönetim"])}
              </small>
            </strong>
          )}
        </Link>
        <button
          className="admin-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={t([
            "تغییر عرض منو",
            "Toggle sidebar",
            "Menübreite ändern",
            "Menü genişliğini değiştir",
          ])}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>
      </header>
      {!collapsed && (
        <>
          <div className="admin-nav-identity">
            <Shield size={18} />
            <div>
              <strong>{adminName}</strong>
              <small>
                {role === "SUPER_ADMIN"
                  ? t([
                      "مدیر اصلی",
                      "Super admin",
                      "Super-Admin",
                      "Üst yönetici",
                    ])
                  : t(["مدیر", "Administrator", "Administrator", "Yönetici"])}
              </small>
            </div>
            <LanguageSwitcher />
          </div>
          <label className="admin-nav-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t([
                "جستجوی بخش مدیریت…",
                "Find an admin section…",
                "Verwaltungsbereich suchen…",
                "Yönetim bölümü ara…",
              ])}
              aria-label={t([
                "جستجو در منو",
                "Search menu",
                "Menü durchsuchen",
                "Menüde ara",
              ])}
            />
          </label>
        </>
      )}
      <nav
        aria-label={t([
          "بخش‌های مدیریت",
          "Admin sections",
          "Verwaltungsbereiche",
          "Yönetim bölümleri",
        ])}
      >
        {groups.map((g) => {
          const active = g.items.some((i) => isActive(i.href));
          const shown =
            !!search || (open[g.id] ?? (active || g.id === "overview"));
          return (
            <section key={g.id} className="admin-nav-group">
              {!collapsed && (
                <button
                  className={`admin-nav-group-toggle ${active ? "has-active" : ""}`}
                  aria-expanded={shown}
                  onClick={() => setOpen({ ...open, [g.id]: !shown })}
                >
                  <g.icon size={16} />
                  <span>{t(g.name)}</span>
                  <small>{g.items.length}</small>
                  <ChevronDown size={14} className={shown ? "is-open" : ""} />
                </button>
              )}
              {(collapsed || shown) && (
                <div className="admin-nav-items">
                  {g.items.map((i) => (
                    <Link
                      href={i.href}
                      key={i.href}
                      aria-current={
                        isActive(i.href) &&
                        !g.items.some(
                          (other) =>
                            other.href !== i.href &&
                            other.href.startsWith(i.href + "/") &&
                            isActive(other.href),
                        )
                          ? "page"
                          : undefined
                      }
                      title={collapsed ? t(i.name) : undefined}
                    >
                      {collapsed ? (
                        <g.icon size={18} />
                      ) : (
                        <>
                          <span>{t(i.name)}</span>
                          <ArrowUpRight size={13} />
                        </>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {!groups.length && (
          <p>
            {t([
              "بخشی پیدا نشد.",
              "No sections found.",
              "Keine Bereiche gefunden.",
              "Bölüm bulunamadı.",
            ])}
          </p>
        )}
      </nav>
      <footer>
        <Link href="/chat">
          <Sparkles size={17} />
          {!collapsed &&
            t([
              "بازگشت به پلتفرم",
              "Back to workspace",
              "Zum Arbeitsbereich",
              "Çalışma alanına dön",
            ])}
        </Link>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          <LogOut size={17} />
          {!collapsed && t(["خروج", "Log out", "Abmelden", "Çıkış"])}
        </button>
      </footer>
    </aside>
  );
}
