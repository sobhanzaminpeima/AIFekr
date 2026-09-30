import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import type { DepartmentKey } from "@/lib/team/identity";

/**
 * The capability registry — one table describing every destination a user can
 * reach, read by three consumers so the platform's feature list is never
 * written down twice:
 *
 *   1. The floating support assistant (`support_mode`) — answers "what is this",
 *      "where is it", and "why is it locked for me" from `label`/`blurb`/`href`/`planGate`.
 *   2. The `/chat` orchestrator (`full_mode`) — routes a message to a domain via
 *      `key` + `department`.
 *   3. Knowledge-base ingestion — `docSlug` binds a capability to its
 *      `docs/knowledge-base/<slug>.md` document.
 *
 * Deliberately free of server imports (no Prisma, no fs): a client component,
 * a route handler and a CLI-ish sync route all read this. Same constraint
 * `src/lib/team/identity.ts` documents for itself.
 *
 * IMPORTANT — `planGate` MIRRORS the real gate, it does not implement it. The
 * authority is still `resolveCrmWorkspace()`/`hasCrmAccess()` and each route's
 * own check. This copy exists so the assistant can tell a FREE user "invoicing
 * needs the CRM add-on" instead of linking them at a page that will 402 — if
 * the two ever disagree, the route wins and this table is the bug.
 */

export type PlanGate =
  | "free"
  /** Any paid CRM tier — SOLO or TEAM (hasCrmAccess: crmPlan !== "NONE"). */
  | "crm"
  /** CRM TEAM tier only — the multi-seat surfaces. */
  | "crm:TEAM"
  /** The Voice add-on (user.voicePlan + voicePlanExpiry). */
  | "voice"
  /** Costs AI credits per use rather than being plan-gated. */
  | "credits";

export type CapabilityKind = "business" | "create" | "account" | "tool";

/** Tool tiers, per the Phase 1 architecture. `full_mode` may reach READ/DRAFT/COMMIT; `support_mode` may reach none of them. */
export type ToolTier = "READ" | "DRAFT" | "COMMIT";

export interface Capability {
  key: string;
  kind: CapabilityKind;
  /** Business capabilities belong to a department (drives colour + grouping); others don't. */
  department: DepartmentKey | null;
  href: string;
  planGate: PlanGate;
  label: (lang: Lang) => string;
  /** One line, in the user's own terms, saying what this does. */
  blurb: (lang: Lang) => string;
  /** Which `docs/knowledge-base/<slug>.md` covers this. Several capabilities may share one doc. */
  docSlug: string;
  /**
   * Domains `full_mode` can act in for this capability. Empty means the
   * orchestrator has no tools here and must answer by linking to `href`.
   * Phase 4 ships CRM + Accounting + Social(draft-only) + Strategy(read-only);
   * the rest stay link-only until a later pass.
   */
  tiers: ToolTier[];
}

