"use client";

/**
 * The gate's "continue without a package" option previously linked to /chat —
 * a dead end that never actually let the user use the business tool they came
 * for. This sets a cookie BusinessGate checks server-side and reloads the
 * current page, so the button does what it says.
 */
export default function ContinueWithoutPackButton() {
  function handleClick() {
    document.cookie = "skipBusinessGate=1; path=/; max-age=86400";
    window.location.reload();
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-medium text-lg transition-all"
      style={{ background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
    >
      ادامه بدون بسته
    </button>
  );
}
