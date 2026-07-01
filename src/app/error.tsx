"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}
    >
      <h2 className="text-2xl font-bold mb-4">خطایی رخ داد</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        {error.message || "لطفاً دوباره تلاش کنید"}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 rounded-xl font-medium text-white"
        style={{ background: "var(--primary)" }}
      >
        تلاش مجدد
      </button>
    </div>
  );
}
