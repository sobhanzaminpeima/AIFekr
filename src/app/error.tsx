"use client";

import { useEffect, useState } from "react";

function readLangCookie(): string {
  if (typeof document === "undefined") return "fa";
  const match = document.cookie.split("; ").find((c) => c.startsWith("lang="));
  return match ? match.split("=")[1] : "fa";
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState("fa");
  const isFa = lang === "fa";

  useEffect(() => {
    console.error(error);
    setLang(readLangCookie());
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}
      dir={isFa ? "rtl" : "ltr"}
    >
      <h2 className="text-2xl font-bold mb-4">{isFa ? "خطایی رخ داد" : (lang === "de" ? "Etwas ist schiefgelaufen" : "Something went wrong")}</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        {error.message || (isFa ? "لطفاً دوباره تلاش کنید" : (lang === "de" ? "Bitte versuchen Sie es erneut" : "Please try again"))}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 rounded-xl font-medium text-white"
        style={{ background: "var(--primary)" }}
      >
        {isFa ? "تلاش مجدد" : (lang === "de" ? "Erneut versuchen" : "Try again")}
      </button>
    </div>
  );
}