export const CAPABILITIES: Capability[] = [
  // ─── Sales ────────────────────────────────────────────────────────────────
  {
    key: "crm",
    kind: "business",
    department: "sales",
    href: "/crm",
    planGate: "free", // Pipeline/Contacts are free up to the contact cap; billing/contracts/automation need "crm"
    label: (l) => tri(l, "مدیریت مشتریان (CRM)", "CRM", "CRM"),
    blurb: (l) =>
      tri(
        l,
        "مخاطبین، معاملات، وظایف و قیف فروش شما در یک جا",
        "Your contacts, deals, tasks and sales pipeline in one place",
        "Ihre Kontakte, Deals, Aufgaben und Vertriebspipeline an einem Ort"
      ),
    docSlug: "crm",
    tiers: ["READ", "DRAFT", "COMMIT"],
  },
  {
    key: "sales-agent",
    kind: "business",
    department: "sales",
    href: "/sales",
    planGate: "crm",
    label: (l) => tri(l, "مسئول فروش", "Sales agent", "Vertriebsleitung"),
    blurb: (l) =>
      tri(
        l,
        "قیف فروش را تحلیل می‌کند و پیگیری‌های عقب‌افتاده را پیشنهاد می‌دهد",
        "Analyses your pipeline and proposes the follow-ups you're behind on",
        "Analysiert Ihre Pipeline und schlägt überfällige Follow-ups vor"
      ),
    docSlug: "sales-agent",
    tiers: ["READ"],
  },
  {
    key: "voice-agent",
    kind: "business",
    department: "sales",
    href: "/voice-agent",
    planGate: "voice",
    label: (l) => tri(l, "دستیار تلفنی", "Voice agent", "Telefonassistent"),
    blurb: (l) =>
      tri(
        l,
        "به تماس‌های ورودی جواب می‌دهد، اطلاعات می‌گیرد و قرار بازدید تنظیم می‌کند",
        "Answers inbound calls, qualifies callers and books viewings",
        "Nimmt eingehende Anrufe entgegen, qualifiziert Anrufer und vereinbart Besichtigungen"
      ),
    docSlug: "voice-agent",
    tiers: [],
  },
  {
    key: "industry-packs",
    kind: "business",
    department: "sales",
    href: "/industry",
    planGate: "free",
    label: (l) => tri(l, "بسته‌های صنفی", "Industry packs", "Branchenpakete"),
    blurb: (l) =>
      tri(
        l,
        "پلتفرم را با اصطلاحات و گردش‌کار صنف خودتان تنظیم می‌کند",
        "Tunes the platform to your industry's vocabulary and workflows",
        "Passt die Plattform an die Begriffe und Abläufe Ihrer Branche an"
      ),
    docSlug: "industry-packs",
    tiers: [],
  },

  // ─── Marketing ────────────────────────────────────────────────────────────
  {
    key: "social",
    kind: "business",
    department: "marketing",
    href: "/social",
    planGate: "credits",
    label: (l) => tri(l, "شبکه‌های اجتماعی", "Social media", "Social Media"),
    blurb: (l) =>
      tri(
        l,
        "پست و کپشن اینستاگرام می‌سازد، تقویم محتوا می‌چیند و آمار را دنبال می‌کند",
        "Writes Instagram posts and captions, plans a content calendar, tracks your stats",
        "Erstellt Instagram-Beiträge und Captions, plant einen Content-Kalender, verfolgt Ihre Statistiken"
      ),
    docSlug: "social",
    tiers: ["DRAFT"], // never COMMIT — publishing stays a human act, see docs/knowledge-base/social.md
  },
  {
    key: "lead-gen",
    kind: "business",
    department: "marketing",
    href: "/lead-gen",
    planGate: "credits",
    label: (l) => tri(l, "جذب لید", "Lead generation", "Lead-Generierung"),
    blurb: (l) =>
      tri(
        l,
        "لیدهای تازه پیدا می‌کند و مستقیم وارد CRM می‌کند",
        "Finds new leads and drops them straight into your CRM",
        "Findet neue Leads und übergibt sie direkt an Ihr CRM"
      ),
    docSlug: "lead-gen",
    tiers: [],
  },
  {
    key: "seo",
    kind: "business",
    department: "marketing",
    href: "/seo",
    planGate: "credits",
    label: (l) => tri(l, "سئو و محتوا", "SEO & content", "SEO & Content"),
    blurb: (l) =>
      tri(
        l,
        "مقاله‌های سئوشده می‌نویسد و رتبه سایت شما را رصد می‌کند",
        "Writes SEO-ready articles and watches how your site ranks",
        "Schreibt SEO-optimierte Artikel und beobachtet Ihre Rankings"
      ),
    docSlug: "seo",
    tiers: [],
  },
  {
    key: "website-designer",
    kind: "business",
    department: "marketing",
    href: "/website-designer",
    planGate: "credits",
    label: (l) => tri(l, "طراح وب‌سایت", "Website designer", "Website-Designer"),
    blurb: (l) =>
      tri(
        l,
        "یک وب‌سایت کامل برای کسب‌وکار شما تولید می‌کند",
        "Generates a complete website for your business",
        "Erstellt eine komplette Website für Ihr Unternehmen"
      ),
    docSlug: "website-designer",
    tiers: [],
  },

  // ─── Finance ──────────────────────────────────────────────────────────────
  {
    key: "accounting",
    kind: "business",
    department: "finance",
    href: "/accounting",
    planGate: "crm",
    label: (l) => tri(l, "حسابداری", "Accounting", "Buchhaltung"),
    blurb: (l) =>
      tri(
        l,
        "دفتر کل، هزینه‌ها، فاکتورها، حقوق‌ودستمزد و صورت‌حساب مالکان",
        "Ledger, expenses, invoices, payroll and owner statements",
        "Hauptbuch, Ausgaben, Rechnungen, Lohnabrechnung und Eigentümerabrechnungen"
      ),
    docSlug: "accounting",
    tiers: ["READ", "DRAFT", "COMMIT"],
  },

  // ─── Strategy ─────────────────────────────────────────────────────────────
  {
    key: "ceo",
    kind: "business",
    department: "strategy",
    href: "/ceo",
    planGate: "credits",
    label: (l) => tri(l, "مشاور مدیرعامل", "CEO advisor", "CEO-Beratung"),
    blurb: (l) =>
      tri(
        l,
        "کل کسب‌وکار را با هم می‌بیند و می‌گوید الان چه چیزی مهم‌تر است",
        "Looks at the whole business at once and says what matters right now",
        "Betrachtet das gesamte Unternehmen und sagt, was jetzt zählt"
      ),
    docSlug: "ceo",
    tiers: ["READ"],
  },
  {
    key: "business-doctor",
    kind: "business",
    department: "strategy",
    href: "/business-doctor",
    planGate: "credits",
    label: (l) => tri(l, "دکتر کسب‌وکار", "Business doctor", "Business Doctor"),
    blurb: (l) =>
      tri(
        l,
        "مشکل ریشه‌ای کسب‌وکار را تشخیص می‌دهد و نسخه می‌دهد",
        "Diagnoses the root problem in your business and prescribes fixes",
        "Diagnostiziert das Kernproblem Ihres Unternehmens und verschreibt Maßnahmen"
      ),
    docSlug: "business-doctor",
    tiers: ["READ"],
  },
  {
    key: "meeting",
    kind: "business",
    department: "strategy",
    href: "/meeting",
    planGate: "credits",
    label: (l) => tri(l, "اتاق جلسه", "Meeting room", "Besprechungsraum"),
    blurb: (l) =>
      tri(
        l,
        "چند مشاور AI را سر یک تصمیم دور یک میز می‌نشاند",
        "Sits several AI advisors around one table on a single decision",
        "Versammelt mehrere KI-Berater zu einer einzigen Entscheidung"
      ),
    docSlug: "meeting",
    tiers: [],
  },

  // ─── Create ───────────────────────────────────────────────────────────────
  {
    key: "chat",
    kind: "create",
    department: null,
    href: "/chat",
    planGate: "credits",
    label: (l) => tri(l, "چت", "Chat", "Chat"),
    blurb: (l) =>
      tri(
        l,
        "دستیار عمومی شما — و از اینجا می‌توانید کارهای واقعی کسب‌وکارتان را هم انجام بدهید",
        "Your general assistant — and the place to get real business work done",
        "Ihr allgemeiner Assistent — und der Ort für echte Geschäftsaufgaben"
      ),
    docSlug: "chat",
    tiers: [],
  },
  {
    key: "image",
    kind: "create",
    department: null,
    href: "/image/generate",
    planGate: "credits",
    label: (l) => tri(l, "تولید عکس", "Image generation", "Bilderstellung"),
    blurb: (l) =>
      tri(
        l,
        "عکس می‌سازد، از عکس مرجع کار می‌کند، و کاراکتر ثابت می‌سازد",
        "Generates images, works from a reference image, and builds consistent characters",
        "Erzeugt Bilder, arbeitet mit Referenzbildern und erstellt konsistente Charaktere"
      ),
    docSlug: "create",
    tiers: [],
  },
  {
    key: "video",
    kind: "create",
    department: null,
    href: "/video/generate",
    planGate: "credits",
    label: (l) => tri(l, "تولید ویدیو", "Video generation", "Videoerstellung"),
    blurb: (l) => tri(l, "از متن یا از یک عکس، ویدیوی کوتاه می‌سازد", "Makes short videos from text or from a single image", "Erstellt kurze Videos aus Text oder einem einzelnen Bild"),
    docSlug: "create",
    tiers: [],
  },
  {
    key: "music",
    kind: "create",
    department: null,
    href: "/music/generate",
    planGate: "credits",
    label: (l) => tri(l, "تولید موزیک", "Music generation", "Musikerstellung"),
    blurb: (l) => tri(l, "موزیک پس‌زمینه برای ویدیو و تبلیغات می‌سازد", "Makes background music for videos and ads", "Erstellt Hintergrundmusik für Videos und Werbung"),
    docSlug: "create",
    tiers: [],
  },
  {
    key: "gallery",
    kind: "create",
    department: null,
    href: "/image/gallery",
    planGate: "free",
    label: (l) => tri(l, "گالری", "Gallery", "Galerie"),
    blurb: (l) => tri(l, "هر چیزی که تا حالا ساخته‌اید، یک‌جا", "Everything you've generated so far, in one place", "Alles, was Sie bisher erstellt haben, an einem Ort"),
    docSlug: "create",
    tiers: [],
  },
  {
    key: "agents",
    kind: "create",
    department: null,
    href: "/agents",
    planGate: "free",
    label: (l) => tri(l, "ایجنت‌های من", "My agents", "Meine Agenten"),
    blurb: (l) => tri(l, "فهرست همهٔ هم‌تیمی‌های AI و کاری که هرکدام می‌کنند", "Every AI teammate you have and what each one does", "Alle Ihre KI-Teammitglieder und was jedes davon tut"),
    docSlug: "navigation",
    tiers: [],
  },
  {
    key: "startup-builder",
    kind: "create",
    department: null,
    href: "/startup/builder",
    planGate: "credits",
    label: (l) => tri(l, "استارتاپ‌ساز", "Startup builder", "Startup-Builder"),
    blurb: (l) => tri(l, "یک ایده را به طرح کسب‌وکار قابل‌اجرا تبدیل می‌کند", "Turns an idea into a plan you can actually execute", "Verwandelt eine Idee in einen umsetzbaren Plan"),
    docSlug: "create",
    tiers: [],
  },

  // ─── Account ──────────────────────────────────────────────────────────────
  {
    key: "home",
    kind: "account",
    department: null,
    href: "/home",
    planGate: "free",
    label: (l) => tri(l, "خانه", "Home", "Startseite"),
    blurb: (l) => tri(l, "خلاصهٔ وضعیت کسب‌وکار و کار تیم AI شما", "A summary of your business and what your AI team has been doing", "Eine Übersicht über Ihr Unternehmen und die Arbeit Ihres KI-Teams"),
    docSlug: "navigation",
    tiers: [],
  },
  {
    key: "credits",
    kind: "account",
    department: null,
    href: "/credits",
    planGate: "free",
    label: (l) => tri(l, "اعتبار", "Credits", "Guthaben"),
    blurb: (l) => tri(l, "موجودی اعتبار، شارژ، و اینکه هر کار چقدر اعتبار می‌برد", "Your credit balance, top-ups, and what each action costs", "Ihr Guthaben, Aufladungen und was jede Aktion kostet"),
    docSlug: "account",
    tiers: [],
  },
  {
    key: "plans",
    kind: "account",
    department: null,
    href: "/plans",
    planGate: "free",
    label: (l) => tri(l, "پلن‌ها", "Plans", "Tarife"),
    blurb: (l) => tri(l, "مقایسهٔ پلن‌ها و افزونه‌ها (CRM، دستیار تلفنی)", "Compare plans and add-ons (CRM, Voice)", "Tarife und Add-ons vergleichen (CRM, Voice)"),
    docSlug: "account",
    tiers: [],
  },
  {
    key: "referral",
    kind: "account",
    department: null,
    href: "/referral",
    planGate: "free",
    label: (l) => tri(l, "معرفی دوستان", "Referrals", "Empfehlungen"),
    blurb: (l) => tri(l, "کد معرفی، کیف پول و درآمد معرفی شما", "Your referral code, wallet and referral earnings", "Ihr Empfehlungscode, Wallet und Ihre Empfehlungserlöse"),
    docSlug: "account",
    tiers: [],
  },
  {
    key: "settings",
    kind: "account",
    department: null,
    href: "/settings",
    planGate: "free",
    label: (l) => tri(l, "تنظیمات", "Settings", "Einstellungen"),
    blurb: (l) => tri(l, "پروفایل، زبان، واحد پول، تم و حساب کاربری", "Profile, language, currency, theme and account", "Profil, Sprache, Währung, Design und Konto"),
    docSlug: "account",
    tiers: [],
  },
];

