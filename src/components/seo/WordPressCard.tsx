"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, CheckCircle2, XCircle, PlugZap, Save } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";

interface TestResult { ok: boolean; message?: string; siteName?: string; user?: string; seoPlugin?: "yoast" | "rankmath" | null; canPublish?: boolean }

/**
 * WordPress connection for the SEO tools: save the site + an Application Password,
 * then test it. The test reports what will actually work -- reachable, allowed to
 * publish, and which SEO plugin (Yoast / Rank Math) receives the SEO title and
 * description -- so problems show up here, not after a failed publish.
 */
export default function WordPressCard({ onChange }: { onChange?: () => void }) {
  const { lang } = useTranslation();
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/seo/connection", { credentials: "include" });
    const d = await r.json();
    const c = d?.connection;
    if (c?.platform === "wordpress") { setSiteUrl(c.siteUrl || ""); setUsername(c.wpUsername || ""); setSaved(!!c.hasAppPassword); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const r = await fetch("/api/seo/wordpress/test", { method: "POST", credentials: "include" });
      setResult(await r.json());
    } catch {
      setResult({ ok: false, message: tri(lang, "خطا در ارتباط با سرور", "Could not reach the server", "Server nicht erreichbar") });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!siteUrl.trim() || !username.trim() || !password.trim()) {
      toast.error(tri(lang, "آدرس سایت، نام کاربری و رمز برنامه را وارد کنید.", "Enter the site URL, username and application password.", "Geben Sie Website-URL, Benutzername und Anwendungspasswort ein."));
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/seo/connection", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: "wordpress", siteUrl: siteUrl.trim(), wpUsername: username.trim(), wpAppPassword: password }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPassword("");
      setSaved(true);
      onChange?.();
      await test();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const input = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" } as const;
  const plugin = result?.seoPlugin === "yoast" ? "Yoast SEO" : result?.seoPlugin === "rankmath" ? "Rank Math" : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <PlugZap className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "اتصال وردپرس", "WordPress connection", "WordPress-Verbindung")}</span>
        </div>
        {saved && (
          <button onClick={test} disabled={testing} className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--surface-2)", color: "var(--primary)", border: "1px solid var(--primary)" }}>
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}{tri(lang, "تست اتصال", "Test connection", "Verbindung testen")}
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {tri(lang, "برای انتشار مقاله و اعمال سئو روی وردپرس: در وردپرس به «کاربران ← پروفایل ← Application Passwords» بروید، یک رمز برنامه بسازید و اینجا وارد کنید (رمز اصلی وردپرس را نگذارید). حساب باید نقش Editor یا Administrator داشته باشد.", "To publish posts and set SEO on WordPress: in WordPress open Users → Profile → Application Passwords, create one and paste it here (never your main WordPress password). The account needs the Editor or Administrator role.", "Zum Veröffentlichen und Setzen von SEO in WordPress: Öffnen Sie in WordPress Benutzer → Profil → Anwendungspasswörter, erstellen Sie eines und fügen Sie es hier ein (nie Ihr Haupt-Passwort). Das Konto braucht die Rolle Editor oder Administrator.")}
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} dir="ltr" placeholder="https://myblog.com" className="px-3 py-2.5 rounded-xl text-sm outline-none" style={input} />
          <input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" placeholder={tri(lang, "نام کاربری وردپرس", "WordPress username", "WordPress-Benutzername")} autoComplete="off" className="px-3 py-2.5 rounded-xl text-sm outline-none" style={input} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" type="password" autoComplete="new-password" placeholder={saved ? tri(lang, "•••• (برای تغییر دوباره وارد کنید)", "•••• (re-enter to change)", "•••• (zum Ändern neu eingeben)") : "abcd efgh ijkl mnop"} className="px-3 py-2.5 rounded-xl text-sm outline-none" style={input} />
        </div>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{tri(lang, "ذخیره و تست", "Save & test", "Speichern & testen")}
        </button>

        {result && (
          result.ok ? (
            <div className="text-xs p-3 rounded-xl space-y-1" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
              <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-4 h-4" />{tri(lang, `به «${result.siteName}» وصل شد (کاربر: ${result.user})`, `Connected to “${result.siteName}” as ${result.user}`, `Mit „${result.siteName}“ verbunden (Benutzer: ${result.user})`)}</p>
              <p style={{ color: "var(--text-secondary)" }}>
                {plugin
                  ? tri(lang, `افزونه سئو: ${plugin} — عنوان و توضیحات سئو روی مطالب اعمال می‌شود.`, `SEO plugin: ${plugin} — SEO title and description are set on your posts.`, `SEO-Plugin: ${plugin} – SEO-Titel und -Beschreibung werden bei Ihren Beiträgen gesetzt.`)
                  : tri(lang, "افزونه سئوی پشتیبانی‌شده (Yoast یا Rank Math) پیدا نشد؛ مقاله‌ها منتشر می‌شوند ولی عنوان/توضیحات سئو باید دستی ثبت شود.", "No supported SEO plugin (Yoast or Rank Math) found; posts are published but the SEO title/description must be set by hand.", "Kein unterstütztes SEO-Plugin (Yoast oder Rank Math) gefunden; Beiträge werden veröffentlicht, SEO-Titel/-Beschreibung müssen manuell gesetzt werden.")}
                {!result.canPublish && ` ${tri(lang, "توجه: این کاربر فقط می‌تواند پیش‌نویس بسازد، نه منتشر کند.", "Note: this user can create drafts but not publish.", "Hinweis: Dieser Benutzer kann Entwürfe erstellen, aber nicht veröffentlichen.")}`}
              </p>
            </div>
          ) : (
            <p className="text-xs p-3 rounded-xl flex items-start gap-1.5" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}><XCircle className="w-4 h-4 flex-shrink-0" />{result.message}</p>
          )
        )}
      </div>
    </div>
  );
}
