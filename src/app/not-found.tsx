import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}
    >
      <h1 className="text-6xl font-bold mb-4" style={{ color: "var(--primary)" }}>
        404
      </h1>
      <p className="text-xl mb-2">صفحه پیدا نشد</p>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        صفحه‌ای که دنبالش هستید وجود ندارد
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl font-medium text-white"
        style={{ background: "var(--primary)" }}
      >
        بازگشت به خانه
      </Link>
    </div>
  );
}
