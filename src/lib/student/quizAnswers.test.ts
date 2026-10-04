import { describe, expect, it } from "vitest";
import { hasCompleteQuizAnswers } from "./quizAnswers";

describe("quiz completion", () => {
  it("does not enable submission after answering only the last question", () => {
    const answers: number[] = []; answers[7] = 0;
    expect(hasCompleteQuizAnswers(answers, 8)).toBe(false);
  });
  it("accepts option zero and out-of-order completed answers", () => {
    const answers: number[] = []; answers[2] = 0; answers[0] = 1; answers[1] = 2;
    expect(hasCompleteQuizAnswers(answers, 3)).toBe(true);
  });
  it("rejects missing, invalid and surplus answers", () => {
    for (const answers of [[], [0], [0, -1], [0, NaN], [0, 0.5], [0, 1, 2]]) expect(hasCompleteQuizAnswers(answers, 2)).toBe(false);
  });
});
