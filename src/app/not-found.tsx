import Link from "next/link";
// tri must come from "@/lib/i18n/tri", NOT "@/lib/i18n": the index is a
// "use client" module, so a Server Component importing tri from it gets a
// client-reference proxy instead of the function and crashes at render.
import { tri } from "@/lib/i18n/tri";
import { getServerLang } from "@/lib/i18n/server";

export default async function NotFound() {
  // Was reading the `lang` cookie directly with a hardcoded "fa" fallback --
  // same bug as the root/dashboard layouts (see their comments): ignored the
  // admin's "default_language" site setting, and `dir` re-read the raw
  // cookie separately from the resolved `lang`, so a no-cookie visitor could
  // get Persian text rendered `dir="ltr"`.
  const lang = await getServerLang();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}
      dir={lang === "fa" ? "rtl" : "ltr"}
    >
      <h1 className="text-6xl font-bold mb-4" style={{ color: "var(--primary)" }}>
        404
      </h1>
      <p className="text-xl mb-2">{tri(lang, "صفحه پیدا نشد", "Page not found", "Seite nicht gefunden")}</p>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        {tri(lang, "صفحه‌ای که دنبالش هستید وجود ندارد", "The page you're looking for doesn't exist", "Die gesuchte Seite existiert nicht.")}
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl font-medium text-white"
        style={{ background: "var(--primary)" }}
      >
        {tri(lang, "بازگشت به خانه", "Back to home", "Zurück zur Startseite")}
      </Link>
    </div>
  );
}
