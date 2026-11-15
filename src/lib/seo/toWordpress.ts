/**
 * SEO → content → publish (roadmap E14): a saved SEO result becomes a
 * WordPress draft. Always a draft: putting it live is the owner's choice in
 * WordPress. Only written content qualifies, not keyword lists or plans.
 */
export const WP_READY_TOOLS = ["content", "meta"];

export function draftFromGeneration(g: { tool: string; keyword: string | null; output: string }) {
  if (!WP_READY_TOOLS.includes(g.tool)) return null;
  const heading = g.output.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim();
  const title = (heading || g.keyword || "Draft").replace(/[*_`#]/g, "").slice(0, 120);
  const slug = title.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "draft";
  const firstParagraph = g.output.split(/\n{2,}/).map((p) => p.replace(/[#*_`>]/g, "").trim()).find((p) => p.length > 40) ?? "";
  return {
    title,
    slug,
    excerpt: firstParagraph.slice(0, 160),
    seo: { title: title.slice(0, 60), description: firstParagraph.slice(0, 155), ...(g.keyword ? { focusKeyword: g.keyword } : {}) },
  };
}
