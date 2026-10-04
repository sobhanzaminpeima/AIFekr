/** Array length alone does not detect unanswered holes when the last question is answered first. */
export function hasCompleteQuizAnswers(answers: readonly number[], questionCount: number): boolean {
  return questionCount > 0 && answers.length === questionCount && Array.from({ length: questionCount }, (_, index) => answers[index]).every((answer) => Number.isInteger(answer) && answer >= 0);
}
