import { afterEach, describe, expect, it, vi } from "vitest";
import { pageLang, resolveTheme, v2Handles } from "./uiTheme";

describe("ui theme routing", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("matches a ready route and the pages under it, never a lookalike", () => {
    const routes = ["/pricing", "/guides"];
    expect(v2Handles("/pricing", routes)).toBe(true);
    expect(v2Handles("/pricing/", routes)).toBe(true);
    expect(v2Handles("/guides/contacts?x=1", routes)).toBe(true);
    expect(v2Handles("/pricing-old", routes)).toBe(false);
    expect(v2Handles("/chat", routes)).toBe(false);
  });
  it("treats / as the landing page only", () => {
    expect(v2Handles("/", ["/"])).toBe(true);
    expect(v2Handles("/chat", ["/"])).toBe(false);
  });
  it("sends only the rebuilt pages to v2", () => {
    vi.stubEnv("UI_V2_ACCOUNTING_ENABLED", "1");
    for (const path of ["/", "/pricing", "/about", "/contact", "/guides", "/guides/x", "/features/crm", "/solutions/business", "/login", "/register", "/home", "/chat", "/chat/abc", "/create", "/gallery", "/image/gallery", "/image/generate", "/video/generate", "/music/generate", "/voice-studio", "/video-factory", "/crm", "/accounting", "/accounting/bank", "/accounting/accounts/1000", "/welcome", "/privacy", "/terms", "/security", "/payments"]) expect(v2Handles(path)).toBe(true);
    for (const path of ["/chatbot", "/privacy/x", "/payments/x", "/admin/logs", "/pricing-old", "/login-old", "/home/x", "/image/generate/x", "/create/image", "/gallery/x", "/voice-studio/x", "/video-factory/x", "/crm/x", "/accountingx"]) expect(v2Handles(path)).toBe(false);
  });
  it("keeps accounting classic until its isolated rollout is enabled", () => {
    vi.stubEnv("UI_V2_ACCOUNTING_ENABLED", "0");
    expect(v2Handles("/accounting")).toBe(false);
    expect(v2Handles("/accounting/bank")).toBe(false);
    expect(v2Handles("/crm")).toBe(true);
  });
  it("enables social only with its own rollout flag and exact route", () => {
    vi.stubEnv("UI_V2_SOCIAL_ENABLED", "0"); expect(v2Handles("/social")).toBe(false);
    vi.stubEnv("UI_V2_SOCIAL_ENABLED", "1"); expect(v2Handles("/social?tab=content")).toBe(true);
    expect(v2Handles("/social/unknown")).toBe(false);
    expect(v2Handles("/social-other")).toBe(false);
  });
  it("keeps lead generation isolated behind its own exact-route flag",()=>{
    vi.stubEnv("UI_V2_LEADS_ENABLED","0");expect(v2Handles("/lead-gen")).toBe(false);
    vi.stubEnv("UI_V2_LEADS_ENABLED","1");expect(v2Handles("/lead-gen?tab=forms")).toBe(true);
    expect(v2Handles("/lead-gen/unknown")).toBe(false);expect(v2Handles("/lead-generate")).toBe(false);
  });
  it("rolls advisory, website, referral and startup back independently",()=>{
    for(const [path,flag] of [["/business-doctor","UI_V2_ADVISORY_ENABLED"],["/meeting","UI_V2_ADVISORY_ENABLED"],["/website-designer","UI_V2_WEBSITE_ENABLED"],["/referral","UI_V2_REFERRAL_ENABLED"],["/startup/builder","UI_V2_STARTUP_ENABLED"]]) {
      vi.stubEnv(flag,"0");expect(v2Handles(path)).toBe(false);vi.stubEnv(flag,"1");expect(v2Handles(path+"?tab=history")).toBe(true);expect(v2Handles(path+"/unknown")).toBe(false);
    }
  });
  it("only enables the rebuilt SEO entry, leaving legacy detail routes intact",()=>{
    vi.stubEnv("UI_V2_SEO_ENABLED","0");expect(v2Handles("/seo")).toBe(false);
    vi.stubEnv("UI_V2_SEO_ENABLED","1");expect(v2Handles("/seo?tab=verify")).toBe(true);expect(v2Handles("/seo/sites/unknown")).toBe(false);expect(v2Handles("/seo/intelligence")).toBe(true);expect(v2Handles("/seo/sites")).toBe(true);expect(v2Handles("/seo/agent-pipeline")).toBe(true);
  });
  it("isolates each final module rollout and preserves legacy detail pages",()=>{
    for(const [path,flag] of [["/ceo","UI_V2_TEAM_ENABLED"],["/agents","UI_V2_TEAM_ENABLED"],["/organization/onboarding","UI_V2_ORGANIZATION_ENABLED"],["/voice-agent","UI_V2_CALL_CENTER_ENABLED"],["/learn","UI_V2_ACADEMY_ENABLED"],["/owner","UI_V2_OWNER_ENABLED"],["/settings","UI_V2_PROFILE_ENABLED"],["/student","UI_V2_FINAL_MODULES_ENABLED"],["/fitness","UI_V2_FINAL_MODULES_ENABLED"],["/fitness/marketplace","UI_V2_FINAL_MODULES_ENABLED"],["/play","UI_V2_FINAL_MODULES_ENABLED"]]){
      vi.stubEnv(flag,"0");expect(v2Handles(path)).toBe(false);
      vi.stubEnv(flag,"1");expect(v2Handles(path+"?tab=profile")).toBe(true);
      // /student/<slug> is the public student profile, served by the new design.
      if(path!=="/student")expect(v2Handles(path+"/not-ready")).toBe(false);
    }
  });
  it("decides a page language like getServerLang: a valid lang cookie first", async () => {
    expect(await pageLang("de")).toBe("de");
    expect(await pageLang("tr")).toBe("tr");
  });
  it("lets a valid preview cookie override the site theme", () => {
    expect(resolveTheme("classic", "v2")).toBe("v2");
    expect(resolveTheme("v2", "classic")).toBe("classic");
    expect(resolveTheme("v2", "bogus")).toBe("v2");
    expect(resolveTheme("classic", undefined)).toBe("classic");
  });
});

