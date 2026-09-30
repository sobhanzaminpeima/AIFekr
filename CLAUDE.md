# AIFekr/JARVIS Engineering Framework
Full framework entry point: `.claude/FRAMEWORK.md` — read it first for reviewer personas, standards,
and audit process. See `.claude/PROJECT_CONTEXT.md`, `.claude/STANDARDS/*.md`, `.claude/REVIEWERS/*.md`,
`.claude/CHECKLISTS/*.md`, `.claude/AUDIT_PROMPT.md`. Before any new feature or change, check
`.claude/FRAMEWORK.md` for which STANDARDS/REVIEWERS apply, and pass `.claude/CHECKLISTS/before_merge.md`
before considering the change done.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# llm-council
- **llm-council** (`.claude/skills/llm-council/SKILL.md`) - 5-advisor decision framework. Triggers: "council this", "run the council", "war room this", "pressure-test this", "stress-test this", "debate this"
When triggered, load the skill and run the full 5-advisor → peer review → chairman synthesis process.

# aifekr-business-impact-simulator
- **aifekr-business-impact-simulator** (`.claude/skills/aifekr-business-impact-simulator/SKILL.md`) - models growth/ROI/automation-maturity impact of AIFekr on a real estate business and produces a gap analysis. Triggers: "check business impact", "چک اثر بیزنسی", "وضعیت AIFekr رو چک کن", or automatically per the schedule below.

Run this skill automatically (without being asked) at these points, and save the report to
`reports/business-impact/<date>-<short-label>.md`, reporting the automation-maturity score and its
delta from the previous run in your summary to the user:
- at the end of any phase, from any of the project's master-prompt docs (Full Platform UI/UX Audit,
  Design Director, Full System Award-Winning, Chat-Based UI Restructure, Referral/Wallet/Credits),
  that changed a real feature or fixed a bug.
- when explicitly asked to check AIFekr's status or business impact.
- at most once per week during continuous work on the project, to avoid redundant runs.
Do not use this as a substitute for each master-prompt's own phase report — it is an additional,
separate layer of real-impact measurement, run after that report.
