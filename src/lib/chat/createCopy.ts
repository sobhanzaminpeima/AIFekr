import type { Lang } from "@/lib/i18n/server";

/**
 * Wording of the classic gallery pages and the upgrade prompt
 * ((dashboard)/gallery, (dashboard)/image/gallery, ui/UpgradeRequiredModal),
 * copied verbatim for the new design's create pages and keyed by English.
 * createCopy.test.ts fails if they drift from the classic source.
 */
type Four = readonly [string, string, string, string];
export const CREATE_STRINGS: Four[] = [
  ["بارگذاری گالری با خطا مواجه شد", "Failed to load the gallery", "Galerie konnte nicht geladen werden", "Failed to load the gallery"],
  ["آیا مطمئن هستید؟", "Are you sure?", "Sind Sie sicher?", "Are you sure?"],
  ["حذف شد", "Deleted", "Gelöscht", "Deleted"],
  ["تصاویر", "Images", "Bilder", "Images"],
  ["ویدیوها", "Videos", "Videos", "Videos"],
  ["موزیک‌ها", "Music", "Musik", "Music"],
  ["گالری من", "My Gallery", "Meine Galerie", "My Gallery"],
  ["هنوز موردی ساخته نشده", "Nothing created yet", "Noch nichts erstellt", "Nothing created yet"],
  ["این تصویر حذف شود؟", "Delete this image?", "Dieses Bild löschen?", "Delete this image?"],
  ["تصویر حذف شد", "Image deleted", "Bild gelöscht", "Image deleted"],
  ["تصویر خصوصی شد", "Image is now private", "Bild ist jetzt privat", "Image is now private"],
  ["تصویر عمومی شد", "Image is now public", "Bild ist jetzt öffentlich", "Image is now public"],
  ["تصویر AI", "AI Image", "KI-Bild", "AI Image"],
  ["لینک کپی شد", "Link copied", "Link kopiert", "Link copied"],
  ["گالری تصاویر", "Image Gallery", "Bildergalerie", "Image Gallery"],
  ["تصاویر تولیدشده با هوش مصنوعی", "AI-generated images", "KI-generierte Bilder", "AI-generated images"],
  ["+ تصویر جدید", "+ New Image", "+ Neues Bild", "+ New Image"],
  ["هنوز تصویری ندارید", "You don't have any images yet", "Sie haben noch keine Bilder", "You don't have any images yet"],
  ["اولین تصویر را بسازید", "Create your first image", "Erstellen Sie Ihr erstes Bild", "Create your first image"],
  ["عمومی", "Public", "Öffentlich", "Public"],
  ["صفحه {n} از {n}", "Page {n} of {n}", "Seite {n} von {n}", "Page {n} of {n}"],
  ["دانلود", "Download", "Herunterladen", "Download"],
  ["اشتراک‌گذاری", "Share", "Teilen", "Share"],
  ["بستن", "Close", "Schließen", "Kapat"],
  ["این بخش نیاز به ارتقای حساب دارد", "This feature requires an upgraded account", "Diese Funktion erfordert ein Upgrade Ihres Kontos", "Bu özellik hesap yükseltmesi gerektirir"],
  ["برای استفاده از این بخش باید اکانت خود را ارتقا دهید — بقیه امکانات همچنان در دسترس شماست.", "You need to upgrade your account to use this feature — everything else stays available to you.", "Sie müssen Ihr Konto upgraden, um diese Funktion nutzen zu können — alle anderen Funktionen bleiben verfügbar.", "Bu özelliği kullanmak için hesabınızı yükseltmeniz gerekiyor — diğer tüm özellikler kullanılabilir kalır."],
  ["ارتقای حساب", "Upgrade account", "Konto upgraden", "Hesabı yükselt"],
];

const COL: Record<Lang, number> = { fa: 0, en: 1, de: 2, tr: 3 };
export function createCopy(lang: Lang): Record<string, string> {
  return Object.fromEntries(CREATE_STRINGS.map((row) => [row[1], row[COL[lang]]]));
}
