import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

/**
 * One identity for each department and each AI teammate, shared by the sidebar
 * and the home page so they speak the same visual language: the colour that
 * marks "finance" in the sidebar is the colour on the accountant's row at home.
 *
 * Names are ROLE names — "the accountant", not "Sarah, the accountant". A human
 * name on something that is not human buys a little warmth and risks the trust
 * the product is actually selling, and a user who feels misled about that will
 * doubt the numbers too.
 *
 * Deliberately free of server imports: both a client sidebar and a server page
 * read this.
 */

export type DepartmentKey = "sales" | "marketing" | "finance" | "strategy";

export interface Department {
  key: DepartmentKey;
  /** Fixed per department, never reassigned — colour follows the entity, not its rank. */
  color: string;
  /** Same hue at low alpha, for chips and avatars on a dark surface. */
  tint: string;
  label: (lang: Lang) => string;
}

export const DEPARTMENTS: Record<DepartmentKey, Department> = {
  sales: {
    key: "sales",
    color: "#ea580c",
    tint: "rgba(234,88,12,0.16)",
    label: (l) => tri(l, "فروش و املاک", "Sales & property", "Vertrieb & Immobilien"),
  },
  marketing: {
    key: "marketing",
    color: "#3b82f6",
    tint: "rgba(59,130,246,0.16)",
    label: (l) => tri(l, "مارکتینگ", "Marketing", "Marketing"),
  },
  finance: {
    key: "finance",
    color: "#1baf7a",
    tint: "rgba(27,175,122,0.16)",
    label: (l) => tri(l, "مالی و حسابداری", "Finance & accounting", "Finanzen & Buchhaltung"),
  },
  strategy: {
    key: "strategy",
    color: "#a855f7",
    tint: "rgba(168,85,247,0.16)",
    label: (l) => tri(l, "مشاورهٔ استراتژیک", "Strategy", "Strategie"),
  },
};

export type TeammateKey = "ceo" | "content" | "accountant" | "sales";

export interface Teammate {
  key: TeammateKey;
  department: DepartmentKey;
  /** Role name in each language. Never a personal name. */
  name: (lang: Lang) => string;
  /** One line saying what this teammate is for, in the user's own terms. */
  role: (lang: Lang) => string;
  /** Where the user goes to see this teammate's work. */
  href: string;
}

export const TEAMMATES: Record<TeammateKey, Teammate> = {
  ceo: {
    key: "ceo",
    department: "strategy",
    name: (l) => tri(l, "مدیرعامل", "The CEO", "Die Geschäftsführung"),
    role: (l) => tri(l, "کل کسب‌وکار را می‌بیند و اولویت می‌دهد", "Sees the whole business and sets priorities", "Sieht das gesamte Unternehmen und setzt Prioritäten"),
    href: "/ceo/orchestrator",
  },
  content: {
    key: "content",
    department: "marketing",
    name: (l) => tri(l, "تیم محتوا", "The content team", "Das Content-Team"),
    role: (l) => tri(l, "مقاله می‌نویسد، ویرایش و منتشر می‌کند", "Writes, edits and publishes articles", "Schreibt, redigiert und veröffentlicht Artikel"),
    href: "/seo/agent-pipeline",
  },
  accountant: {
    key: "accountant",
    department: "finance",
    name: (l) => tri(l, "حسابدار", "The accountant", "Die Buchhaltung"),
    role: (l) => tri(l, "دفتر کل، فاکتورها و تسویهٔ مالکان", "Ledger, invoices and owner statements", "Hauptbuch, Rechnungen und Eigentümerabrechnungen"),
    href: "/accounting",
  },
  sales: {
    key: "sales",
    department: "sales",
    name: (l) => tri(l, "مسئول فروش", "The sales lead", "Die Vertriebsleitung"),
    role: (l) => tri(l, "لیدها، معاملات و پیگیری‌ها", "Leads, deals and follow-ups", "Leads, Deals und Follow-ups"),
    href: "/sales",
  },
};

/** The single Persian/Latin initial shown in a teammate's avatar. */
export function teammateInitial(key: TeammateKey, lang: Lang): string {
  const INITIALS: Record<TeammateKey, [string, string]> = {
    ceo: ["م", "C"],
    content: ["م", "C"],
    accountant: ["ح", "A"],
    sales: ["ف", "S"],
  };
  return lang === "fa" ? INITIALS[key][0] : INITIALS[key][1];
}

export function departmentOf(key: TeammateKey): Department {
  return DEPARTMENTS[TEAMMATES[key].department];
}
