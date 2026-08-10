export interface SeoIssue {
  id: string;
  severity: "error" | "warning" | "info";
  messageFa: string;
  messageEn: string;
}

export interface SeoAuditResult {
  score: number; // 0-100
  issues: SeoIssue[];
}

interface AuditablePost {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  keywords: string;
  heroImageUrl?: string | null;
}

/** Rule-based SEO audit — same category of checks as the app's existing SEO Tools checkers, run directly against a generated post instead of a live URL. */
export function auditContentPost(post: AuditablePost): SeoAuditResult {
  const issues: SeoIssue[] = [];
  let score = 100;

  const deduct = (n: number, issue: SeoIssue) => {
    score -= n;
    issues.push(issue);
  };

  const metaTitleLen = post.metaTitle?.length || 0;
  if (metaTitleLen === 0) {
    deduct(15, { id: "meta-title-missing", severity: "error", messageFa: "عنوان سئو (Meta Title) خالی است.", messageEn: "SEO title is missing." });
  } else if (metaTitleLen < 30 || metaTitleLen > 65) {
    deduct(6, {
      id: "meta-title-length",
      severity: "warning",
      messageFa: `طول عنوان سئو ${metaTitleLen} کاراکتر است — بازه‌ی ایده‌آل ۳۰ تا ۶۵ کاراکتر است.`,
      messageEn: `SEO title is ${metaTitleLen} chars — ideal range is 30-65.`,
    });
  }

  const metaDescLen = post.metaDescription?.length || 0;
  if (metaDescLen === 0) {
    deduct(12, { id: "meta-desc-missing", severity: "error", messageFa: "توضیحات متا (Meta Description) خالی است.", messageEn: "Meta description is missing." });
  } else if (metaDescLen < 110 || metaDescLen > 165) {
    deduct(5, {
      id: "meta-desc-length",
      severity: "warning",
      messageFa: `طول توضیحات متا ${metaDescLen} کاراکتر است — بازه‌ی ایده‌آل ۱۱۰ تا ۱۶۵ کاراکتر است.`,
      messageEn: `Meta description is ${metaDescLen} chars — ideal range is 110-165.`,
    });
  }

  if (!/^[a-z0-9-]+$/.test(post.slug || "")) {
    deduct(6, {
      id: "slug-format",
      severity: "warning",
      messageFa: "اسلاگ باید فقط شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.",
      messageEn: "Slug should only contain lowercase letters, numbers, and hyphens.",
    });
  }

  const wordCount = (post.content || "").trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 600) {
    deduct(10, {
      id: "content-length",
      severity: "warning",
      messageFa: `متن مقاله ${wordCount} کلمه است — برای رقابت در نتایج گوگل حداقل ۶۰۰ کلمه توصیه می‌شود.`,
      messageEn: `Article is ${wordCount} words — at least 600 is recommended to compete in search results.`,
    });
  }

  const h2Count = (post.content?.match(/^##\s+.+/gm) || []).length;
  if (h2Count < 2) {
    deduct(8, {
      id: "heading-structure",
      severity: "warning",
      messageFa: `فقط ${h2Count} زیرعنوان (H2) در متن پیدا شد — برای خوانایی و سئو حداقل ۲ زیرعنوان توصیه می‌شود.`,
      messageEn: `Only ${h2Count} H2 subheading(s) found — at least 2 are recommended for readability and SEO.`,
    });
  }

  const primaryKeyword = (post.keywords || "").split(/[,،]/)[0]?.trim().toLowerCase();
  if (primaryKeyword) {
    const inTitle = (post.title || "").toLowerCase().includes(primaryKeyword);
    if (!inTitle) {
      deduct(8, {
        id: "keyword-in-title",
        severity: "warning",
        messageFa: `کلمه کلیدی اصلی «${primaryKeyword}» در عنوان مقاله دیده نمی‌شود.`,
        messageEn: `Primary keyword "${primaryKeyword}" was not found in the article title.`,
      });
    }
    const occurrences = (post.content?.toLowerCase().split(primaryKeyword).length || 1) - 1;
    const density = wordCount > 0 ? (occurrences / wordCount) * 100 : 0;
    if (density > 3) {
      deduct(5, {
        id: "keyword-density-high",
        severity: "info",
        messageFa: `تراکم کلمه کلیدی «${primaryKeyword}» حدود ${density.toFixed(1)}٪ است — بالاتر از ۳٪ ممکن است keyword stuffing تلقی شود.`,
        messageEn: `Keyword density for "${primaryKeyword}" is ~${density.toFixed(1)}% — above 3% can read as keyword stuffing.`,
      });
    } else if (density === 0) {
      deduct(6, {
        id: "keyword-density-zero",
        severity: "warning",
        messageFa: `کلمه کلیدی اصلی «${primaryKeyword}» اصلاً در متن مقاله تکرار نشده است.`,
        messageEn: `Primary keyword "${primaryKeyword}" does not appear anywhere in the article body.`,
      });
    }
  }

  const linkCount = (post.content?.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  if (linkCount === 0) {
    deduct(5, {
      id: "no-links",
      severity: "info",
      messageFa: "هیچ لینکی (داخلی یا خارجی) در متن مقاله وجود ندارد.",
      messageEn: "No links (internal or external) were found in the article body.",
    });
  }

  if (!post.heroImageUrl) {
    deduct(6, {
      id: "no-hero-image",
      severity: "info",
      messageFa: "این پست هنوز تصویر شاخص (Hero Image) ندارد.",
      messageEn: "This post doesn't have a hero image yet.",
    });
  }

  return { score: Math.max(0, Math.round(score)), issues };
}
