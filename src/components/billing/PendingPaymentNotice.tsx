"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, ArrowRight } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

export default function PendingPaymentNotice({ count, lang }: { count: number; lang: Lang }) {
  const path = usePathname();
  if (!count || path === "/payments" || path.startsWith("/checkout/")) return null;
  return <Link href="/payments?filter=pending" dir={lang === "fa" ? "rtl" : "ltr"} className="mx-3 mt-3 flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm sm:mx-6" style={{ background: "rgba(249,115,22,.09)", borderColor: "rgba(249,115,22,.25)", color: "var(--text-primary)" }}><Clock3 size={18} className="shrink-0 text-orange-500"/><span className="min-w-0 flex-1">{tri(lang, `${count} سفارش در انتظار؛ پیگیری پرداخت و فعال‌سازی`, `${count} pending orders · track payment & activation`, `${count} offene Bestellungen · Zahlung und Aktivierung verfolgen`, `${count} bekleyen sipariş · ödeme ve onayı takip et`)}</span><ArrowRight size={17} className={`shrink-0 ${lang === "fa" ? "rotate-180" : ""}`}/></Link>;
}
