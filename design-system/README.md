# AIfekr — Design foundation, phase 1

Approved direction: **01, charcoal and orange**. Persian uses self-hosted Vazirmatn; English/German use self-hosted Inter. Fonts include their SIL OFL licenses in `public/fonts`.

## Source of truth

- `src/styles/tokens.css`: semantic colors for both themes, typography, spacing, radius, shadows, duration and easing.
- `src/styles/fonts.css`: variable WOFF2 faces with unicode subsets and `font-display: swap`; no runtime Google Fonts request.
- `src/styles/foundation.css`: shared control and feedback styles, scoped to `ui-*`.
- `src/components/ui/foundation`: Button, InputField, Panel, StatusBadge, EmptyState, Skeleton, LoadingState.
- `src/lib/i18n/foundation.ts`: complete fa/en/de copy for foundation controls.

Use `--action-bg` with `--action-text` for filled actions, `--accent` for emphasis, and status colors only for semantic status. Color alone never conveys status: badges need text. Keep `--brand` for branding. Legacy `--primary` is retained as a compatibility alias to the original brand orange; existing white-on-brand controls are **not** included in the new contrast guarantee and will migrate page by page.

Use logical spacing (`margin-inline`, `padding-inline`, `text-align: start`), 44px control targets, visible focus rings, and named labels. Inputs require an associated label; error and hint descriptions are connected automatically. New buttons default to `type="button"`; explicitly use `submit` in forms. Loading disables duplicate submission. Icon-only controls need an accessible label.

```tsx
<Button locale={lang} loading={saving} type="submit">{copy.save}</Button>
<InputField label={copy.businessName} hint={copy.nameHint} error={nameError} />
<StatusBadge tone="warning">{copy.awaitingApproval}</StatusBadge>
```

## Before → after

| Area | Before | Phase 1 |
|---|---|---|
| Palette | Partial colors inside globals + Tailwind literals | Central palette with distinct brand, action and semantic text roles |
| Font delivery | Remote CSS import, Vazirmatn for every language | Local variable subsets; Inter for Latin locales |
| Theme control | Local storage could disagree with server theme | Rendered document is authoritative; duplicate controls synchronize |
| Language control | Separate cookie/localStorage implementation | Uses the existing shared locale API |
| Text direction | `.prose` forced RTL | Inherits direction, keeps code LTR |
| Reduced motion | Selected landing components only | Shared MotionConfig plus global CSS guard and static skeleton fallback |
| Browser zoom | maximumScale=1 | Zoom restriction removed |
| UI primitives | Repeated page-specific controls | Reusable, localized accessible foundations |

## Review and validation

Run `npm run preview:ui` to build `docs/uiux/foundation-preview.html` from the actual React components and production CSS. The generated artifact is local, standalone, has embedded fonts, and does not call business APIs. It is intentionally not a production route. Serve its directory locally for testing (e.g. `python3 -m http.server 3108 --bind 127.0.0.1 --directory docs/uiux`).

Automated checks: `npm test`, `npx tsc --noEmit`, targeted `next lint`. Contrast tests enforce 4.5:1 for foundation text/actions/statuses and 3:1 for input boundaries/focus indicators in both themes. SSR tests check default button behavior, loading, and label/error relationships.

## Scope boundary

Phase 1 is the foundation, **not** the full application redesign. Global tokens, fonts, motion preferences and shared theme/language controls are connected. Landing, dashboards, navigation, agents and admin pages migrate in subsequent approved phases. German foundation copy is ready; German is not advertised in the app's language switcher until legacy pages and their strings can support it coherently. This avoids showing Persian content under a German language label. No schema, business behavior, publishing permission, or production deployment changed.

### Validation record — 2026-09-07

- 44 tests passed across 8 suites, including all existing tests.
- TypeScript `--noEmit`: passed. Targeted ESLint: passed. `git diff --check`: passed.
- Production compilation and complete Next build passed using an ephemeral random JWT secret and an isolated temporary database URL supplied only to the build process. The first attempt correctly failed because this checkout had no JWT_SECRET. No production credentials or environment files were changed; the build is not a verification of real database/API availability. The isolated database has no SiteSetting table, so static-page generation logged the existing caught Prisma errors and used fallback settings.
- Browser: actual `/login` rendered. Component preview checked in Persian RTL, English/German LTR; desktop/tablet/mobile layouts inspected at 1280/768/360 widths. A transient German overflow measurement during resize was rechecked after layout settled: no overflowing elements remained.
- German/light/mobile screenshot and Persian/dark/desktop screenshot captured in `docs/uiux`. Keyboard Tab reached the email field with a visible 2px outline. Reduced-motion emulation stopped skeleton animation; theme toggle and local success feedback worked.
- Full 68-page visual matrix, production data flows and complete German localization remain for the later phases; this record covers the foundation only.
