import type { Lang } from "@/lib/i18n/server";
import en from "@/lib/i18n/en";
import fa from "@/lib/i18n/fa";
import de from "@/lib/i18n/de";
import tr from "@/lib/i18n/tr";
import { EXPERT_MODES_DATA, MEDIA_TABS_DATA, RATIOS, RATIO_LABEL, IMAGE_STYLES, IMAGE_STYLE_LABEL, VIDEO_RATIOS, VIDEO_STYLES, VIDEO_DURATIONS, MUSIC_GENRES, MUSIC_DURATIONS, IMAGE_CATEGORIES, REFERENCE_REQUIRED_CATEGORIES, STARTER_PROMPTS_FA, STARTER_PROMPTS_EN, STARTER_PROMPTS_DE, STARTER_PROMPTS_REAL_ESTATE, DATA_SOURCE_NAMES } from "./chatOptions";

/**
 * The chat page's wording and options for the new design: the classic chat's
 * own strings (components/chat/ChatInterface, OrchestratorActionCard), copied
 * verbatim and keyed by their English text. chatCopy.test.ts fails if they
 * drift from the classic source. "{n}" marks a value.
 */
type Four = readonly [string, string, string, string];
export const CHAT_STRINGS: Four[] = [
  ["داده‌های واقعی شما", "your own real data", "Ihren echten Daten", "kendi gerçek verileriniz"],
  ["، ", ", ", ", ", ", "],
  [" و ", " and ", " und ", " ve "],
  ["بر اساس {n}", "Based on {n}", "Basierend auf {n}", "{n} temel alınarak"],
  ["پرامپت", "Prompt", "Prompt", "Komut"],
  ["کلمه", "words", "Wörter", "kelime"],
  ["بستن", "Collapse", "Schließen", "Daralt"],
  ["باز کردن", "Expand", "Erweitern", "Genişlet"],
  ["کپی شد", "Copied", "Kopiert", "Kopyalandı"],
  ["کپی", "Copy", "Kopieren", "Kopyala"],
  ["حداکثر ۳ فایل", "Up to 3 files", "Bis zu 3 Dateien", "En fazla 3 dosya"],
  ["متن قابل انتخاب پیدا نشد؛ برای PDF اسکن‌شده از OCR فضای دانشجویی استفاده کنید.", "No selectable text. Use Student OCR for scanned PDFs.", "Kein auswählbarer Text. Für Scans bitte Student-OCR nutzen.", "Seçilebilir metin yok. Taranmış PDF için Öğrenci OCR kullanın."],
  ["خواندن فایل انجام نشد. PDF متنی، DOCX، TXT، CSV یا XLSX تا ۵ مگابایت انتخاب کنید.", "Could not read file. Choose a text PDF, DOCX, TXT, CSV or XLSX up to 5 MB.", "Datei nicht lesbar. Text-PDF, DOCX, TXT, CSV oder XLSX bis 5 MB wählen.", "Dosya okunamadı. En fazla 5 MB metin PDF, DOCX, TXT, CSV veya XLSX seçin."],
  ["این فایل‌ها را بررسی و خلاصه کن.", "Review and summarize these files.", "Prüfe und fasse diese Dateien zusammen.", "Bu dosyaları incele ve özetle."],
  ["تولید ویدیو ناموفق بود", "Video generation failed", "Videogenerierung fehlgeschlagen", "Video oluşturma başarısız"],
  ["تولید موزیک ناموفق بود", "Music generation failed", "Musikgenerierung fehlgeschlagen", "Müzik oluşturma başarısız"],
  ["اتصال به Puter برقرار نشد", "Could not connect to Puter", "Verbindung zu Puter fehlgeschlagen", "Puter'a bağlanılamadı"],
  ["در حال پردازش ویدیو... (۲ تا ۵ دقیقه)", "Processing video... (2-5 min)", "Video wird verarbeitet... (2-5 Min)", "Video işleniyor... (2-5 dk)"],
  ["در حال ساخت موزیک...", "Generating music...", "Musik wird erstellt...", "Müzik oluşturuluyor..."],
  ["خطا در تولید", "Generation failed", "Generierung fehlgeschlagen", "Oluşturma başarısız"],
  ["حداکثر {n} عکس مرجع مجاز است", "Up to {n} reference photos allowed", "Bis zu {n} Referenzfotos erlaubt", "En fazla {n} referans fotoğrafına izin verilir"],
  ["برای آپلود عکس بیشتر، پلن خود را ارتقا دهید", "Upgrade your plan to upload more photos", "Aktualisieren Sie Ihren Plan, um mehr Fotos hochzuladen", "Daha fazla fotoğraf yüklemek için planınızı yükseltin"],
  ["عکس آپلود شد", "Photo uploaded", "Foto hochgeladen", "Fotoğraf yüklendi"],
  ["خطا در آپلود", "Upload failed", "Upload fehlgeschlagen", "Yükleme başarısız"],
  ["خطا در ترجمه", "Translation failed", "Übersetzung fehlgeschlagen", "Çeviri başarısız"],
  ["این پرامپت روی عکس خودتان اعمال می‌شود — یک عکس مرجع آپلود کنید", "This prompt applies to your own photo — upload a reference photo", "Dieser Prompt wird auf Ihr eigenes Foto angewendet — laden Sie ein Referenzfoto hoch", "Bu komut kendi fotoğrafınıza uygulanır — bir referans fotoğraf yükleyin"],
  ["مرورگر شما از تشخیص صدا پشتیبانی نمی‌کند", "Your browser doesn't support voice input", "Ihr Browser unterstützt keine Spracheingabe", "Tarayıcınız sesli girişi desteklemiyor"],
  ["چه عکسی بسازم؟ صحنه، سبک و نور را توصیف کن...", "What image should I create? Describe the scene, style and light...", "Welches Bild soll ich erstellen? Szene, Stil und Licht beschreiben...", "Hangi görseli oluşturayım? Sahneyi, stili ve ışığı tarif edin..."],
  ["چه ویدیویی بسازم؟ توصیف کن...", "What video should I create? Describe it...", "Welches Video soll ich erstellen? Beschreiben Sie es...", "Hangi videoyu oluşturayım? Tarif edin..."],
  ["چه موزیکی بسازم؟ توصیف کن...", "What music should I create? Describe it...", "Welche Musik soll ich erstellen? Beschreiben Sie es...", "Hangi müziği oluşturayım? Tarif edin..."],
  ["حالت ساخت", "Create mode", "Modus", "Mod"],
  ["استودیوی صدا", "Voice Studio", "Sprachstudio", "Ses Stüdyosu"],
  ["افزایش اعتبار", "Add Credits", "Guthaben aufladen", "Kredi Ekle"],
  ["جستجو", "Search", "Suche", "Ara"],
  ["جستجو (⌘K)", "Search (⌘K)", "Suche (⌘K)", "Ara (⌘K)"],
  ["مدل هوش مصنوعی", "AI model", "KI-Modell", "Yapay zekâ modeli"],
  ["مدل ساخت تصویر", "Image model", "Bildmodell", "Görsel modeli"],
  ["مدل ساخت ویدیو", "Video model", "Videomodell", "Video modeli"],
  ["با نوشتن یک پیام، اولین عکستان را بسازید", "Write a message to create your first image", "Schreiben Sie eine Nachricht für Ihr erstes Bild", "İlk görselinizi oluşturmak için bir mesaj yazın"],
  ["با نوشتن یک پیام، اولین ویدیوتان را بسازید", "Write a message to create your first video", "Schreiben Sie eine Nachricht für Ihr erstes Video", "İlk videonuzu oluşturmak için bir mesaj yazın"],
  ["با نوشتن یک پیام، اولین موزیکتان را بسازید", "Write a message to create your first track", "Schreiben Sie eine Nachricht für Ihren ersten Track", "İlk parçanızı oluşturmak için bir mesaj yazın"],
  ["فایل پیوست", "Attached file", "Dateianhang", "Ekli dosya"],
  ["عکس مرجع پیوست شد", "Reference photo attached", "Referenzfoto angehängt", "Referans fotoğraf eklendi"],
  ["عکس مرجع", "Reference photo", "Referenzfoto", "Referans fotoğraf"],
  ["حذف فایل", "Remove file", "Datei entfernen", "Dosyayı kaldır"],
  ["ترجمه به انگلیسی", "Translate to English", "Ins Englische übersetzen", "İngilizceye çevir"],
  ["ساخت", "Create", "Erstellen", "Oluştur"],
  ["اقتصادی · سریع", "Economy · Fast", "Sparsam · Schnell", "Ekonomik · Hızlı"],
  ["کیفیت بالا", "High quality", "Hohe Qualität", "Yüksek kalite"],
  ["یک خروجی", "1 output", "1 Ergebnis", "1 çıktı"],
  ["{n} خروجی", "{n} outputs", "{n} Ergebnisse", "{n} çıktı"],
  ["پرامپت آماده", "Ready prompts", "Fertige Prompts", "Hazır komutlar"],
  ["ساخت کاراکتر", "Character", "Charakter", "Karakter"],
  ["گالری پرامپت‌های آماده", "Prompt Gallery", "Prompt-Galerie", "Komut Galerisi"],
  ["هنوز پرامپتی اضافه نشده", "No prompts added yet", "Noch keine Prompts hinzugefügt", "Henüz komut eklenmedi"],
  ["راهنما", "Guide", "Anleitung", "Rehber"],
  ["روی «امتحان کن» بزنید تا این پرامپت در چت قرار بگیرد.", "Tap \"Try it\" to load this prompt into the chat.", "Tippen Sie auf „Ausprobieren“, um diesen Prompt in den Chat zu laden.", "Bu komutu sohbete yüklemek için \"Dene\"ye dokunun."],
  ["امتحان کن", "Try it", "Ausprobieren", "Dene"],
  ["در حال ساخت...", "Generating...", "Wird erstellt...", "Oluşturuluyor..."],
  ["دانلود", "Download", "Herunterladen", "İndir"],
  ["دانلود MP3", "Download MP3", "MP3 herunterladen", "MP3 İndir"],
  ["این کار نیاز به تأیید شما دارد", "This needs your confirmation", "Dies erfordert Ihre Bestätigung", "This needs your confirmation"],
  ["تأیید و انجام بده", "Confirm and do it", "Bestätigen und ausführen", "Confirm and do it"],
  ["انصراف", "Cancel", "Abbrechen", "Cancel"],
  ["انجام شد", "Done", "Erledigt", "Done"],
  ["انجام نشد", "Not done", "Nicht ausgeführt", "Not done"],
  ["انجام نشد — خطایی رخ داد", "Couldn't be done — something went wrong", "Konnte nicht ausgeführt werden — ein Fehler ist aufgetreten", "Couldn't be done — something went wrong"],
  ["این درخواست منقضی شده — دوباره بپرسید", "This request expired — ask again", "Diese Anfrage ist abgelaufen — fragen Sie erneut", "This request expired — ask again"],
];

