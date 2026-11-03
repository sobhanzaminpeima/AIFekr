import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement, ReactNode} from "react";
import DynamicPlans from "./DynamicPlans";

const state = vi.hoisted(() => ({lang: "en", plans: [] as Record<string, unknown>[]}));
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({lang: state.lang}),
  tri: (lang: "fa" | "en" | "de" | "tr", fa: string, en: string, de: string, tr: string) => ({fa,en,de,tr}[lang]),
}));
// Exercise the component's rendered controls and real checkout handler without
// mounting effects or touching a database, gateway or paid provider.
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: () => {},
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => [Array.isArray(initial) ? state.plans : initial, vi.fn()],
}));

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children as ReactNode)];
}

describe("plan checkout uses the language's payment currency", () => {
  beforeEach(() => {
    state.plans = [{planCode:"CHAT_ECO_30", category:"CHAT_STARTER", name:"Chat", nameEn:"Chat",
      termPrices:JSON.stringify({monthly:1000}), baseCurrency:"USD", credits:100, duration:30,
      features:"History", entitlements:JSON.stringify({fixedPrices:{IRT:{monthly:199000},TRY:{monthly:99},USD:{monthly:1000}}})}];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({quote:{id:"test-quote"}})}));
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([["fa","IRT"],["tr","TRY"],["en","USD"],["de","USD"]])(
    "%s sends %s in the quote and exposes no conflicting payment selector", async (lang, currency) => {
      state.lang = lang;
      // /api/packages prices each term in the visitor's currency (lib/marketing/entryPlans resolveOffer).
      state.plans = state.plans.map(p => ({...p, offers:{monthly:{minor:{IRT:199000,TRY:99,USD:1000}[currency],currency}}}));
      const rendered = nodes(DynamicPlans({category:"CHAT_STARTER"}));
      const choose = rendered.find(element => element.type === "button" && typeof element.props.onClick === "function" && element.props["aria-pressed"] === undefined);
      expect(choose).toBeDefined();
      await (choose!.props.onClick as () => void)();
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, request] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe("/api/billing/quote");
      expect(JSON.parse(String(request!.body))).toEqual({plan:"CHAT_ECO_30",period:"monthly",currency});
      expect(rendered.filter(element => element.type === "select")).toHaveLength(0);
    },
  );

  it("labels the chat category instead of exposing its internal code", () => {
    state.lang = "en";
    const rendered = nodes(DynamicPlans({}));
    const option = rendered.find(element => element.type === "option" && element.props.value === "CHAT_STARTER");
    expect(option?.props.children).toBe("AI Chat");
  });
});

describe("a package without a price in the visitor's currency", () => {
  // VF_CREATOR_5 on production: priced in Toman only (base IRT), no fixed USD/TRY price.
  const tomanOnly = {planCode:"VF_CREATOR_5", category:"VIDEO_FACTORY", name:"پنج ویدیو", nameEn:"Five videos",
    termPrices:JSON.stringify({monthly:4250000}), baseCurrency:"IRT", credits:500, duration:30, features:"5 videos",
    purchaseAvailable:true, entitlements:JSON.stringify({limits:{compareAtToman:7000000}})};
  const text = (node: ReactNode): string => nodes(node).map(e => typeof e.props.children === "string" || typeof e.props.children === "number" ? String(e.props.children) : Array.isArray(e.props.children) ? e.props.children.filter(c => typeof c === "string" || typeof c === "number").join("") : "").join(" ");
  beforeEach(() => { state.plans = [tomanOnly]; vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["en", "de", "tr"])("%s: is not offered in Toman, the landing omits it too", (lang) => {
    state.lang = lang;
    const rendered = nodes(DynamicPlans({category:"VIDEO_FACTORY"}));
    expect(text(DynamicPlans({category:"VIDEO_FACTORY"}))).not.toMatch(/تومان|Toman/);
    expect(rendered.some(e => e.type === "article")).toBe(false);
  });
  it("fa: shows the Toman price with the admin's before-discount price", () => {
    state.lang = "fa";
    state.plans = [{...tomanOnly, offers:{monthly:{minor:4250000,currency:"IRT",compareAtMinor:7000000}}}];
    const out = text(DynamicPlans({category:"VIDEO_FACTORY"}));
    expect(out).toContain((4250000).toLocaleString("fa"));
    expect(out).toContain((7000000).toLocaleString("fa"));
  });
});
