"use client";

import { useEffect, useState } from "react";

function readLangCookie(): boolean {
  if (typeof document === "undefined") return true;
  return !document.cookie.split("; ").some((c) => c === "lang=en");
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isFa, setIsFa] = useState(true);

  useEffect(() => {
    setIsFa(readLangCookie());
  }, []);

  return (
    <html lang={isFa ? "fa" : "en"} dir={isFa ? "rtl" : "ltr"}>
      <body style={{ background: "#0f0f0f", color: "#f5f5f5", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>{isFa ? "خطای بحرانی" : "Critical error"}</h2>
          <p style={{ color: "#a1a1aa", marginBottom: "1.5rem" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{ padding: "0.75rem 1.5rem", borderRadius: "0.75rem", background: "#ea580c", color: "white", border: "none", cursor: "pointer", fontSize: "1rem" }}
          >
            {isFa ? "تلاش مجدد" : "Try again"}
          </button>
        </div>
      </body>
    </html>
  );
}
