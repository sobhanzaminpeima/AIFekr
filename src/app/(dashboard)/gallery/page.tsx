"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Video, Music, Download, Trash2, Globe, Lock, Loader2 } from "lucide-react";
import { toJalali } from "@/lib/utils/jalali";
import toast from "react-hot-toast";

type Tab = "image" | "video" | "music";

export default function GalleryPage() {
  const [tab, setTab] = useState<Tab>("image");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gallery?type=${tab}`)
      .then((r) => r.json())
      .then((data) => { setItems(data.items || []); setLoading(false); });
  }, [tab]);

  async function deleteItem(id: string) {
    if (!confirm("آیا مطمئن هستید؟")) return;
    await fetch(`/api/gallery/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => (i as { id: string }).id !== id));
    toast.success("حذف شد");
  }

  const TABS = [
    { id: "image", label: "تصاویر", icon: ImageIcon },
    { id: "video", label: "ویدیوها", icon: Video },
    { id: "music", label: "موزیک‌ها", icon: Music },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>گالری من</h1>

      <div className="flex gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === id ? "var(--primary)" : "var(--surface-1)",
              color: tab === id ? "white" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
          <ImageIcon className="w-12 h-12 mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>هنوز موردی ساخته نشده</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const i = item as { id: string; url: string; prompt: string; isPublic: boolean; createdAt: string };
            return (
              <div key={i.id} className="group relative rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <img src={i.url} alt={i.prompt} className="w-full h-48 object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a href={i.url} download className="p-2 rounded-xl" style={{ background: "var(--primary)" }}>
                    <Download className="w-4 h-4 text-white" />
                  </a>
                  <button onClick={() => deleteItem(i.id)} className="p-2 rounded-xl" style={{ background: "var(--danger)" }}>
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="absolute top-2 left-2">
                  {i.isPublic ? (
                    <Globe className="w-4 h-4 text-white opacity-70" />
                  ) : (
                    <Lock className="w-4 h-4 text-white opacity-70" />
                  )}
                </div>
                <div className="p-3" style={{ background: "var(--surface-1)" }}>
                  <p className="text-xs truncate mb-1" style={{ color: "var(--text-secondary)" }}>{i.prompt}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{toJalali(i.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
