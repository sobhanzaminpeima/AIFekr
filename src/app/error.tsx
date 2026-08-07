"use client";

import { useEffect, useState } from "react";

function readLangCookie(): boolean {
  if (typeof document === "undefined") return true;
  return !document.cookie.split("; ").some((c) => c === "lang=en");
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isFa, setIsFa] = useState(true);

  useEffect(() => {
    console.error(error);
    setIsFa(readLangCookie());
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}
      dir={isFa ? "rtl" : "ltr"}
    >
      <h2 className="text-2xl font-bold mb-4">{isFa ? "خطایی رخ داد" : "Something went wrong"}</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        {error.message || (isFa ? "لطفاً دوباره تلاش کنید" : "Please try again")}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 rounded-xl font-medium text-white"
        style={{ background: "var(--primary)" }}
      >
        {isFa ? "تلاش مجدد" : "Try again"}
      </button>
    </div>
  );
}