it("keeps the public 1980s gallery out of the shared-report route", () => {
  expect(v2Handles("/share/1980s")).toBe(true);
  expect(v2Handles("/share/abc123")).toBe(true);
  expect(v2Handles("/f/form")).toBe(true);
  expect(v2Handles("/p/1")).toBe(true);
  expect(v2Handles("/plans")).toBe(true);
});

it("serves the industry pages and public student profiles in the new design", () => {
  expect(v2Handles("/industry")).toBe(true);
  expect(v2Handles("/industry/restaurant")).toBe(true);
  expect(v2Handles("/student/someone")).toBe(true);
  expect(v2Handles("/student/chat")).toBe(false);
  expect(v2Handles("/welcome/setup")).toBe(true);
  expect(v2Handles("/admin/users")).toBe(true);
  expect(v2Handles("/admin/users/abc")).toBe(true);
  expect(v2Handles("/admin/users/abc/x")).toBe(false);
  expect(v2Handles("/admin/dashboard")).toBe(true);
  expect(v2Handles("/admin")).toBe(true);
  expect(v2Handles("/admin/settings")).toBe(false);
  expect(v2Handles("/admin/financial")).toBe(true);
  expect(v2Handles("/admin/financial/customers")).toBe(true);
  expect(v2Handles("/admin/subscriptions")).toBe(true);
  for (const p of ["/admin/revenue", "/admin/credit-tiers", "/admin/billing/rates"]) expect(v2Handles(p)).toBe(true);
  expect(v2Handles("/admin/billing/promotions")).toBe(true);
  expect(v2Handles("/admin/invites/manage")).toBe(true);
  expect(v2Handles("/admin/invites")).toBe(false);
  expect(v2Handles("/admin/packages")).toBe(true);
  expect(v2Handles("/admin/financial/invoices/x")).toBe(false);
});
