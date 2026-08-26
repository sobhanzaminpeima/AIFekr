import { forwardRef } from "react";

/**
 * The invite card's actual pixel content (1080×1350 — Instagram-story-ish
 * proportions, since these get shared over WhatsApp/DM). Rendered at full
 * size always; the caller scales it down visually for on-screen preview
 * via a CSS transform on a wrapper, but html-to-image captures this node
 * directly so the exported PNG is always full resolution regardless of
 * how small the preview looks on screen.
 *
 * Phase 4: placeholder brand (dark bg + generic accent, system fonts).
 * Phase 5 swaps in the real logo asset + brand-tokens.ts palette/fonts —
 * this component's structure/props are not expected to change, only the
 * visual styling inside it.
 */

export type CardLang = "fa" | "en" | "de";

export interface InviteCardProps {
  lang: CardLang;
  name: string;
  username: string;
  password: string;
  referralLink: string;
  trialDays: number;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

const STRINGS: Record<CardLang, { title: string; subtitle: string; usernameLabel: string; passwordLabel: string; linkLabel: string; proBadge: string; packageBadge: string; footer: string }> = {
  fa: {
    title: "دعوت‌نامهٔ AiFekr",
    subtitle: "دسترسی کامل، آمادهٔ استفاده",
    usernameLabel: "یوزرنیم",
    passwordLabel: "پسورد موقت",
    linkLabel: "لینک اختصاصی شما",
    proBadge: "Pro — ۷ روز رایگان",
    packageBadge: "پکیج املاک کامل",
    footer: "aifekr.com",
  },
  en: {
    title: "AiFekr Invitation",
    subtitle: "Full access, ready to use",
    usernameLabel: "Username",
    passwordLabel: "Temporary password",
    linkLabel: "Your personal link",
    proBadge: "Pro — 7 days free",
    packageBadge: "Full Real Estate Package",
    footer: "aifekr.com",
  },
  de: {
    title: "AiFekr-Einladung",
    subtitle: "Voller Zugang, sofort einsatzbereit",
    usernameLabel: "Benutzername",
    passwordLabel: "Vorläufiges Passwort",
    linkLabel: "Dein persönlicher Link",
    proBadge: "Pro — 7 Tage gratis",
    packageBadge: "Komplettes Immobilien-Paket",
    footer: "aifekr.com",
  },
};

export { CARD_WIDTH, CARD_HEIGHT };

const InviteCardCanvas = forwardRef<HTMLDivElement, InviteCardProps>(function InviteCardCanvas(
  { lang, name, username, password, referralLink, trialDays },
  ref
) {
  const s = STRINGS[lang];
  const isRtl = lang === "fa";

  return (
    <div
      ref={ref}
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: "linear-gradient(160deg, #0B0B0C, #141414)",
        color: "#fff",
        fontFamily: isRtl ? "Vazirmatn, Tahoma, sans-serif" : "Poppins, Inter, Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: 72,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft orange glow accent — placeholder for the logo's own glow, phase 5 */}
      <div style={{ position: "absolute", top: -120, [isRtl ? "right" : "left"]: -120, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,130,31,0.35), transparent 70%)" }} />

      {/* Wordmark placeholder — real logo asset arrives phase 5 */}
      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 1, zIndex: 1 }}>
        <span style={{ color: "#fff" }}>Ai</span><span style={{ color: "#F5821F" }}>Fekr</span>
      </div>
      <div style={{ fontSize: 16, color: "#B8B8BC", marginTop: 4, zIndex: 1 }}>Artificial Intelligence &amp; Insight</div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #F5821F, transparent)", margin: "40px 0", zIndex: 1 }} />

      <div style={{ zIndex: 1 }}>
        <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.3 }}>{s.title}</div>
        <div style={{ fontSize: 20, color: "#B8B8BC", marginTop: 8 }}>{s.subtitle}</div>

        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 36 }}>{name}</div>

        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <span style={{ padding: "8px 18px", borderRadius: 999, background: "rgba(245,130,31,0.15)", border: "1px solid rgba(245,130,31,0.5)", color: "#F5821F", fontSize: 18, fontWeight: 600 }}>{s.proBadge}</span>
          <span style={{ padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 18, fontWeight: 600 }}>{s.packageBadge}</span>
        </div>

        {/* Credential box */}
        <div style={{ marginTop: 44, background: "#1C1C1E", border: "1px solid rgba(245,130,31,0.35)", borderRadius: 20, padding: 28 }}>
          <CredentialRow label={s.usernameLabel} value={username} />
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "18px 0" }} />
          <CredentialRow label={s.passwordLabel} value={password} />
        </div>

        {/* Referral link */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 15, color: "#B8B8BC" }}>{s.linkLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#F5821F", marginTop: 6, wordBreak: "break-all", direction: "ltr", textAlign: isRtl ? "right" : "left" }}>{referralLink}</div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{s.footer}</span>
        <span style={{ fontSize: 14, color: "#B8B8BC" }}>{trialDays} {isRtl ? "روز" : "days"}</span>
      </div>
    </div>
  );
});

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: 16, color: "#B8B8BC" }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", direction: "ltr", wordBreak: "break-all", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default InviteCardCanvas;
