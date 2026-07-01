"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ background: "#0f0f0f", color: "#f5f5f5", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>خطای بحرانی</h2>
          <p style={{ color: "#a1a1aa", marginBottom: "1.5rem" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{ padding: "0.75rem 1.5rem", borderRadius: "0.75rem", background: "#ea580c", color: "white", border: "none", cursor: "pointer", fontSize: "1rem" }}
          >
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}
