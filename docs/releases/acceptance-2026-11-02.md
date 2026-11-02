# AIFekr acceptance checkpoint — 2026-11-02

Status: partial acceptance, blocked on an approved test account, provider cost evidence and server access. This is not a production-release or defect-free certification.

## Repositories and preservation

- Backend base: `095aa7091d52e6650609e30b175ea02043bdcfd7`, confirmed against GitHub `main`.
- Original backend working branch: `feat/customer-growth`; existing modifications to CRM contact handling and `tsconfig.json` were preserved.
- Original UI working branch: `codex/first-success-media`, HEAD `77a11b6`; existing `next-env.d.ts` and `tsconfig.json` modifications were preserved.
- Changes were prepared in an isolated checkout. No original repository changes, environment files, keys or credentials were committed.
- Read both worktree AGENTS.md files, backend CLAUDE.md, current delivery/audit notes and UI QA notes. The referenced framework was absent from the backend worktree; it was subsequently found in the original `ai-platform/.claude` directory and read with its coding, UI/UX, security and before-merge standards. Its older stack descriptions were not used as current deployment facts.

## Confirmed defects and correction

English and German `/plans` displayed USD card prices but selected TRY settlement. Only TRY/EUR were selectable. This was reproduced in production Chrome in both languages. The shared component hardcoded TRY independently of the displayed currency.

The correction derives the currency directly from the language through the existing `packageCurrency` helper: Persian IRT, Turkish TRY, English/German USD. The conflicting currency picker is replaced by a readable settlement-currency label. Existing order creation still maps IRT to IRR for Zarinpal; existing USD/EUR shared-IBAN handling remains unchanged. No tariff, FX rate, credit allocation or bank account was edited.

The same component exposed the internal `CHAT_STARTER` category code in its selector and cards; it now has a localized chat label.

- Code published to `fix/acceptance-checkout-currency`: `ac64983f15671e3cfeffead07ab06b9229abf51b`.
- Draft PR: https://github.com/sobhanzaminpeima/AIFekr/pull/4
- Tested local commit: `6274bedb3db1a66511e73914aca2ad34bc8b1f6e`.
- Identical local/remote source tree: `638806302972d01cde0ba70a4a6aa6bfdf8ab294`. Commit metadata differs because publication used the connected GitHub API.
- Eight focused tests passed. Tests call the component's real quote handler with mocked hooks/network; they do not prove gateway settlement. The regression suite fails against the old component and passes against the correction.
- TypeScript passed: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Focused command: `node node_modules/vitest/vitest.mjs run --config acceptance.vitest.config.mts --configLoader runner`.
- No new full production build or deployment was completed.

## Production Chrome observations

The following are desktop Chrome viewport checks, not physical-phone tests. Widths were 360, 390 and 430 CSS pixels. The table records document scroll width, not a claim that every element is visually correct.

| Route | Scroll width at 360 | At 390 | At 430 | Scope |
|---|---:|---:|---:|---|
| `/home` | 345 | 375 | 415 | English page loaded; headings and navigation observed |
| `/settings` | 345 | 375 | 415 | Profile display only; no save/upload |
| `/credits` | 345 | 375 | 415 | Existing balance display only |
| `/wallet` | 345 | 375 | 415 | Existing wallet display only |
| `/voice-studio` | 345 | 375 | 415 | Workspace loaded; no synthesis |
| `/fitness` | 360 | 390 | 415 | Workspace loaded; no profile/log changes |
| `/video-factory` | 345 | 375 | 415 | Workspace loaded and visually inspected at 430; no generation |
| `/social` | 360 | 390 | 430 | No connected account shown; no connect/disconnect/publish/send |
| `/chat` | 360 | 390 | 430 | Turkish composer and controls; no message sent |

Additional observed interactions:

- Internal CRM drawer opened and closed with its close control at all three widths. Choosing Contacts closed the drawer. No document overflow was measured on the checked CRM view.
- Admin mobile menu opened at 360/390; choosing CRM closed it. Admin CRM displayed at 430.
- Main user sidebar opened at 430 and closed when choosing CRM. These observations do not cover every menu dismissal/focus case.
- Notification popover opened/closed. Its horizontal bounds were 13–333 at width 360, 43–363 at 390 and 83–403 at 430. No notification was marked read.
- Payment-history Pending filter survived reload with `?filter=pending`. There was no suitable pending bank order on the viewed account, so this is not a receipt/order recovery test.
- Chat Shift+Enter added a newline and typing enabled Send. The temporary draft was cleared; nothing was sent. An approximate one-credit cost was visible before sending.
- Persian/English/German/Turkish language controls were used. Substantial English copy remains in German/Turkish home/chat/package views; complete localization is not accepted.
- `/plans` initially showed an empty selector/card area, but cards loaded after refresh. The initial empty state was not established as a persistent failure.
- Authenticated visits to `/` and `/de` ended at `/chat`. Guest landing/login flows remain untested; the existing session was not logged out.
- Occasional browser DOM observations timed out; documented same-browser alternatives continued working. Work browser control was not reported as disabled and no alternate automation mechanism was used.
- Browser language was restored to Persian and temporary viewport override reset.

## Costs and production restrictions

No new paid generation or purchase was executed. The earlier short Cloudflare text call, both Cloudflare image attempts and the ElevenLabs call with the text `Hello from AIFekr.` remain unpriced. The image attempt followed by a test-tool failure is not assumed free. The entire USD 10 ceiling is conservatively reserved pending billing evidence; this is a budget hold, not an assertion of USD 10 actual spend.

The displayed Persian Chat Eco option was 199,000 toman for 30 days and 100 credits. No order was created. The earlier direct-provider tests and server-created FFmpeg MP4 do not establish product generation, user-credit deduction or refunds.

## Server and remaining acceptance

A read-only SSH connection attempt to the server address in project documentation was rejected at port 22 with `Permission denied`. No SSH, firewall, DNS or access settings were changed and no alternate route was used. The active release was not revalidated and no deployment/rollback operation was run.

The previous report names backend `.next-rel-48a04847` and UI `/var/www/aifekr-ui-v2-77a11b6`; these are historical report values, not newly confirmed live versions.

Remaining: guest login/landing; physical-phone keyboard and app switching; chat upload/edit/branch/project transfer; approved test-account Instagram OAuth/reconnect/account switch; real Zarinpal and IBAN purchase/callback/receipt/approval/activation; duplicate settlement; all paid product-generation, interruption, exact credit debit and refund tests; visual verification of the corrected component in a release build; server version/process verification and deployment with rollback.

JARVIS: this is a browser-safe checkout correction. Its separate frontend/SSO integration was not tested. Before-merge gates for end-to-end payment, corrected responsive UI and production release remain open; PR remains draft.
