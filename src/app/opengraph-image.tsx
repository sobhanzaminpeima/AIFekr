import { ImageResponse } from "next/og";

// Default social-share card for every page (Open Graph + Twitter). Kept to
// Latin text so it renders with the built-in font on any server.
export const runtime = "edge";
export const alt = "AiFekr — AI agents for your business";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px",
          background: "linear-gradient(135deg, #0a0a0f 0%, #1a1208 55%, #7c2d12 100%)", color: "#f5f5f5", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, color: "#fb923c", fontWeight: 700, letterSpacing: 2 }}>AIFEKR</div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginTop: 24 }}>An AI team built for your business</div>
        <div style={{ display: "flex", fontSize: 32, color: "#a1a1aa", marginTop: 32 }}>Chat · Image · Video · Music · CRM · Accounting · SEO</div>
        <div style={{ display: "flex", fontSize: 30, color: "#ea580c", marginTop: 48, fontWeight: 600 }}>aifekr.com</div>
      </div>
    ),
    size,
  );
}