const BY_KEY = new Map(CAPABILITIES.map((c) => [c.key, c]));

export function getCapability(key: string): Capability | undefined {
  return BY_KEY.get(key);
}

/** Capabilities `full_mode` can actually act in — i.e. those with at least one tool tier. */
export function actionableCapabilities(): Capability[] {
  return CAPABILITIES.filter((c) => c.tiers.length > 0);
}

/**
 * Knowledge-base documents that belong to no single capability — they answer
 * across the whole product, so nothing in CAPABILITIES points at them.
 */
export const STANDALONE_DOC_SLUGS = ["troubleshooting"];

/** Every knowledge-base document slug the doc-set is expected to contain. */
export function docSlugs(): string[] {
  return Array.from(new Set(CAPABILITIES.map((c) => c.docSlug).concat(STANDALONE_DOC_SLUGS))).sort();
}

/**
 * Whether a user on this plan/add-on tier can reach a capability. Used only to
 * word the assistant's answer honestly ("that's there, but it needs the CRM
 * add-on") — never as an authorisation decision, which stays with the route.
 */
export function isReachable(cap: Capability, ctx: { plan: string; crmPlan: string; voicePlan?: string | null }): boolean {
  switch (cap.planGate) {
    case "free":
    case "credits":
      return true;
    case "crm":
      return ctx.crmPlan !== "NONE" && !!ctx.crmPlan;
    case "crm:TEAM":
      return ctx.crmPlan === "TEAM";
    case "voice":
      return !!ctx.voicePlan && ctx.voicePlan !== "NONE";
  }
}
