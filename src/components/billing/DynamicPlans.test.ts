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
    expect(option?.props.children).toBe("Chat");
  });
});
