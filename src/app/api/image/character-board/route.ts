export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { CREDIT_COSTS } from "@/lib/utils/credits";
import { getAvailableCredits, deductCredits } from "@/lib/utils/teamCredits";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";
import { isFeatureEnabled, FEATURE_DISABLED_MESSAGE } from "@/lib/utils/featureToggles";
import { checkForClearFace } from "@/lib/ai/faceCheck";
import { generateCharacterBoard, type CharacterBrief, type Genre } from "@/lib/ai/characterBoard";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

const VALID_GENRES: Genre[] = [
  "cinematic_drama", "luxury_editorial", "sci_fi", "fantasy",
  "business_corporate", "streetwear_urban", "minimal_tech",
];

// Three image generations go into one board (see characterBoard.ts's doc
// comment for why it's three calls, not one) -- priced as three standard
// image generations, same per-unit cost the rest of /image/generate uses.
const CHARACTER_BOARD_CREDIT_COST = CREDIT_COSTS.image_standard * 3;

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  if (!(await isFeatureEnabled("image"))) {
    return NextResponse.json({ error: FEATURE_DISABLED_MESSAGE.image }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { referenceImageUrl, name, title, role, genre, personality, wardrobe, age, height, origin, quote, primaryColor, secondaryColor, accentColor } = body as {
    referenceImageUrl?: string; name?: string; title?: string; role?: string; genre?: string; personality?: string;
    wardrobe?: string; age?: string; height?: string; origin?: string; quote?: string;
    primaryColor?: string; secondaryColor?: string; accentColor?: string;
  };

  if (!referenceImageUrl) {
    return NextResponse.json({ error: tri(lang, "یک عکس چهره آپلود کنید", "Upload a face photo", "Laden Sie ein Gesichtsfoto hoch") }, { status: 400 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: tri(lang, "نام کاراکتر الزامی است", "Character name is required", "Der Name der Figur ist erforderlich") }, { status: 400 });
  }
  const resolvedGenre: Genre = VALID_GENRES.includes(genre as Genre) ? (genre as Genre) : "cinematic_drama";

  // Non-negotiable: never call the image API without a detected face --
  // the entire feature's promise is face-lock, so an ambiguous/failed check
  // blocks generation rather than silently proceeding on a generic face.
  const faceCheck = await checkForClearFace(referenceImageUrl);
  if (!faceCheck.hasClearFace) {
    return NextResponse.json({
      error: tri(lang,
        "چهرهٔ واضحی در این عکس پیدا نشد. لطفاً عکسی با یک چهرهٔ کامل و روشن آپلود کنید.",
        "No clear face was detected in this photo. Please upload a photo with one clear, unobstructed face.",
        "In diesem Foto wurde kein klares Gesicht erkannt. Bitte laden Sie ein Foto mit einem klaren, nicht verdeckten Gesicht hoch."),
    }, { status: 422 });
  }

  const creditCost = CHARACTER_BOARD_CREDIT_COST;
  if ((await getAvailableCredits(user.id)) < creditCost) {
    return NextResponse.json({ error: tri(lang, `اعتبار کافی ندارید. نیاز به ${creditCost} اعتبار دارید`, `You don't have enough credits. This needs ${creditCost} credits`, `Sie haben nicht genug Guthaben. Dies erfordert ${creditCost} Guthabenpunkte`) }, { status: 402 });
  }

  const brief: CharacterBrief = {
    name: name.trim(), title, role, genre: resolvedGenre, personality, wardrobe, age, height, origin, quote,
    primaryColor, secondaryColor, accentColor,
  };

  try {
    const { buffer } = await generateCharacterBoard(brief, referenceImageUrl);

    // Same fallback the main /api/image/generate route already applies to
    // every upload: storage being unconfigured shouldn't throw away a
    // generation that already cost real API calls and credits -- fall back
    // to a data: URI so the user still gets their board.
    let url: string;
    try {
      const key = getStorageKey(user.id, "image", "character-board.png");
      url = await uploadToStorage(buffer, key, "image/png");
    } catch {
      url = `data:image/png;base64,${buffer.toString("base64")}`;
    }

    await deductCredits(user.id, creditCost);

    const saved = await prisma.generatedImage.create({
      data: {
        userId: user.id,
        prompt: `Character board: ${brief.name}`,
        style: "cinematic",
        url,
        sourceImageUrl: referenceImageUrl,
        credits: creditCost,
        kind: "character_sheet",
      },
    });

    await prisma.usageLog.create({
      data: { userId: user.id, type: "image", credits: creditCost, metadata: JSON.stringify({ kind: "character_sheet", genre: resolvedGenre }) },
    });

    return NextResponse.json({ image: saved, credits_used: creditCost });
  } catch (err) {
    console.error("character board generation error:", err);
    return NextResponse.json({ error: tri(lang, "خطا در ساخت کاراکتر بورد", "Failed to generate the character board", "Fehler beim Erstellen des Charakter-Boards") }, { status: 500 });
  }
}
