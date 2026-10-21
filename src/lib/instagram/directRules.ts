export interface DirectRuleMatchable {
  triggerType: string;
  keywords: string;
}

/** Keyword rules win; fallback rules are considered only when no keyword matched. */
export function selectDirectRule<T extends DirectRuleMatchable>(rules: T[], message: string): T | undefined {
  const normalized = message.normalize("NFKC").toLocaleLowerCase();
  const keywordRule = rules.find((rule) => rule.triggerType === "keyword" && rule.keywords
    .split(/[,،]/)
    .some((keyword) => {
      const normalizedKeyword = keyword.normalize("NFKC").trim().toLocaleLowerCase();
      return normalizedKeyword.length > 0 && normalized.includes(normalizedKeyword);
    }));
  return keywordRule || rules.find((rule) => rule.triggerType === "ai_fallback") || rules.find((rule) => rule.triggerType === "all_messages");
}
