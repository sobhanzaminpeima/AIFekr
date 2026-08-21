"use client";

import { useEffect, useState } from "react";

function readLangCookie(): string {
  if (typeof document === "undefined") return "fa";
  const match = document.cookie.split("; ").find((c) => c.startsWith("lang="));
  return match ? match.split("=")[1] : "fa";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState("fa");
  const isFa = lang === "fa";

  useEffect(() => {
    setLang(readLangCookie());
  }, []);

  return (
    <html lang={lang || "fa"} dir={isFa ? "rtl" : "ltr"}>
      <body style={{ background: "#0f0f0f", color: "#f5f5f5", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>{isFa ? "خطای بحرانی" : "Critical error"}</h2>
          <p style={{ color: "#a1a1aa", marginBottom: "1.5rem" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{ padding: "0.75rem 1.5rem", borderRadius: "0.75rem", background: "#ea580c", color: "white", border: "none", cursor: "pointer", fontSize: "1rem" }}
          >
            {lang === "de" ? "Erneut versuchen" : lang === "fa" ? "تلاش مجدد" : "Try again"}
          </button>
        </div>
      </body>
    </html>
  );
}
