import Link from "next/link";
import { cookies } from "next/headers";

export default async function NotFound() {
  const cookieStore = await cookies();
  const isFa = cookieStore.get("lang")?.value !== "en";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}
      dir={isFa ? "rtl" : "ltr"}
    >
      <h1 className="text-6xl font-bold mb-4" style={{ color: "var(--primary)" }}>
        404
      </h1>
      <p className="text-xl mb-2">{isFa ? "صفحه پیدا نشد" : "Page not found"}</p>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        {isFa ? "صفحه‌ای که دنبالش هستید وجود ندارد" : "The page you're looking for doesn't exist"}
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl font-medium text-white"
        style={{ background: "var(--primary)" }}
      >
        {isFa ? "بازگشت به خانه" : "Back to home"}
      </Link>
    </div>
  );
}
