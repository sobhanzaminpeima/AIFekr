# Student branding card — 2026-10-04

- Story card: actual PNG at 1080 × 1920, portrait and student name, AIFekr AI University statement and learning-community identity. Email excluded from image, public page and public profile API.
- Persian, English, German and Turkish copy, with RTL Persian and localized sharing/download guidance. Public page has language selection and student registration link.
- Private profiles can export their own card without being published. A public profile link appears in the image only when publication is saved and enabled.
- Native Web Share receives a prepared PNG File during the user gesture; unsupported file sharing downloads the same PNG. Cancelling sharing is silent; export errors allow retry. Remote-avatar failures fall back to initials with a localized notice.
- Full tests: 107 files / 775 tests passed, including file-sharing, fallback, cancellation and all language copy cases. TypeScript and targeted ESLint passed.
- CUA browser QA: rendered all four languages; screenshots checked Persian, German and Turkish; natural image dimensions confirmed 1080 × 1920. Download button displayed completion. At 390px, DOM confirmed page scroll width equals viewport and image remains within the page.
- Actual social sending was not performed: automatic approval review rejected the share-button click due to unspecified destination. Native sharing is covered by mocked tests. The browser later timed out while attempting a final saved screenshot, so no screenshot artifact is claimed.
- No database migration required; existing privacy settings retained.
