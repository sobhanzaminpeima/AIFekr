import { describe, it, expect } from "vitest";
import { looksLikeProductQuestion } from "./productContext";

/**
 * QA 2026-09-15, U10: asked what AIFekr can do, the main chat had no idea and
 * asked the user for an official source — while the knowledge base that answers
 * exactly that was wired only to the support widget.
 *
 * The gate matters in both directions: missing a product question costs a bad
 * answer, but firing on ordinary messages costs an embedding call and the KB
 * block on every "hello".
 */
describe("looksLikeProductQuestion", () => {
  it("catches product questions in all three languages", () => {
    expect(looksLikeProductQuestion("AIFekr چیکار می‌تونه بکنه؟")).toBe(true);
    expect(looksLikeProductQuestion("قابلیت‌های این پلتفرم چیه؟")).toBe(true);
    expect(looksLikeProductQuestion("What can AIFekr do for my agency?")).toBe(true);
    expect(looksLikeProductQuestion("What is this platform exactly?")).toBe(true);
    expect(looksLikeProductQuestion("Was kann diese Plattform?")).toBe(true);
  });

  it("catches 'where do I find X' navigation questions", () => {
    expect(looksLikeProductQuestion("در این پلتفرم فاکتورها کجاست؟")).toBe(true);
    expect(looksLikeProductQuestion("Where do I find invoices in this platform?")).toBe(true);
  });

  it("does not fire on ordinary chat", () => {
    expect(looksLikeProductQuestion("سلام")).toBe(false);
    expect(looksLikeProductQuestion("یه ایمیل برای مشتریم بنویس")).toBe(false);
    expect(looksLikeProductQuestion("Write me a cold email for a real estate lead")).toBe(false);
    expect(looksLikeProductQuestion("What is a good commission rate?")).toBe(false);
  });

  it("does not fire on a business question that merely mentions features", () => {
    // Names no product, so it's a question about the user's business, not ours.
    expect(looksLikeProductQuestion("what features should my website have")).toBe(false);
  });
});