const COL: Record<Lang, number> = { fa: 0, en: 1, de: 2, tr: 3 };
const DICTIONARIES = { fa, en, de, tr };

export function chatCopy(lang: Lang) {
  const col = COL[lang];
  const pick3 = (o: { fa: string; en: string; de: string }) => (lang === "fa" ? o.fa : lang === "de" ? o.de : o.en);
  return {
    t: DICTIONARIES[lang].chat,
    error: DICTIONARIES[lang].common.error,
    strings: Object.fromEntries(CHAT_STRINGS.map((row) => [row[1], row[col]])) as Record<string, string>,
    expertModes: EXPERT_MODES_DATA.map((m) => ({ id: m.id, label: lang === "fa" ? m.labelFa : lang === "de" ? m.labelDe : m.labelEn, color: m.color })),
    mediaTabs: MEDIA_TABS_DATA.map((tab) => ({ id: tab.id, label: pick3(tab) })),
    ratios: RATIOS.map((r) => ({ value: r, label: RATIO_LABEL[r][lang] })),
    imageStyles: IMAGE_STYLES.map((s) => ({ value: s, label: IMAGE_STYLE_LABEL[s][lang] })),
    videoRatios: VIDEO_RATIOS.map((r) => ({ value: r, label: RATIO_LABEL[r]?.[lang] ?? r })),
    videoStyles: VIDEO_STYLES.map((s) => ({ value: s.value, label: pick3(s) })),
    videoDurations: VIDEO_DURATIONS,
    musicGenres: MUSIC_GENRES,
    musicDurations: MUSIC_DURATIONS,
    imageCategories: IMAGE_CATEGORIES.map((c) => ({ id: c.id, label: pick3(c) })),
    referenceRequiredCategories: [...REFERENCE_REQUIRED_CATEGORIES],
    // Turkish falls back to English, as tri() does in the classic chat.
    dataSources: Object.fromEntries(Object.entries(DATA_SOURCE_NAMES).map(([key, names]) => [key, names[lang === "tr" ? 1 : col]])),
    starters: { general: [STARTER_PROMPTS_FA, STARTER_PROMPTS_EN, STARTER_PROMPTS_DE, STARTER_PROMPTS_EN][col], realEstate: STARTER_PROMPTS_REAL_ESTATE[col] },
  };
}
