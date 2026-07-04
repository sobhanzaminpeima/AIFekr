import { Camera, Send, PlaySquare } from "lucide-react";
import { prisma } from "@/lib/db/prisma";

const KEYS = ["social_instagram", "social_telegram", "social_youtube"] as const;

export default async function SocialFooterLinks() {
  const social: Record<string, string> = { social_instagram: "", social_telegram: "", social_youtube: "" };
  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: [...KEYS] } } });
    for (const r of rows) social[r.key] = r.value;
  } catch {}

  if (!social.social_instagram && !social.social_telegram && !social.social_youtube) return null;

  const links = [
    { href: social.social_instagram, icon: Camera },
    { href: social.social_telegram, icon: Send },
    { href: social.social_youtube, icon: PlaySquare },
  ].filter((l) => l.href);

  return (
    <div className="flex items-center justify-center gap-3 mb-4">
      {links.map((l, i) => (
        <a
          key={i}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <l.icon className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }} />
        </a>
      ))}
    </div>
  );
}
