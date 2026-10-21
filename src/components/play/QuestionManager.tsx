"use client";
import { useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
type Question = {
  id: string;
  language: string;
  prompt: string;
  options: string;
  answer: number;
  explanation: string;
  status: string;
};
export default function QuestionManager() {
  const { lang } = useTranslation(),
    t = (fa: string, en: string, de: string, tr: string) =>
      tri(lang, fa, en, de, tr),
    [rows, setRows] = useState<Question[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState({
      id: undefined as string | undefined,
      language: lang,
      prompt: "",
      options: ["", "", "", ""],
      answer: 0,
      explanation: "",
      status: "DRAFT",
    });
  async function load() {
    const r = await fetch("/api/admin/play");
    if (r.ok) setRows((await r.json()).questions);
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "question", ...form }),
      });
      if (!r.ok)
        throw Error(
          t(
            "ذخیره نشد؛ سؤال تکراری یا اطلاعات ناقص است.",
            "Not saved: duplicate question or incomplete fields.",
            "Nicht gespeichert: doppelte Frage oder unvollständige Angaben.",
            "Kaydedilmedi: yinelenen soru veya eksik alanlar.",
          ),
        );
      await load();
      setForm({
        ...form,
        id: undefined,
        prompt: "",
        options: ["", "", "", ""],
        explanation: "",
        status: "DRAFT",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <h2>
        {t(
          "بانک سؤال و بررسی انتشار",
          "Question bank & publication review",
          "Fragenbank und Freigabe",
          "Soru bankası ve yayın incelemesi",
        )}
      </h2>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={busy}
        className="rounded-xl border p-3"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/admin/play/questions/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ language: form.language, topic: "logic" }),
            });
            if (!r.ok)
              throw Error(
                t(
                  "تولید پیش‌نویس ناموفق بود.",
                  "Draft generation failed.",
                  "Entwurf konnte nicht erstellt werden.",
                  "Taslak oluşturulamadı.",
                ),
              );
            await load();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(
          "تولید ۳ پیش‌نویس با AI · هزینه API ادمین",
          "Generate 3 AI drafts · admin API cost",
          "3 KI-Entwürfe erstellen · Admin-API-Kosten",
          "3 AI taslağı oluştur · yönetici API maliyeti",
        )}
      </button>
      <p className="text-xs opacity-70">
        {t(
          "پیش‌نویس AI تا بررسی و انتشار دستی وارد بازی نمی‌شود.",
          "AI drafts are excluded from games until manually reviewed and published.",
          "KI-Entwürfe werden erst nach manueller Prüfung und Freigabe gespielt.",
          "AI taslakları elle incelenip yayımlanana kadar oyunlara eklenmez.",
        )}
      </p>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          {t("زبان", "Language", "Sprache", "Dil")}
          <select
            value={form.language}
            onChange={(e) =>
              setForm({ ...form, language: e.target.value as typeof lang })
            }
          >
            {["fa", "en", "de", "tr"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <textarea
          required
          minLength={10}
          maxLength={2000}
          aria-label={t("سؤال", "Question", "Frage", "Soru")}
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          className="rounded-xl border bg-transparent p-3"
        />
        {form.options.map((o, i) => (
          <label key={i} className="flex gap-2 items-center">
            <input
              type="radio"
              name="answer"
              checked={form.answer === i}
              onChange={() => setForm({ ...form, answer: i })}
            />
            <input
              required
              maxLength={300}
              aria-label={`${t("گزینه", "Option", "Antwort", "Seçenek")} ${i + 1}`}
              value={o}
              onChange={(e) =>
                setForm({
                  ...form,
                  options: form.options.map((v, n) =>
                    n === i ? e.target.value : v,
                  ),
                })
              }
              className="w-full rounded-xl border bg-transparent p-3"
            />
          </label>
        ))}
        <textarea
          required
          minLength={5}
          maxLength={2000}
          aria-label={t(
            "توضیح پاسخ درست",
            "Correct answer explanation",
            "Erklärung der richtigen Antwort",
            "Doğru yanıt açıklaması",
          )}
          value={form.explanation}
          onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          className="rounded-xl border bg-transparent p-3"
        />
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          {["DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          disabled={busy}
          className="rounded-xl bg-orange-600 text-white p-3"
        >
          {t(
            "ذخیره سؤال بررسی‌شده",
            "Save reviewed question",
            "Geprüfte Frage speichern",
            "İncelenen soruyu kaydet",
          )}
        </button>
      </form>
      <div className="max-h-80 overflow-auto space-y-2">
        {rows.map((q) => (
          <button
            key={q.id}
            className="block w-full text-start rounded-xl border p-3"
            onClick={() =>
              setForm({
                id: q.id,
                language: q.language as typeof lang,
                prompt: q.prompt,
                options: JSON.parse(q.options),
                answer: q.answer,
                explanation: q.explanation,
                status: q.status,
              })
            }
          >
            {q.language} · {q.status} · {q.prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
