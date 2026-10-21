# Chat history fix — 2026-10-04

Cause: Prisma SQL `tool != support` excluded NULL tools; ordinary chats store tool=NULL. The sidebar query now explicitly includes NULL and other tools, while retaining user/business boundaries and excluding support.

The sidebar receives new chat events as soon as a chat response starts, including media conversations; resumed chats update their timestamp before generation, so they rise to the top even if cancelled. Existing chats are preserved.

Validation: full suite 106 files / 771 tests passed. Database regression verifies ordinary NULL-tool and media chats appear, support and another user's chats do not. TypeScript and targeted ESLint passed. Production DB read-only inspection confirmed 10 ordinary chats affected by the old filter. No database migration or deletion.
