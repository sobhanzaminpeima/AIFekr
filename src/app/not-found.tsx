import Link from "next/link";
import { cookies } from "next/headers";

export default async function NotFound() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("lang")?.value || "fa";
  const isFa = lang === "fa";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}
      dir={cookieStore.get("lang")?.value === "fa" ? "rtl" : "ltr"}
    >
      <h1 className="text-6xl font-bold mb-4" style={{ color: "var(--primary)" }}>
        404
      </h1>
      <p className="text-xl mb-2">{lang === "de" ? "Seite nicht gefunden" : lang === "fa" ? "صفحه پیدا نشد" : "Page not found"}</p>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        {lang === "de" ? "Die gesuchte Seite existiert nicht." : lang === "fa" ? "صفحه‌ای که دنبالش هستید وجود ندارد" : "The page you're looking for doesn't exist"}
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl font-medium text-white"
        style={{ background: "var(--primary)" }}
      >
        {lang === "de" ? "Zurück zur Startseite" : lang === "fa" ? "بازگشت به خانه" : "Back to home"}
      </Link>
    </div>
  );
}
