import type { Lang } from "@/lib/i18n/server";
const achievements: Record<string, [string, string, string, string]> = {
  FIRST_GAME: ["اولین بازی", "First game", "Erstes Spiel", "İlk oyun"],
  TEN_GAMES: ["ده بازی", "Ten games", "Zehn Spiele", "On oyun"],
  HUNDRED_GAMES: ["صد بازی", "One hundred games", "Hundert Spiele", "Yüz oyun"],
  FIRST_WIN: ["اولین پیروزی", "First win", "Erster Sieg", "İlk zafer"],
};
const errors: Record<string, [string, string, string, string]> = {
  PLAY_UNAVAILABLE: [
    "بخش بازی موقتاً در دسترس نیست.",
    "PLAY is currently unavailable.",
    "PLAY ist derzeit nicht verfügbar.",
    "PLAY şu anda kullanılamıyor.",
  ],
  PLAY_SUSPENDED: [
    "دسترسی بازی شما تعلیق شده؛ با پشتیبانی تماس بگیرید.",
    "Your gaming access is suspended. Contact support.",
    "Ihr Spielzugang ist gesperrt. Bitte Support kontaktieren.",
    "Oyun erişiminiz askıya alındı. Destekle iletişime geçin.",
  ],
  ATTEMPT_LIMIT: [
    "فرصت‌های این مسابقه تمام شده است.",
    "You have used all competition attempts.",
    "Alle Wettbewerbsversuche sind verbraucht.",
    "Tüm yarışma denemelerinizi kullandınız.",
  ],
  RATE_LIMITED: [
    "کمی صبر کن و دوباره امتحان کن.",
    "Please wait and try again.",
    "Bitte warten und erneut versuchen.",
    "Lütfen bekleyip tekrar deneyin.",
  ],
  SESSION_EXPIRED: [
    "زمان بازی تمام شده؛ یک بازی جدید شروع کن.",
    "This session expired. Start a new game.",
    "Sitzung abgelaufen. Neues Spiel starten.",
    "Oturum sona erdi. Yeni oyun başlatın.",
  ],
};
function pick(lang: Lang, a: [string, string, string, string]) {
  return a[{ fa: 0, en: 1, de: 2, tr: 3 }[lang]];
}
export function achievementName(lang: Lang, code: string) {
  return pick(lang, achievements[code] ?? [code, code, code, code]);
}
export function playError(lang: Lang, code: string) {
  return pick(
    lang,
    errors[code] ?? [
      "عملیات انجام نشد. اتصال را بررسی و دوباره تلاش کن.",
      "Action failed. Check your connection and try again.",
      "Aktion fehlgeschlagen. Verbindung prüfen und erneut versuchen.",
      "İşlem başarısız. Bağlantınızı kontrol edip tekrar deneyin.",
    ],
  );
}
