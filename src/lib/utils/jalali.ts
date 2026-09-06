// تبدیل تاریخ میلادی به شمسی
export function toJalali(date: Date | string): string {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    calendar: "persian",
  });
  return formatter.format(d);
}

export function toJalaliShort(date: Date | string): string {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    calendar: "persian",
  });
  return formatter.format(d);
}

export function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  if (hours < 24) return `${hours} ساعت پیش`;
  if (days < 30) return `${days} روز پیش`;
  return toJalali(date);
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fa-IR").format(amount) + " تومان";
}

/**
 * Persian is the only language here that uses Persian-Indic digits — German
 * used to fall into the same branch as Persian and render "۹٬۹۹۹" to a German
 * reader (this helper feeds ~40 call sites, so that leaked almost everywhere).
 */
export function formatNumber(n: number, lang?: string): string {
  const locale = lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "fa-IR";
  return new Intl.NumberFormat(locale).format(n);
}
