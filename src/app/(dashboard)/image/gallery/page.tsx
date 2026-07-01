"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { Images, Trash2, Share2, Download, Lock, Globe, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

type Image = { id: string; url: string; prompt: string; style: string; isPublic: boolean; createdAt: string; credits: number };

export default function ImageGalleryPage() {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lightbox, setLightbox] = useState<Image | null>(null);

  const fetchImages = useCallback(async (p: number) => {
    setLoading(true);
    const res = await fetch(`/api/image/gallery?page=${p}`);
    const data = await res.json();
    setImages(data.images || []);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, []);

  useEffect(() => { fetchImages(page); }, [page, fetchImages]);

  async function handleDelete(id: string) {
    if (!confirm("این تصویر حذف شود؟")) return;
    const res = await fetch("/api/image/gallery", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) { setImages(imgs => imgs.filter(i => i.id !== id)); toast.success("تصویر حذف شد"); }
  }

  async function handleTogglePublic(img: Image) {
    const res = await fetch("/api/image/gallery", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: img.id, isPublic: !img.isPublic }) });
    if (res.ok) {
      setImages(imgs => imgs.map(i => i.id === img.id ? { ...i, isPublic: !i.isPublic } : i));
      toast.success(img.isPublic ? "تصویر خصوصی شد" : "تصویر عمومی شد");
    }
  }

  async function handleDownload(url: string, id: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `image-${id}.png`;
      a.click();
    } catch {
      window.open(url, "_blank");
    }
  }

  function handleShare(img: Image) {
    if (navigator.share) {
      navigator.share({ title: "تصویر AI", text: img.prompt, url: img.url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(img.url);
      toast.success("لینک کپی شد");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>گالری تصاویر</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>تصاویر تولیدشده با هوش مصنوعی</p>
        </div>
        <a href="/image/generate" className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          + تصویر جدید
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} /></div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
          <Images className="w-12 h-12 mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
          <p className="mb-4" style={{ color: "var(--text-muted)" }}>هنوز تصویری ندارید</p>
          <a href="/image/generate" className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>اولین تصویر را بسازید</a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map(img => (
              <div key={img.id} className="group relative rounded-2xl overflow-hidden" style={{ aspectRatio: "1", background: "var(--surface-1)" }}>
                <img src={img.url} alt={img.prompt} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox(img)} />

                {/* Overlay on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)" }}>
                  <div className="flex justify-end gap-1">
                    <button onClick={() => handleTogglePublic(img)} className="p-1.5 rounded-lg backdrop-blur" style={{ background: "rgba(0,0,0,0.5)" }}>
                      {img.isPublic ? <Globe className="w-3.5 h-3.5 text-green-400" /> : <Lock className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <button onClick={() => handleShare(img)} className="p-1.5 rounded-lg backdrop-blur" style={{ background: "rgba(0,0,0,0.5)" }}>
                      <Share2 className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button onClick={() => handleDownload(img.url, img.id)} className="p-1.5 rounded-lg backdrop-blur" style={{ background: "rgba(0,0,0,0.5)" }}>
                      <Download className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button onClick={() => handleDelete(img.id)} className="p-1.5 rounded-lg backdrop-blur" style={{ background: "rgba(239,68,68,0.5)" }}>
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <p className="text-xs text-white line-clamp-2">{img.prompt}</p>
                </div>

                {img.isPublic && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-xs" style={{ background: "rgba(16,185,129,0.8)", color: "white" }}>
                    عمومی
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-xl disabled:opacity-30" style={{ background: "var(--surface-1)" }}>
                <ChevronRight className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
              </button>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>صفحه {page} از {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded-xl disabled:opacity-30" style={{ background: "var(--surface-1)" }}>
                <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.9)" }} onClick={() => setLightbox(null)}>
          <div className="max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.prompt} className="max-h-[80vh] object-contain" />
            <div className="p-4 flex items-center justify-between" style={{ background: "var(--surface-1)" }}>
              <p className="text-sm flex-1 ml-4" style={{ color: "var(--text-secondary)" }}>{lightbox.prompt}</p>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(lightbox.url, lightbox.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
                  <Download className="w-4 h-4" /> دانلود
                </button>
                <button onClick={() => handleShare(lightbox)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  <Share2 className="w-4 h-4" /> اشتراک‌گذاری
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
