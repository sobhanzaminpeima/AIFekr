"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Image as ImageIcon, UserSquare2 } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import CharacterCreationPanel from "@/components/image/CharacterCreationPanel";

/**
 * Free-form image generation used to live here in a second chat composer.
 * It is a tab on the main chat now, so this page keeps only the thing the
 * chat composer does not do: the multi-panel character sheet builder.
 */
export default function ImageGeneratePage() {
  const { t, lang } = useTranslation();
  const s = t.imageGeneratePage;

  const [imageProvider, setImageProvider] = useState<string>("");

  useEffect(() => {
    fetch("/api/ai/image-providers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (data.providers?.length) setImageProvider(data.providers[0].id); })
      .catch(() => {});
  }, []);

  return (
    <div dir={lang === "fa" ? "rtl" : "ltr"} className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>
      </div>

      <div className="flex gap-2">
        <Link
          href="/chat"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          <ImageIcon className="w-4 h-4" />
          {tri(lang, "تولید تصویر در چت", "Generate in chat", "Im Chat erstellen")}
        </Link>
        <span
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          <UserSquare2 className="w-4 h-4" />
          {tri(lang, "ساخت کاراکتر", "Character Creation", "Charaktererstellung")}
        </span>
      </div>

      <CharacterCreationPanel lang={lang} imageProvider={imageProvider} />
    </div>
  );
}
