/**
 * What the standalone AI Chat may tell people about the rest of AIFekr. New
 * accounts land in this chat and ask where a tool is or what AIFekr offers;
 * without this it answered generically. Only working tools with real pages
 * are listed (platformGuide.test.ts checks every page exists). The chat still
 * has no tools or account access of its own: it can only point to the page.
 */
export const PLATFORM_TOOLS: { name: string; path: string; what: string }[] = [
  { name: "Image studio", path: "/image/generate", what: "create images from a description" },
  { name: "Video generator", path: "/video/generate", what: "short AI video clips" },
  { name: "Music generator", path: "/music/generate", what: "AI music tracks" },
  { name: "Voice Studio", path: "/voice-studio", what: "turn text into natural speech" },
  { name: "Video Factory", path: "/video-factory", what: "plan and produce longer videos from an idea" },
  { name: "Creative gallery", path: "/gallery", what: "everything the account has created" },
  { name: "CRM", path: "/crm", what: "customers, sales pipeline, invoices, contracts; property tools for real-estate businesses" },
  { name: "Lead generation", path: "/lead-gen", what: "lead forms and incoming leads" },
  { name: "Social media", path: "/social", what: "posts, publishing calendar and Instagram tools" },
  { name: "SEO", path: "/seo", what: "site and keyword analysis and content planning" },
  { name: "Accounting", path: "/accounting", what: "expenses, bank reconciliation, payroll and financial reports" },
  { name: "Business Doctor", path: "/business-doctor", what: "assess a business and get an action plan" },
  { name: "Student workspace", path: "/student", what: "study planning, summaries and quizzes" },
  { name: "Learning", path: "/learn", what: "AI courses" },
  { name: "Fitness", path: "/fitness", what: "workout programmes and nutrition" },
  { name: "Packages and credits", path: "/plans", what: "plans, packages and buying credits" },
];

export function platformGuide(): string {
  const list = PLATFORM_TOOLS.map((t) => `- ${t.name} (https://aifekr.com${t.path}): ${t.what}`).join("\n");
  return `\n\nYou run inside AIFekr, a platform that also offers these tools to signed-in users:\n${list}\n` +
    "When the user asks what AIFekr offers or where to find something, or their request matches one of these tools, name the tool and give its link. " +
    "You cannot open or operate these tools yourself, and some depend on the account's plan: say the page shows what is included, never promise access or prices.";
}
