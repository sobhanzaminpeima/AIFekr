# Student mobile layout review

The student workspace now uses eight visible icon destinations in a two-row mobile grid instead of a horizontally hidden navigation strip. Course actions use two columns, overview actions stack, and controls have a 44px minimum touch height. Inputs use 16px text on mobile to avoid focus zoom. Student dialogs use a bottom sheet with viewport-bounded scrolling and safe-area padding. Styles are scoped to the student workspace; tablet and desktop navigation retain their existing layout.

The student tutor previously extended its composer beneath the global mobile navigation. Its mobile viewport height now reserves space for that navigation and the safe area; desktop height remains unchanged.

Executed verification:
- Authenticated local preview with isolated uiux-preview.db; no production accounts or paid AI calls.
- All eight student views at 320px: document width equals viewport width, with no horizontal overflow.
- 390px: all eight navigation items visible, 66px-high tiles; add-course dialog bottom aligned, 16px inputs, save confirmed. Temporary course removed from the isolated database afterward.
- 1440px: original vertical desktop navigation, no horizontal overflow.
- Student tutor at 390px visually checked; at 320x568, composer bottom 445px is above mobile navigation top 512px.
- TypeScript and targeted ESLint passed.

JARVIS classification: browser-safe presentation change. Existing student routes and APIs remain available; this change adds no separate JARVIS backend or SSO behavior.
